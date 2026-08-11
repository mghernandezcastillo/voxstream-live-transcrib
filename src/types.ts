export interface TranscriptSegment {
  id: string;
  timestamp: string; // e.g. "00:12"
  rawTimestampMs: number;
  text: string;
  translatedText?: string;
  speaker?: string;
  language?: string;
  isEditing?: boolean;
  isPartial?: boolean;
}

export type TranscriptionState = "idle" | "requesting" | "recording" | "paused" | "error";

export type AudioSourceType = "tab" | "mic" | "file";

export interface AISummary {
  summary: string;
  keyPoints: string[];
  topics: string[];
  actionItems?: string[];
  updatedAt: string;
}

export interface Settings {
  aiEngine: "cloud" | "local";
  chunkDurationSec: number; // e.g. 3, 4, 5
  inputLanguage: "auto" | "spanish" | "english";
  autoTranslate: boolean;
  targetLanguage: string;
  autoScroll: boolean;
  fontSize: "sm" | "md" | "lg" | "xl";
  showTimestamps: boolean;
  showSpeakers: boolean;
  showVideoPreview: boolean;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}
