import type {
  Transcriber as MoonshineTranscriber,
  Stream,
  TranscriptEventListener,
  TranscriptLine,
} from "@moonshine-ai/moonshine-wasm";

type MoonshineLanguage = "english" | "spanish";

let transcriber: MoonshineTranscriber | null = null;
let stream: Stream | null = null;
let loadedLanguage: MoonshineLanguage | null = null;
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

  stream = transcriber.createStream({ updateInterval: 0.5 });
  stream.addListener(listener);
  stream.start();
  post("session-ready", { sessionId });
}

async function load(language: MoonshineLanguage, preferredEnglishModel?: "small" | "tiny") {
  if (transcriber && loadedLanguage === language) {
    post("ready", { model: language === "english" ? "small-streaming" : "base" });
    return;
  }

  closeStream();
  transcriber?.close();
  transcriber = null;
  loadedLanguage = language;

  const { ModelArch, Transcriber } = await getMoonshineModule();

  const logicalCores = Number(navigator.hardwareConcurrency) || 1;
  const deviceMemory = Number((navigator as Navigator & { deviceMemory?: number }).deviceMemory) || 0;
  const prefersTiny = language === "english" && (
    preferredEnglishModel === "tiny" ||
    (!preferredEnglishModel && (logicalCores <= 4 || (deviceMemory > 0 && deviceMemory <= 4)))
  );
  let modelArch = language === "english"
    ? prefersTiny ? ModelArch.TinyStreaming : ModelArch.SmallStreaming
    : ModelArch.Base;
  let modelName = language === "english"
    ? prefersTiny ? "tiny-streaming" : "small-streaming"
    : "base";

  const loadModel = (arch: Parameters<typeof Transcriber.load>[0]["modelArch"]) => Transcriber.load({
    language: language === "english" ? "en" : "es",
    modelArch: arch,
    onProgress: (loaded, total, file) => {
      post("progress", { loaded, total, file });
    },
  });

  try {
    transcriber = await loadModel(modelArch);
  } catch (error) {
    if (language !== "english" || modelArch === ModelArch.TinyStreaming) throw error;
    post("model-fallback", {
      failedModel: modelName,
      message: error instanceof Error ? error.message : String(error),
    });
    modelArch = ModelArch.TinyStreaming;
    modelName = "tiny-streaming";
    transcriber = await loadModel(modelArch);
  }

  post("ready", { model: modelName });
}

async function handleMessage(event: MessageEvent) {
  const { type, language, sessionId, audio, sampleRate, englishModel } = event.data || {};

  if (type === "load") {
    await load(language as MoonshineLanguage, englishModel);
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
    stream.transcribe();
    post("audio-processed", {
      sessionId: activeSessionId,
      id: event.data?.id,
      processingMs: Math.round(performance.now() - startedAt),
      audioDurationSec: audio.length / (Number(sampleRate) || 16_000),
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
