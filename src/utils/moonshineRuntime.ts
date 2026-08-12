import type { OptimizedLanguage } from "./languageDetection";

export const MOONSHINE_CAPTURE_CHUNK_SEC = 0.5;
export const MOONSHINE_UPDATE_INTERVAL_SEC = 0.5;
export const MOONSHINE_MAX_LINE_DURATION_SEC = 6;

export interface MoonshineModelProfile {
  model: "tiny-streaming" | "base";
  shortLabel: "Tiny Streaming" | "Base";
  streaming: boolean;
  maxBatchDurationSec: number;
}

export function getMoonshineModelProfile(
  language: OptimizedLanguage,
): MoonshineModelProfile {
  if (language === "english") {
    return {
      model: "tiny-streaming",
      shortLabel: "Tiny Streaming",
      streaming: true,
      maxBatchDurationSec: 2,
    };
  }

  return {
    model: "base",
    shortLabel: "Base",
    streaming: false,
    maxBatchDurationSec: 5,
  };
}

export function getMoonshineBatchDurationSec(
  language: OptimizedLanguage,
  queuedDurationSec: number,
) {
  const profile = getMoonshineModelProfile(language);
  if (!Number.isFinite(queuedDurationSec) || queuedDurationSec <= MOONSHINE_CAPTURE_CHUNK_SEC) {
    return MOONSHINE_CAPTURE_CHUNK_SEC;
  }

  return Math.min(
    profile.maxBatchDurationSec,
    Math.max(MOONSHINE_CAPTURE_CHUNK_SEC, queuedDurationSec),
  );
}

export function getEndToEndLatencyMs(capturedAtMs: number, completedAtMs = Date.now()) {
  if (!Number.isFinite(capturedAtMs) || capturedAtMs <= 0) return 0;
  return Math.max(0, completedAtMs - capturedAtMs);
}
