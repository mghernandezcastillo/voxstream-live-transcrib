import type {
  Transcriber as MoonshineTranscriber,
  Stream,
  Transcript,
  TranscriptEventListener,
  TranscriptLine,
} from "@moonshine-ai/moonshine-wasm";
import {
  getMoonshineModelProfile,
  MOONSHINE_MAX_LINE_DURATION_SEC,
  MOONSHINE_UPDATE_INTERVAL_SEC,
} from "../utils/moonshineRuntime";
import { isMoonshineManifestCached } from "../utils/moonshineCache";

type MoonshineLanguage = "english" | "spanish";

let transcriber: MoonshineTranscriber | null = null;
let stream: Stream | null = null;
let loadedLanguage: MoonshineLanguage | null = null;
let loadedModelName: "tiny-streaming" | "base" | null = null;
let lastTranscriptSnapshot: Transcript | null = null;
let activeSessionId = 0;
let commandChain = Promise.resolve();
let moonshineModulePromise: Promise<typeof import("@moonshine-ai/moonshine-wasm")> | null = null;

function post(type: string, data: Record<string, unknown> = {}) {
  self.postMessage({ type, engine: "moonshine", language: loadedLanguage, ...data });
}

function cleanText(text: unknown) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function serializeLine(line: TranscriptLine) {
  return {
    id: line.id,
    text: cleanText(line.text),
    startTime: line.startTime,
    duration: line.duration,
    isComplete: line.isComplete,
    latencyMs: line.lastTranscriptionLatencyMs,
  };
}

function closeStream() {
  if (!stream) return;
  try {
    stream.removeAllListeners();
    stream.close();
  } catch {
    // The worker is about to replace or close this stream anyway.
  }
  stream = null;
  lastTranscriptSnapshot = null;
}

async function getMoonshineModule() {
  if (!self.crossOriginIsolated || typeof SharedArrayBuffer === "undefined") {
    throw new Error(
      "Moonshine requiere aislamiento del navegador (COOP/COEP). Reinicia el servidor y recarga la página.",
    );
  }

  moonshineModulePromise ??= import("@moonshine-ai/moonshine-wasm");
  try {
    return await moonshineModulePromise;
  } catch (error) {
    moonshineModulePromise = null;
    throw new Error(
      `No se pudo cargar el módulo Moonshine: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    );
  }
}

function startSession(sessionId: number) {
  if (!transcriber) throw new Error("Moonshine todavía no está cargado");
  closeStream();
  activeSessionId = sessionId;

  const listener: TranscriptEventListener = {
    onLineTextChanged: ({ line }) => {
      const serialized = serializeLine(line);
      if (serialized.text) post("partial", { sessionId: activeSessionId, line: serialized });
    },
    onLineCompleted: ({ line }) => {
      const serialized = serializeLine(line);
      if (serialized.text) post("final", { sessionId: activeSessionId, line: serialized });
    },
    onError: ({ error }) => {
      post("error", { sessionId: activeSessionId, message: error.message });
    },
  };

  stream = transcriber.createStream({ updateInterval: MOONSHINE_UPDATE_INTERVAL_SEC });
  stream.addListener(listener);
  stream.start();
  post("session-ready", { sessionId });
}

async function load(language: MoonshineLanguage) {
  if (transcriber && loadedLanguage === language) {
    post("ready", { model: loadedModelName });
    return;
  }

  closeStream();
  transcriber?.close();
  transcriber = null;
  loadedLanguage = language;
  const modelProfile = getMoonshineModelProfile(language);
  loadedModelName = modelProfile.model;

  const { ModelArch, Transcriber, loadMoonshineModule } = await getMoonshineModule();

  const modelArch = modelProfile.model === "tiny-streaming"
    ? ModelArch.TinyStreaming
    : ModelArch.Base;
  const languageCode = language === "english" ? "en" : "es";
  const module = await loadMoonshineModule();
  const manifest = module.sttDependencies(languageCode, String(modelArch), false);
  const source = await isMoonshineManifestCached(manifest) ? "cache" : "network";
  post("load-start", { source, model: loadedModelName });

  const loadModel = (arch: Parameters<typeof Transcriber.load>[0]["modelArch"]) => Transcriber.load({
    language: languageCode,
    modelArch: arch,
    module,
    options: {
      transcription_interval: String(MOONSHINE_UPDATE_INTERVAL_SEC),
      vad_window_duration: "0.3",
      vad_max_segment_duration: String(MOONSHINE_MAX_LINE_DURATION_SEC),
      return_audio_data: "false",
    },
    onProgress: (loaded, total, file) => {
      post("progress", { loaded, total, file, source });
    },
  });

  transcriber = await loadModel(modelArch);

  post("ready", { model: loadedModelName });
}

async function handleMessage(event: MessageEvent) {
  const { type, language, sessionId, audio, sampleRate } = event.data || {};

  if (type === "load") {
    await load(language as MoonshineLanguage);
    return;
  }

  if (type === "start") {
    startSession(Number(sessionId));
    return;
  }

  if (type === "audio") {
    if (!stream || Number(sessionId) !== activeSessionId) {
      post("audio-processed", { sessionId, id: event.data?.id, ignored: true });
      return;
    }

    if (!(audio instanceof Float32Array)) {
      throw new Error("Moonshine recibió un fragmento PCM inválido");
    }

    const startedAt = performance.now();
    stream.addAudio(audio, Number(sampleRate) || 16_000);
    const transcript = stream.transcribe();
    const didTranscribe = transcript !== lastTranscriptSnapshot;
    lastTranscriptSnapshot = transcript;
    post("audio-processed", {
      sessionId: activeSessionId,
      id: event.data?.id,
      processingMs: Math.round(performance.now() - startedAt),
      audioDurationSec: audio.length / (Number(sampleRate) || 16_000),
      didTranscribe,
    });
    return;
  }

  if (type === "stop") {
    if (stream && Number(sessionId) === activeSessionId) {
      stream.stop();
      closeStream();
    }
    post("stopped", { sessionId });
    return;
  }

  if (type === "dispose") {
    closeStream();
    transcriber?.close();
    transcriber = null;
    loadedLanguage = null;
    loadedModelName = null;
  }
}

self.addEventListener("message", (event) => {
  commandChain = commandChain
    .then(() => handleMessage(event))
    .catch((error) => {
      post("error", {
        sessionId: activeSessionId,
        message: error instanceof Error ? error.message : String(error),
      });
    });
});
