import { pipeline } from "@huggingface/transformers";

const MODEL_ID = "onnx-community/whisper-base";
const TARGET_SAMPLE_RATE = 16_000;

let transcriberPromise: Promise<any> | null = null;

const hasWebGPU = Boolean((navigator as any).gpu);
const backend = hasWebGPU ? "webgpu" : "wasm";

function loadTranscriber() {
  if (!transcriberPromise) {
    const options = hasWebGPU
      ? {
          device: "webgpu",
          dtype: {
            encoder_model: "fp32",
            decoder_model_merged: "q4",
          },
        }
      : {
          dtype: {
            encoder_model: "q8",
            decoder_model_merged: "q4",
          },
        };

    transcriberPromise = pipeline("automatic-speech-recognition", MODEL_ID, {
      ...options,
      progress_callback: (progress: unknown) => {
        self.postMessage({ type: "progress", progress, backend });
      },
    } as any);
  }

  return transcriberPromise;
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

self.addEventListener("message", async (event) => {
  const { type, id, audio, sampleRate, language } = event.data || {};

  try {
    if (type === "load") {
      await loadTranscriber();
      self.postMessage({ type: "ready", backend });
      return;
    }

    if (type !== "transcribe" || !(audio instanceof Float32Array)) return;

    self.postMessage({ type: "processing", id, backend });
    const transcriber = await loadTranscriber();
    const normalizedAudio = resampleTo16Khz(audio, Number(sampleRate) || TARGET_SAMPLE_RATE);
    const result = await transcriber(normalizedAudio, {
      task: "transcribe",
      ...(language !== "auto" && { language: language || "spanish" }),
      max_new_tokens: 64,
      num_beams: 1,
      return_timestamps: false,
    });

    const rawText = Array.isArray(result)
      ? result.map((item) => item?.text || "").join(" ")
      : result?.text || "";
    const normalizedText = String(rawText).trim();
    
    // Whisper commonly hallucinates tags in brackets or parentheses for background noise.
    // E.g. [crickets chirping], (soft music), [silence]
    const isOnlyTags = /^(\s*(\[.*?\]|\(.*?\)|♪|\*.*?\*)\s*)+$/i.test(normalizedText);
    
    const text = isOnlyTags ? "" : normalizedText;

    self.postMessage({ type: "result", id, text, backend });
  } catch (error: any) {
    self.postMessage({
      type: "error",
      id,
      backend,
      message: error?.message || String(error),
    });
  }
});
