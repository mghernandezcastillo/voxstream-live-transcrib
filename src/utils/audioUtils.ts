/**
 * Formats milliseconds into MM:SS format
 */
export function formatTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Returns best supported mimeType for MediaRecorder
 */
export function getSupportedAudioMimeType(): string {
  const types = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
    "audio/wav",
  ];
  for (const t of types) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t)) {
      return t;
    }
  }
  return "audio/webm";
}

/**
 * Converts Blob to Base64 data string
 */
export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      // Strip data URL prefix if necessary
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Download text file helper
 */
export function downloadFile(content: string, filename: string, mimeType: string = "text/plain") {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Generates SRT subtitle format string from segments
 */
export function generateSRT(segments: { rawTimestampMs: number; text: string }[]): string {
  let srt = "";
  segments.forEach((seg, index) => {
    const startTime = formatSRTTime(seg.rawTimestampMs);
    const endTime = formatSRTTime(seg.rawTimestampMs + 4000); // approximate 4s duration
    srt += `${index + 1}\n${startTime} --> ${endTime}\n${seg.text}\n\n`;
  });
  return srt;
}

function formatSRTTime(ms: number): string {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const millis = Math.floor(ms % 1000);

  const pad = (n: number, z = 2) => n.toString().padStart(z, "0");
  const padMs = (n: number) => n.toString().padStart(3, "0");

  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)},${padMs(millis)}`;
}
