export type TranscriptionLanguage = "auto" | "spanish" | "english";

export interface LocalAudioChunk {
  id: string;
  audio: Float32Array;
  sampleRate: number;
  language: TranscriptionLanguage;
  sessionId: number;
}

export interface AudioLevel {
  peak: number;
  rms: number;
}

export function getChunkDurationSec(chunk: Pick<LocalAudioChunk, "audio" | "sampleRate">) {
  return chunk.sampleRate > 0 ? chunk.audio.length / chunk.sampleRate : 0;
}

export function getQueueDurationSec(chunks: Array<Pick<LocalAudioChunk, "audio" | "sampleRate">>) {
  return chunks.reduce((total, chunk) => total + getChunkDurationSec(chunk), 0);
}

/**
 * Takes the oldest pending chunks in order and combines as many as possible.
 * Whisper has a sizeable fixed cost per inference, so coalescing backlog lets a
 * slower computer catch up without silently throwing speech away.
 */
export function takeCoalescedChunk(
  queue: LocalAudioChunk[],
  maxDurationSec: number,
): LocalAudioChunk | null {
  const first = queue.shift();
  if (!first) return null;

  const chunks = [first];
  let totalSamples = first.audio.length;

  while (queue.length > 0) {
    const candidate = queue[0];
    const compatible =
      candidate.sessionId === first.sessionId &&
      candidate.sampleRate === first.sampleRate &&
      candidate.language === first.language;
    const combinedDuration = (totalSamples + candidate.audio.length) / first.sampleRate;

    if (!compatible || combinedDuration > maxDurationSec) break;
    chunks.push(queue.shift()!);
    totalSamples += candidate.audio.length;
  }

  if (chunks.length === 1) return first;

  const audio = new Float32Array(totalSamples);
  let offset = 0;
  for (const chunk of chunks) {
    audio.set(chunk.audio, offset);
    offset += chunk.audio.length;
  }

  return {
    ...first,
    id: `${first.id}..${chunks[chunks.length - 1].id}`,
    audio,
  };
}

/** Keeps a bounded, recent queue and reports how much old audio had to be lost. */
export function trimAudioQueue(queue: LocalAudioChunk[], maxDurationSec: number) {
  let durationSec = getQueueDurationSec(queue);
  let droppedDurationSec = 0;
  let droppedChunks = 0;

  while (queue.length > 1 && durationSec > maxDurationSec) {
    const dropped = queue.shift()!;
    const droppedSec = getChunkDurationSec(dropped);
    durationSec -= droppedSec;
    droppedDurationSec += droppedSec;
    droppedChunks += 1;
  }

  return { durationSec, droppedDurationSec, droppedChunks };
}

export function measureAudioLevel(audio: Float32Array): AudioLevel {
  if (audio.length === 0) return { peak: 0, rms: 0 };

  let peak = 0;
  let sumSquares = 0;
  for (let index = 0; index < audio.length; index += 1) {
    const sample = audio[index];
    const absolute = Math.abs(sample);
    if (absolute > peak) peak = absolute;
    sumSquares += sample * sample;
  }

  return { peak, rms: Math.sqrt(sumSquares / audio.length) };
}

export function shouldSwitchWebGPUToWasm(
  processingMs: number,
  audioDurationSec: number,
  consecutiveSlowResults: number,
) {
  if (!Number.isFinite(processingMs) || !Number.isFinite(audioDurationSec) || audioDurationSec <= 0) {
    return false;
  }

  const realtimeRatio = processingMs / (audioDurationSec * 1000);
  // Switching backends forces another model initialization, so only do it for
  // a genuinely unusable GPU. A 4-5 s WebGPU pass is still better than a 6 s
  // WASM pass and the queue can coalesce enough audio to keep throughput live.
  const decisivelySlowerThanRealtime = processingMs >= 10_000 && realtimeRatio >= 2.5;
  const repeatedlySlow = processingMs >= 8_000 && realtimeRatio >= 2 && consecutiveSlowResults >= 2;
  return decisivelySlowerThanRealtime || repeatedlySlow;
}
