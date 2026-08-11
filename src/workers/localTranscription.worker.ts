import { env, pipeline } from "@huggingface/transformers";

const MODEL_ID = "onnx-community/whisper-tiny";
const TARGET_SAMPLE_RATE = 16_000;

type Backend = "webgpu" | "wasm";
type BackendPreference = "auto" | Backend;

let transcriber: any = null;
let backend: Backend = "wasm";
let messageChain = Promise.resolve();

const logicalCores = Number(navigator.hardwareConcurrency) || 1;
const wasmThreads = self.crossOriginIsolated
  ? Math.max(1, Math.min(8, Math.floor(logicalCores * 0.75)))
  : 1;
(env.backends.onnx as any).wasm.numThreads = wasmThreads;

function post(type: string, data: Record<string, unknown> = {}) {
  self.postMessage({ type, backend, ...data });
}

async function canUseWebGPU() {
  if (!(navigator as any).gpu) return { supported: false, supportsF16: false };

  try {
    const adapter = await (navigator as any).gpu.requestAdapter();
    return {
      supported: Boolean(adapter),
      supportsF16: Boolean(adapter?.features?.has?.("shader-f16")),
    };
  } catch {
    return { supported: false, supportsF16: false };
  }
}

async function createTranscriber(candidate: Backend, supportsF16 = false) {
  backend = candidate;
  const options = candidate === "webgpu"
    ? {
        device: "webgpu",
        dtype: {
          // fp16 is fast when the adapter explicitly supports it. fp32 is the
          // compatible WebGPU default and avoids shader compilation failures.
          encoder_model: supportsF16 ? "fp16" : "fp32",
          decoder_model_merged: "q4",
        },
      }
    : {
        device: "wasm",
        dtype: {
          encoder_model: "q8",
          decoder_model_merged: "q4",
        },
      };

  return pipeline("automatic-speech-recognition", MODEL_ID, {
    ...options,
    progress_callback: (progress: unknown) => post("progress", { progress }),
  } as any);
}

async function loadTranscriber(preference: BackendPreference) {
  if (transcriber) return transcriber;

  const webGPU = await canUseWebGPU();
  const candidates: Backend[] = preference === "wasm"
    ? ["wasm"]
    : preference === "webgpu"
      ? ["webgpu"]
      : webGPU.supported
        ? ["webgpu", "wasm"]
        : ["wasm"];

  let lastError: unknown;
  for (const candidate of candidates) {
    try {
      transcriber = await createTranscriber(candidate, webGPU.supportsF16);
      return transcriber;
    } catch (error) {
      lastError = error;
      transcriber = null;
      post("backend-fallback", {
        failedBackend: candidate,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function resampleTo16Khz(audio: Float32Array, inputSampleRate: number) {
  if (inputSampleRate === TARGET_SAMPLE_RATE) return audio;

  const ratio = inputSampleRate / TARGET_SAMPLE_RATE;
  const outputLength = Math.max(1, Math.round(audio.length / ratio));
  const output = new Float32Array(outputLength);

  for (let index = 0; index < outputLength; index += 1) {
    const position = index * ratio;
    const leftIndex = Math.floor(position);
    const rightIndex = Math.min(leftIndex + 1, audio.length - 1);
    const fraction = position - leftIndex;
    output[index] = audio[leftIndex] * (1 - fraction) + audio[rightIndex] * fraction;
  }

  return output;
}

function cleanTranscript(rawText: unknown) {
  const normalized = String(rawText || "").replace(/\s+/g, " ").trim();
  const isOnlyTags = /^(\s*(\[.*?\]|\(.*?\)|♪|\*.*?\*)\s*)+$/i.test(normalized);
  return isOnlyTags ? "" : normalized;
}

async function handleMessage(event: MessageEvent) {
  const { type, id, audio, sampleRate, language, backendPreference = "auto" } = event.data || {};

  try {
    if (type === "load") {
      const activeTranscriber = await loadTranscriber(backendPreference as BackendPreference);

      // Compile the inference path before capture begins. A failed warm-up is
      // non-fatal because the model itself may still be usable.
      try {
        await activeTranscriber(new Float32Array(TARGET_SAMPLE_RATE), {
          task: "transcribe",
          language: "english",
          max_new_tokens: 1,
          num_beams: 1,
        });
      } catch (error) {
        post("warmup-warning", {
          message: error instanceof Error ? error.message : String(error),
        });
      }

      post("ready", { wasmThreads });
      return;
    }

    if (type !== "transcribe" || !(audio instanceof Float32Array)) return;

    post("processing", { id });
    const activeTranscriber = await loadTranscriber(backendPreference as BackendPreference);
    const normalizedAudio = resampleTo16Khz(audio, Number(sampleRate) || TARGET_SAMPLE_RATE);
    const durationSec = normalizedAudio.length / TARGET_SAMPLE_RATE;
    const inferenceStartedAt = performance.now();
    const result = await activeTranscriber(normalizedAudio, {
      task: "transcribe",
      ...(language !== "auto" && { language: language || "spanish" }),
      max_new_tokens: Math.min(128, Math.max(24, Math.ceil(durationSec * 8))),
      num_beams: 1,
      return_timestamps: false,
    });

    const rawText = Array.isArray(result)
      ? result.map((item) => item?.text || "").join(" ")
      : result?.text || "";

    post("result", {
      id,
      text: cleanTranscript(rawText),
      processingMs: Math.round(performance.now() - inferenceStartedAt),
      audioDurationSec: durationSec,
    });
  } catch (error) {
    post("error", {
      id,
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

// Serialize every command inside the worker as a second line of defense. ONNX
// sessions, especially WebGPU sessions, must never receive overlapping calls.
self.addEventListener("message", (event) => {
  messageChain = messageChain.then(() => handleMessage(event));
});
