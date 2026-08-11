import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import {
  TranscriptSegment,
  TranscriptionState,
  AudioSourceType,
  AISummary,
  Settings,
} from "./types";
import { formatTimestamp, blobToBase64, getSupportedAudioMimeType } from "./utils/audioUtils";
import { AudioVisualizer } from "./components/AudioVisualizer";
import { TabShareGuideModal } from "./components/TabShareGuideModal";
import { LiveTranscriptStream } from "./components/LiveTranscriptStream";
import { AISummaryPanel } from "./components/AISummaryPanel";
import { AIChatModal } from "./components/AIChatModal";
import { SettingsModal } from "./components/SettingsModal";
import { ExportModal } from "./components/ExportModal";
import { FastScreenHelperModal } from "./components/FastScreenHelperModal";
import {
  Monitor,
  Mic,
  Pause,
  Play,
  Square,
  Sparkles,
  MessageSquare,
  Download,
  Settings as SettingsIcon,
  HelpCircle,
  AlertTriangle,
  Volume2,
  Tv,
  Zap,
  Languages,
} from "lucide-react";

type LocalEngineStatus = "idle" | "loading" | "ready" | "fallback";

type LocalAudioChunk = {
  id: string;
  audio: Float32Array;
  sampleRate: number;
  language: "auto" | "spanish" | "english";
  sessionId: number;
};

export default function App() {
  // State
  const [transcriptionState, setTranscriptionState] = useState<TranscriptionState>("idle");
  const [sourceType, setSourceType] = useState<AudioSourceType>("tab");
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [summary, setSummary] = useState<AISummary | null>(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const [isProcessingChunk, setIsProcessingChunk] = useState(false);
  const [recordingDurationMs, setRecordingDurationMs] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [localEngineStatus, setLocalEngineStatus] = useState<LocalEngineStatus>("idle");
  const [localEngineBackend, setLocalEngineBackend] = useState<"webgpu" | "wasm" | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadStatus, setDownloadStatus] = useState("");

  // Modals
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [showChatModal, setShowChatModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showFastHelperModal, setShowFastHelperModal] = useState(false);

  // Settings
  const [settings, setSettings] = useState<Settings>({
    aiEngine: "local",
    chunkDurationSec: 1.2,
    inputLanguage: "english",
    autoTranslate: false,
    targetLanguage: "Español",
    autoScroll: true,
    fontSize: "md",
    showTimestamps: true,
    showSpeakers: false,
    showVideoPreview: true,
  });

  // Refs for audio processing
  const recorderRef = useRef<MediaRecorder | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const audioProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const segmentsRef = useRef<TranscriptSegment[]>([]);
  const isRecordingRef = useRef<boolean>(false);
  const audioChunkQueueRef = useRef<Array<{ blob: Blob; mimeType: string }>>([]);
  const isDrainingChunkQueueRef = useRef(false);
  const localWorkerRef = useRef<Worker | null>(null);
  const localWorkerReadyRef = useRef(false);
  const localWorkerFailedRef = useRef(false);
  const localWorkerBusyRef = useRef(false);
  const localAudioQueueRef = useRef<LocalAudioChunk[]>([]);
  const localActiveChunkRef = useRef<LocalAudioChunk | null>(null);
  const localSessionIdRef = useRef(0);
  const transcriptionAbortRef = useRef<AbortController | null>(null);
  const lastAppendPromiseRef = useRef<Promise<void>>(Promise.resolve());
  const activeNetworkRequestsCount = useRef<number>(0);

  const timerRef = useRef<number | null>(null);
  const chunkIntervalRef = useRef<number | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const startTimeRef = useRef<number>(0);

  // For tracking model download progress properly across multiple concurrent files
  const downloadProgressCache = useRef<Record<string, { loaded: number; total: number }>>({});

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTranscription();
      localWorkerRef.current?.terminate();
      localWorkerRef.current = null;
    };
  }, []);

  // Update video element preview when stream changes
  useEffect(() => {
    if (videoPreviewRef.current && stream) {
      videoPreviewRef.current.srcObject = stream;
    }
  }, [stream]);

  useEffect(() => {
    segmentsRef.current = segments;
  }, [segments]);

  // Duration Timer
  useEffect(() => {
    if (transcriptionState === "recording") {
      timerRef.current = window.setInterval(() => {
        setRecordingDurationMs((prev) => prev + 1000);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [transcriptionState]);

  // Start Tab Audio Capture
  const handleStartTabCapture = async () => {
    setErrorMessage(null);
    setSourceType("tab");

    try {
      setTranscriptionState("requesting");

      // Request screen/tab sharing with audio enabled (Chrome defaults audio on for tabs)
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: "browser",
        },
        audio: {
          suppressLocalAudioPlayback: false,
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        } as any,
        systemAudio: "include",
        surfaceSwitching: "include",
      } as any);

      const audioTracks = displayStream.getAudioTracks();

      if (audioTracks.length === 0) {
        setErrorMessage(
          "⚠️ No se detectó canal de audio en la pestaña seleccionada. Al abrir el selector de Chrome, asegúrate de marcar la casilla 'Compartir audio de la pestaña' en la esquina inferior izquierda."
        );
        // Stop video track
        displayStream.getTracks().forEach((track) => track.stop());
        setTranscriptionState("idle");
        return;
      }

      // Handle when user stops sharing via browser banner ("Stop sharing")
      displayStream.getVideoTracks()[0]?.addEventListener("ended", () => {
        stopTranscription();
      });

      streamRef.current = displayStream;
      setStream(displayStream);
      startAudioRecorder(displayStream, "tab");
    } catch (err: any) {
      console.error("Error capturing tab audio:", err);
      if (
        err.message?.includes("display-capture") ||
        err.message?.includes("permissions policy") ||
        err.name === "SecurityError"
      ) {
        setErrorMessage(
          "⚠️ La captura de pantalla está restringida dentro del marco incrustado del navegador. Por favor abre la app en una nueva pestaña (botón superior derecho 'Open in new tab') para habilitar la transmisión en vivo de pestañas."
        );
      } else if (err.name !== "NotAllowedError") {
        setErrorMessage(`Error al capturar pestaña: ${err.message || "Permiso denegado"}`);
      }
      setTranscriptionState("idle");
    }
  };

  // Start Microphone Audio Capture
  const handleStartMicCapture = async () => {
    setErrorMessage(null);
    setSourceType("mic");

    try {
      setTranscriptionState("requesting");
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      streamRef.current = micStream;
      setStream(micStream);
      startAudioRecorder(micStream, "mic");
    } catch (err: any) {
      console.error("Error capturing mic audio:", err);
      setErrorMessage(`Error al acceder al micrófono: ${err.message || "Permiso denegado"}`);
      setTranscriptionState("idle");
    }
  };

// Helper to encode Float32 PCM audio into standard 16-bit PCM WAV Blob
function encodeWAV(samples: Float32Array, sampleRate: number): Blob {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  /* RIFF identifier */
  for (let i = 0; i < 4; i++) view.setUint8(i, "RIFF".charCodeAt(i));
  /* RIFF chunk length */
  view.setUint32(4, 36 + samples.length * 2, true);
  /* RIFF type */
  for (let i = 0; i < 4; i++) view.setUint8(8 + i, "WAVE".charCodeAt(i));
  /* format chunk identifier */
  for (let i = 0; i < 4; i++) view.setUint8(12 + i, "fmt ".charCodeAt(i));
  /* format chunk length */
  view.setUint32(16, 16, true);
  /* sample format (raw PCM) */
  view.setUint16(20, 1, true);
  /* channel count (1 = mono) */
  view.setUint16(22, 1, true);
  /* sample rate */
  view.setUint32(24, sampleRate, true);
  /* byte rate (sampleRate * 2) */
  view.setUint32(28, sampleRate * 2, true);
  /* block align */
  view.setUint16(32, 2, true);
  /* bits per sample */
  view.setUint16(34, 16, true);
  /* data chunk identifier */
  for (let i = 0; i < 4; i++) view.setUint8(36 + i, "data".charCodeAt(i));
  /* data chunk length */
  view.setUint32(40, samples.length * 2, true);

  // Write PCM samples
  let offset = 44;
  for (let i = 0; i < samples.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return new Blob([buffer], { type: "audio/wav" });
}

  const appendTranscriptSegment = (
    text: string,
    language?: string,
    speaker?: string
  ) => {
    const cleanText = text.trim();
    if (!cleanText) return;
    setErrorMessage(null);

    const currentMs = Date.now() - startTimeRef.current;
    
    setSegments((previousSegments) => {
      const lastSegment = previousSegments[previousSegments.length - 1];
      // Check if we should merge with the previous segment
      // (if it doesn't end with a punctuation mark, and wasn't too long ago)
      const normalizeLang = (l?: string) => {
        if (!l) return "";
        const lower = l.toLowerCase();
        if (lower.includes("ingl") || lower.includes("engl")) return "en";
        if (lower.includes("espa") || lower.includes("span")) return "es";
        return lower;
      };

      const shouldMerge =
        lastSegment &&
        !/[.?!]\s*$/.test(lastSegment.text) &&
        (currentMs - lastSegment.rawTimestampMs) < 15000 &&
        (!speaker || lastSegment.speaker === speaker) &&
        (!language || !lastSegment.language || normalizeLang(lastSegment.language) === normalizeLang(language));

      let segmentId = "";
      let mergedText = cleanText;
      const newSegments = [...previousSegments];

      if (shouldMerge) {
        segmentId = lastSegment.id;
        mergedText = `${lastSegment.text} ${cleanText}`;
        newSegments[newSegments.length - 1] = {
          ...lastSegment,
          text: mergedText,
        };
      } else {
        segmentId = `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        newSegments.push({
          id: segmentId,
          timestamp: formatTimestamp(currentMs),
          rawTimestampMs: currentMs,
          text: cleanText,
          speaker: speaker || undefined,
          language: language || undefined,
        });
      }

      if (settings.autoTranslate) {
        void fetch("/api/translate-transcript", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            text: mergedText,
            targetLanguage: settings.targetLanguage,
          }),
        })
          .then((response) => response.json())
          .then((translation) => {
            if (!translation.translatedText) return;
            setSegments((currentSegments) =>
              currentSegments.map((segment) =>
                segment.id === segmentId
                  ? { ...segment, translatedText: translation.translatedText }
                  : segment
              )
            );
          })
          .catch((error) => console.error("Translation error:", error));
      }

      return newSegments;
    });
  };

  const sendChunkToGeminiFallback = (chunk: LocalAudioChunk) => {
    if (!isRecordingRef.current || chunk.sessionId !== localSessionIdRef.current) return;
    enqueueAudioChunk(encodeWAV(chunk.audio, chunk.sampleRate), "audio/wav");
  };

  const activateGeminiFallback = (failedChunk?: LocalAudioChunk | null) => {
    localWorkerFailedRef.current = true;
    localWorkerReadyRef.current = false;
    localWorkerBusyRef.current = false;
    localWorkerRef.current?.terminate();
    localWorkerRef.current = null;
    setLocalEngineStatus("fallback");
    setIsProcessingChunk(false);

    const queuedChunks = [
      ...(failedChunk ? [failedChunk] : []),
      ...localAudioQueueRef.current,
    ];
    localActiveChunkRef.current = null;
    localAudioQueueRef.current = [];
    queuedChunks.forEach(sendChunkToGeminiFallback);
  };

  const drainLocalAudioQueue = () => {
    if (
      !isRecordingRef.current ||
      !localWorkerReadyRef.current ||
      localWorkerBusyRef.current ||
      !localWorkerRef.current
    ) {
      return;
    }

    let nextChunk = localAudioQueueRef.current.shift();
    while (nextChunk && nextChunk.sessionId !== localSessionIdRef.current) {
      nextChunk = localAudioQueueRef.current.shift();
    }
    if (!nextChunk) return;

    localWorkerBusyRef.current = true;
    localActiveChunkRef.current = nextChunk;
    setIsProcessingChunk(true);

    try {
      localWorkerRef.current.postMessage({
        type: "transcribe",
        id: nextChunk.id,
        audio: nextChunk.audio,
        sampleRate: nextChunk.sampleRate,
        language: nextChunk.language,
      });
    } catch (error) {
      console.error("[VoxStream Local Whisper] No se pudo enviar audio al worker:", error);
      activateGeminiFallback(nextChunk);
    }
  };

  const ensureLocalTranscriptionWorker = () => {
    if (localWorkerFailedRef.current) {
      setLocalEngineStatus("fallback");
      return;
    }

    if (localWorkerRef.current) {
      if (localWorkerReadyRef.current) drainLocalAudioQueue();
      return;
    }

    try {
      setLocalEngineStatus("loading");
      const worker = new Worker(
        new URL("./workers/localTranscription.worker.ts", import.meta.url),
        { type: "module" },
      );
      localWorkerRef.current = worker;

      worker.onmessage = ({ data }) => {
        if (data?.backend === "webgpu" || data?.backend === "wasm") {
          setLocalEngineBackend(data.backend);
        }

        if (data?.type === "progress") {
          const { status, name, file, progress, loaded, total } = data.progress;
          const fileName = file || name || "unknown";

          if (status === "progress" && loaded !== undefined && total !== undefined) {
            downloadProgressCache.current[fileName] = { loaded, total };
            
            let totalLoaded = 0;
            let totalSize = 0;
            Object.values(downloadProgressCache.current).forEach((p) => {
              totalLoaded += p.loaded;
              totalSize += p.total;
            });
            
            if (totalSize > 0) {
               const overallProgress = Math.round((totalLoaded / totalSize) * 100);
               setDownloadProgress(overallProgress);
               setDownloadStatus(`Descargando modelo: ${fileName} (${Math.round(progress)}%)`);
            }
          } else if (status === "initiate") {
             downloadProgressCache.current[fileName] = { loaded: 0, total: 100 }; // placeholder total
             setDownloadStatus(`Iniciando descarga: ${fileName}`);
          } else if (status === "ready" || status === "done") {
             setDownloadStatus(`Descarga completa`);
             if (Object.keys(downloadProgressCache.current).length > 0) {
               let totalLoaded = 0;
               let totalSize = 0;
               Object.values(downloadProgressCache.current).forEach((p) => {
                 totalLoaded += p.loaded;
                 totalSize += p.total;
               });
               if (totalSize > 0 && totalLoaded === totalSize) {
                 setDownloadProgress(100);
               }
             } else {
               setDownloadProgress(100);
             }
          }
        }

        if (data?.type === "ready") {
          localWorkerReadyRef.current = true;
          setLocalEngineStatus("ready");
          console.log(
            `[VoxStream] Whisper local listo con ${String(data.backend).toUpperCase()}.`,
          );
          drainLocalAudioQueue();
          return;
        }

        if (data?.type === "result") {
          const completedChunk = localActiveChunkRef.current;
          localActiveChunkRef.current = null;
          localWorkerBusyRef.current = false;
          setIsProcessingChunk(false);

          const text = String(data.text || "").trim();
          if (
            text &&
            completedChunk?.id === data.id &&
            completedChunk.sessionId === localSessionIdRef.current
          ) {
            appendTranscriptSegment(
              text,
              completedChunk.language === "auto" ? "Automático" : (completedChunk.language === "spanish" ? "Español" : "English"),
            );
          }

          drainLocalAudioQueue();
          return;
        }

        if (data?.type === "error") {
          console.error("[VoxStream Local Whisper]", data.message || "Error desconocido");
          activateGeminiFallback(localActiveChunkRef.current);
        }
      };

      worker.onerror = (event) => {
        console.error("[VoxStream Local Whisper Worker]", event.message || event);
        activateGeminiFallback(localActiveChunkRef.current);
      };

      worker.postMessage({ type: "load" });
    } catch (error) {
      console.error("[VoxStream] No se pudo iniciar Whisper local:", error);
      activateGeminiFallback();
    }
  };

  useEffect(() => {
    ensureLocalTranscriptionWorker();
  }, []);

  const enqueueLocalAudioChunk = (audio: Float32Array, sampleRate: number) => {
    const chunk: LocalAudioChunk = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      audio,
      sampleRate,
      language: settings.inputLanguage,
      sessionId: localSessionIdRef.current,
    };

    if (settings.aiEngine === "cloud" || localWorkerFailedRef.current) {
      sendChunkToGeminiFallback(chunk);
      return;
    }

    localAudioQueueRef.current.push(chunk);

    // Several minutes of raw PCM still use modest memory. Drop only in an extreme
    // stalled-load scenario; never send queued audio to Gemini just because loading is slow.
    if (localAudioQueueRef.current.length > 200) {
      localAudioQueueRef.current.shift();
      console.warn("[VoxStream Local Whisper] Se descartó el fragmento más antiguo por cola saturada.");
    }

    ensureLocalTranscriptionWorker();
    drainLocalAudioQueue();
  };

  // Begin downloading/caching Whisper as soon as the app opens so capture starts quickly.
  useEffect(() => {
    ensureLocalTranscriptionWorker();
  }, []);

  // Whisper runs locally in the browser. Gemini is only a compatibility fallback.
  const startAudioRecorder = async (
    mediaStream: MediaStream,
    captureSource: AudioSourceType,
  ) => {
    try {
      const audioTracks = mediaStream.getAudioTracks();
      if (audioTracks.length === 0) {
        setErrorMessage(
          "⚠️ No se detectó canal de audio. Al compartir la pestaña, asegúrate de marcar la casilla 'Compartir audio de la pestaña'."
        );
        setTranscriptionState("idle");
        return;
      }

      // Cleanup any active AudioContext
      if (audioContextRef.current) {
        try {
          audioContextRef.current.close();
        } catch {}
        audioContextRef.current = null;
      }

      isRecordingRef.current = true;
      localSessionIdRef.current += 1;
      startTimeRef.current = Date.now();
      setTranscriptionState("recording");
      ensureLocalTranscriptionWorker();
      console.log(
        `[VoxStream] Captura de ${captureSource === "mic" ? "micrófono" : "pestaña"} iniciada con Whisper local.`,
      );

      let pcmBuffers: Float32Array[] = [];

      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        const ctx = new AudioCtx({ sampleRate: 16_000 });
        if (ctx.state === "suspended") {
          await ctx.resume();
        }
        audioContextRef.current = ctx;

        // Isolate audio tracks strictly in new MediaStream to prevent Chrome video track errors
        const audioOnlyStream = new MediaStream(audioTracks);
        const source = ctx.createMediaStreamSource(audioOnlyStream);
        const processor = ctx.createScriptProcessor(4096, 1, 1);
        audioSourceRef.current = source;
        audioProcessorRef.current = processor;

        processor.onaudioprocess = (e) => {
          if (!isRecordingRef.current) return;
          const input = e.inputBuffer.getChannelData(0);
          pcmBuffers.push(new Float32Array(input));
        };

        source.connect(processor);
        processor.connect(ctx.destination);

        const intervalMs = settings.chunkDurationSec * 1000;
        chunkIntervalRef.current = window.setInterval(async () => {
          if (!isRecordingRef.current || pcmBuffers.length === 0) return;

          const currentBuffers = pcmBuffers;
          pcmBuffers = [];

          const totalSamples = currentBuffers.reduce((acc, b) => acc + b.length, 0);
          if (totalSamples < ctx.sampleRate * 0.3) return; // ignore tiny buffers (<0.3s)

          const merged = new Float32Array(totalSamples);
          let offset = 0;
          for (const buf of currentBuffers) {
            merged.set(buf, offset);
            offset += buf.length;
          }

          let maxVal = 0;
          for (let i = 0; i < merged.length; i++) {
            const abs = Math.abs(merged[i]);
            if (abs > maxVal) maxVal = abs;
          }

          console.log(`[VoxStream PCM Capture] Fragmento local: ${merged.length} muestras, nivel pico: ${maxVal.toFixed(4)} (${ctx.sampleRate}Hz)`);

          const threshold = captureSource === "mic" ? 0.015 : 0.002;
          if (maxVal < threshold) {
            if (captureSource !== "mic") {
               console.warn(`[VoxStream Audio Warning] El nivel de audio capturado es casi cero (${maxVal.toFixed(4)}). Verifica que la pestaña de YouTube no esté silenciada y que activaste 'Compartir audio de la pestaña'.`);
            }
            return;
          }

          enqueueLocalAudioChunk(merged, ctx.sampleRate);
        }, intervalMs);

      } catch (audioCtxErr) {
        console.warn("AudioContext PCM capture failed, falling back to MediaRecorder:", audioCtxErr);
        activateGeminiFallback();

        if (audioContextRef.current) {
          await audioContextRef.current.close().catch(() => {});
          audioContextRef.current = null;
        }
        audioSourceRef.current = null;
        audioProcessorRef.current = null;

        const recordingStream = new MediaStream(audioTracks);
        const mimeType = getSupportedAudioMimeType();
        let mediaRecorder: MediaRecorder;
        try {
          mediaRecorder = mimeType
            ? new MediaRecorder(recordingStream, { mimeType })
            : new MediaRecorder(recordingStream);
        } catch (e) {
          mediaRecorder = new MediaRecorder(recordingStream);
        }

        recorderRef.current = mediaRecorder;
        const effectiveMimeType = mediaRecorder.mimeType || mimeType || "audio/webm";

        mediaRecorder.ondataavailable = async (e) => {
          if (e.data && e.data.size > 1000) {
            enqueueAudioChunk(e.data, effectiveMimeType);
          }
        };

        mediaRecorder.start(settings.chunkDurationSec * 1000);
      }
    } catch (err: any) {
      console.error("Failed to start audio recorder:", err);
      setErrorMessage(`No se pudo iniciar el grabador de audio: ${err.message || "Error del navegador"}`);
      setTranscriptionState("idle");
    }
  };

  // Gemini normally takes longer than the capture interval. Process chunks in order
  // instead of sending overlapping requests that can...
  const enqueueAudioChunk = (blob: Blob, mimeType: string) => {
    if (!isRecordingRef.current) return;
    
    activeNetworkRequestsCount.current += 1;
    setIsProcessingChunk(true);
    
    // Start network request immediately in the background
    const base64AudioPromise = blobToBase64(blob);
    const previousContext = segmentsRef.current
        .slice(-3)
        .map((s) => s.text)
        .join(" ");
        
    const networkPromise = base64AudioPromise.then(base64Audio => {
      const abortController = new AbortController();
      transcriptionAbortRef.current = abortController;
      
      return fetch("/api/transcribe-chunk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: abortController.signal,
        body: JSON.stringify({
          audioBase64: base64Audio,
          mimeType,
          previousContext,
          targetLanguage: settings.autoTranslate ? settings.targetLanguage : "auto",
        }),
      });
    }).then(async (res) => {
      const data = await res.json().catch(() => ({}));
      return { res, data };
    }).catch(err => {
      return { error: err };
    });

    // Chain to visual append queue to preserve chronological sequence
    lastAppendPromiseRef.current = lastAppendPromiseRef.current.then(async () => {
      try {
        const result: any = await networkPromise;
        
        if (result.error) {
          if (result.error?.name === "AbortError") return;
          console.error("Error processing chunk:", result.error);
          setErrorMessage("⚠️ No se pudo conectar con el servicio de transcripción. Se volverá a intentar.");
          return;
        }
        
        const { res, data } = result;
        if (!res.ok) {
          const message = data.error || `El servidor devolvió estado ${res.status}.`;
          console.warn(`[VoxStream API Warning] Servidor devolvió ${res.status}:`, data);
          setErrorMessage(`⚠️ ${message}`);
          if (data.code === "GEMINI_API_KEY_MISSING" || data.code === "TRANSCRIPTION_PROVIDER_ERROR") {
            stopTranscription();
          }
          return;
        }
        
        if (data.error) {
          setErrorMessage(`⚠️ ${data.error}`);
          return;
        }
        
        if (data.transcript && data.transcript.trim()) {
          const text = data.transcript.trim();
          console.log(`[VoxStream Transcripción] Nuevo texto detectado: "${text}"`);
          appendTranscriptSegment(text, data.detectedLanguage, data.speaker);
        }
      } finally {
        activeNetworkRequestsCount.current = Math.max(0, activeNetworkRequestsCount.current - 1);
        if (activeNetworkRequestsCount.current === 0) {
          setIsProcessingChunk(false);
        }
        transcriptionAbortRef.current = null;
      }
    });
  };

  // Pause / Resume
  const togglePause = () => {
    if (transcriptionState === "recording") {
      isRecordingRef.current = false;
      if (recorderRef.current?.state === "recording") {
        recorderRef.current.pause();
      } else if (audioContextRef.current?.state === "running") {
        void audioContextRef.current.suspend();
      }
      setTranscriptionState("paused");
    } else if (transcriptionState === "paused") {
      isRecordingRef.current = true;
      if (recorderRef.current?.state === "paused") {
        recorderRef.current.resume();
      } else if (audioContextRef.current?.state === "suspended") {
        void audioContextRef.current.resume();
      }
      setTranscriptionState("recording");
      drainLocalAudioQueue();
    }
  };

  // Stop Transcription
  const stopTranscription = () => {
    isRecordingRef.current = false;
    localSessionIdRef.current += 1;

    if (chunkIntervalRef.current) clearInterval(chunkIntervalRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
    chunkIntervalRef.current = null;
    timerRef.current = null;
    audioChunkQueueRef.current = [];
    localAudioQueueRef.current = [];
    if (!localActiveChunkRef.current) {
      localWorkerBusyRef.current = false;
    }
    setIsProcessingChunk(false);
    transcriptionAbortRef.current?.abort();
    transcriptionAbortRef.current = null;

    lastAppendPromiseRef.current = Promise.resolve();
    activeNetworkRequestsCount.current = 0;
    
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    recorderRef.current = null;

    audioProcessorRef.current?.disconnect();
    audioSourceRef.current?.disconnect();
    audioProcessorRef.current = null;
    audioSourceRef.current = null;

    if (audioContextRef.current) {
      try {
        audioContextRef.current.close();
      } catch {}
      audioContextRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    setStream(null);
    setTranscriptionState("idle");
  };

  // Generate AI Summary
  const handleGenerateSummary = async () => {
    if (segments.length === 0) return;
    setIsGeneratingSummary(true);

    const fullTranscriptText = segments.map((s) => `[${s.timestamp}] ${s.text}`).join("\n");

    try {
      const res = await fetch("/api/summarize-transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullTranscript: fullTranscriptText }),
      });

      const data = await res.json();
      setSummary({
        summary: data.summary || "No se obtuvo resumen.",
        keyPoints: data.keyPoints || [],
        topics: data.topics || [],
        actionItems: data.actionItems || [],
        updatedAt: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      });
    } catch (err) {
      console.error("Error generating summary:", err);
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  // Segment Handlers
  const handleUpdateSegment = (id: string, newText: string) => {
    setSegments((prev) => prev.map((s) => (s.id === id ? { ...s, text: newText } : s)));
  };

  const handleDeleteSegment = (id: string) => {
    setSegments((prev) => prev.filter((s) => s.id !== id));
  };

  const handleClearAll = () => {
    if (window.confirm("¿Seguro que deseas borrar toda la transcripción actual?")) {
      setSegments([]);
      setSummary(null);
      setRecordingDurationMs(0);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-slate-950 antialiased relative overflow-x-hidden">
      {/* Loading Overlay */}
      <AnimatePresence>
        {(localEngineStatus === "loading" || localEngineStatus === "idle") && (
          <motion.div 
            initial={{ opacity: 1, backdropFilter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 1.1, backdropFilter: "blur(10px)" }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 z-[100] bg-[#020617] flex flex-col items-center justify-center overflow-hidden"
          >
            <div className="fixed top-[-10%] left-[-10%] w-[45%] h-[45%] bg-indigo-600/30 rounded-full blur-[130px] pointer-events-none" />
            <div className="fixed bottom-[-5%] right-[-5%] w-[50%] h-[50%] bg-fuchsia-600/20 rounded-full blur-[140px] pointer-events-none" />

            <div className="relative z-10 flex flex-col items-center justify-center space-y-10">
              <div className="relative w-56 h-56 flex items-center justify-center">
                <motion.div 
                  animate={{ 
                    rotate: 360, 
                    borderColor: downloadProgress === 100 ? "rgba(16, 185, 129, 0.5)" : "rgba(34, 211, 238, 0.5)" 
                  }}
                  transition={{ rotate: { duration: 4, repeat: Infinity, ease: "linear" }, borderColor: { duration: 0.5 } }}
                  className="absolute inset-0 rounded-full border-2 border-transparent border-t-current border-r-current shadow-[0_0_20px_rgba(34,211,238,0.1)]" 
                />
                
                <motion.div 
                  animate={{ 
                    rotate: -360,
                    scale: downloadProgress === 100 ? [1, 1.05, 1] : 1,
                    borderColor: downloadProgress === 100 ? "rgba(52, 211, 153, 0.8)" : "rgba(99, 102, 241, 0.8)"
                  }}
                  transition={{ rotate: { duration: 3, repeat: Infinity, ease: "linear" }, scale: { duration: 1.5, repeat: Infinity, ease: "easeInOut" } }}
                  className="absolute inset-3 rounded-full border border-transparent border-b-current border-l-current shadow-[0_0_25px_rgba(99,102,241,0.2)]" 
                />
                
                <motion.div 
                  animate={{ 
                    rotate: 360, 
                    borderColor: downloadProgress === 100 ? "rgba(167, 243, 208, 0.6)" : "rgba(232, 121, 249, 0.8)" 
                  }}
                  transition={{ rotate: { duration: 2, repeat: Infinity, ease: "linear" } }}
                  className="absolute inset-8 rounded-full border border-transparent border-t-current" 
                />
                
                <motion.div 
                  animate={{ 
                    boxShadow: downloadProgress === 100 ? "0 0 40px rgba(16, 185, 129, 0.3)" : "0 0 0px rgba(0,0,0,0)",
                  }}
                  className="absolute inset-0 flex flex-col items-center justify-center bg-[#020617]/40 backdrop-blur-md rounded-full border border-white/5"
                >
                  <AnimatePresence mode="wait">
                    {downloadProgress === 100 ? (
                      <motion.div
                        key="ready"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="flex flex-col items-center"
                      >
                        <Sparkles size={28} className="text-emerald-400 mb-1 animate-pulse" />
                        <span className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-br from-emerald-300 to-teal-500 tracking-tighter">
                          Ready
                        </span>
                      </motion.div>
                    ) : (
                      <motion.div
                        key="loading"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.8 }}
                        className="flex flex-col items-center"
                      >
                        <Zap size={24} className="text-cyan-400 mb-1" />
                        <span className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-br from-cyan-300 to-indigo-400 tracking-tighter">
                          {downloadProgress}%
                        </span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              </div>

              <div className="flex flex-col items-center space-y-3 text-center max-w-sm">
                <AnimatePresence mode="wait">
                  <motion.h2 
                    key={downloadProgress === 100 ? "done" : "init"}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-2xl font-bold text-white tracking-tight"
                  >
                    {downloadProgress === 100 ? "Sistema Preparado" : "Inicializando Motor IA"}
                  </motion.h2>
                </AnimatePresence>
                
                <motion.div 
                  animate={{ 
                    backgroundColor: downloadProgress === 100 ? "rgba(16, 185, 129, 0.1)" : "rgba(34, 211, 238, 0.1)",
                    borderColor: downloadProgress === 100 ? "rgba(16, 185, 129, 0.2)" : "rgba(34, 211, 238, 0.2)",
                    color: downloadProgress === 100 ? "rgb(52, 211, 153)" : "rgb(34, 211, 238)"
                  }}
                  className="text-sm font-mono px-4 py-1.5 rounded-full border"
                >
                  {downloadProgress === 100 ? "Ensamblando pipeline local..." : (downloadStatus || "Preparando modelos...")}
                </motion.div>
                
                <p className="text-xs text-slate-400 mt-4 leading-relaxed px-4">
                  VoxStream procesa el audio localmente en tu dispositivo mediante WebGPU, garantizando latencia cero y máxima privacidad.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Background Mesh Blur Gradients */}
      <div className="fixed top-[-10%] left-[-10%] w-[45%] h-[45%] bg-indigo-600/25 rounded-full blur-[130px] pointer-events-none" />
      <div className="fixed bottom-[-5%] right-[-5%] w-[50%] h-[50%] bg-fuchsia-600/15 rounded-full blur-[140px] pointer-events-none" />
      <div className="fixed top-1/3 right-1/4 w-[35%] h-[35%] bg-cyan-500/15 rounded-full blur-[110px] pointer-events-none" />

      {/* Top Header Bar */}
      <header className="sticky top-0 z-30 bg-white/5 backdrop-blur-xl border-b border-white/10 px-4 lg:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-cyan-400 p-0.5 shadow-lg shadow-indigo-500/20">
            <div className="w-full h-full bg-[#020617]/80 backdrop-blur-md rounded-[10px] flex items-center justify-center text-cyan-400">
              <Volume2 size={22} />
            </div>
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              VoxStream <span className="text-cyan-400">AI</span>
              <span className="text-[10px] bg-cyan-400/10 text-cyan-300 border border-cyan-400/20 px-2 py-0.5 rounded-full font-mono uppercase tracking-wider font-semibold">
                Frosted Audio
              </span>
            </h1>
            <p className="text-xs text-slate-400 hidden sm:block">
              Transcripción local con Whisper y análisis opcional con Gemini
            </p>
          </div>
        </div>

        {/* Global Toolbar Action Buttons */}
        <div className="flex items-center gap-2">
          {/* Quick Language Selector */}
          <div className="hidden md:flex items-center bg-white/5 border border-white/10 rounded-xl px-1 py-1 mr-2 backdrop-blur-md">
            <button
              onClick={() => setSettings(s => ({ ...s, inputLanguage: 'english' }))}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${settings.inputLanguage === 'english' ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}
              title="Inglés Fijo (Optimizado)"
            >
              EN
            </button>
            <button
              onClick={() => setSettings(s => ({ ...s, inputLanguage: 'spanish' }))}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${settings.inputLanguage === 'spanish' ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}
              title="Español Fijo (Optimizado)"
            >
              ES
            </button>
            <button
              onClick={() => setSettings(s => ({ ...s, inputLanguage: 'auto' }))}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all flex items-center gap-1 ${settings.inputLanguage === 'auto' ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}
              title="Automático (Lento)"
            >
              <Languages size={12} className={settings.inputLanguage === 'auto' ? 'text-slate-950' : 'text-cyan-400'} />
              <span>Auto</span>
            </button>
          </div>

          {/* Fast Screen Helper / Exam Assistant */}
          <button
            onClick={() => setShowFastHelperModal(true)}
            className="px-3.5 py-2 bg-gradient-to-r from-cyan-500/20 to-indigo-500/20 hover:from-cyan-500/30 hover:to-indigo-500/30 text-cyan-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition border border-cyan-400/40 shadow-lg shadow-cyan-500/10 active:scale-95 backdrop-blur-md"
            title="Ayudante de Exámenes y Consultas Rápidas de Pantalla (Bajo Consumo Tokens)"
          >
            <Zap size={15} className="text-cyan-400 fill-cyan-400/30" />
            <span className="hidden sm:inline">⚡ Ayuda Exámenes</span>
          </button>

          {/* Help / Guide */}
          <button
            onClick={() => setShowGuideModal(true)}
            className="px-3 py-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl text-xs font-medium flex items-center gap-1.5 transition border border-white/10 backdrop-blur-md"
            title="Ver guía para compartir audio"
          >
            <HelpCircle size={16} className="text-cyan-400" />
            <span className="hidden md:inline">¿Cómo funciona?</span>
          </button>

          {/* AI Chat Button */}
          <button
            onClick={() => setShowChatModal(true)}
            className="px-3 py-2 bg-white/5 hover:bg-white/10 text-cyan-300 rounded-xl text-xs font-medium flex items-center gap-1.5 transition border border-cyan-400/30 hover:border-cyan-400/60 backdrop-blur-md"
            title="Preguntar a la IA sobre la transcripción"
          >
            <MessageSquare size={16} className="text-cyan-400" />
            <span className="hidden md:inline">Consultar IA</span>
          </button>

          {/* Settings Button */}
          <button
            onClick={() => setShowSettingsModal(true)}
            className="p-2 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl text-xs font-medium transition border border-white/10 backdrop-blur-md"
            title="Configuración"
          >
            <SettingsIcon size={16} />
          </button>

          {/* Export Button */}
          <button
            onClick={() => setShowExportModal(true)}
            disabled={segments.length === 0}
            className="px-3.5 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 disabled:opacity-40 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-lg shadow-cyan-500/20 active:scale-95"
          >
            <Download size={15} />
            <span className="hidden sm:inline">Exportar</span>
          </button>
        </div>
      </header>

      {/* Model Download Progress Indicator */}
      {downloadStatus && downloadProgress < 100 && (
        <div className="w-full relative z-20">
          <div className="w-full bg-slate-800 h-1.5">
            <div 
              className="bg-gradient-to-r from-cyan-500 to-indigo-500 h-1.5 transition-all duration-300 ease-out" 
              style={{ width: `${downloadProgress}%` }} 
            />
          </div>
          <div className="text-center text-xs font-medium text-cyan-400 py-1.5 bg-slate-950/80 backdrop-blur-sm border-b border-white/10 shadow-lg flex justify-center items-center gap-2">
            <div className="w-3 h-3 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
            {downloadStatus}
          </div>
        </div>
      )}

      {/* Main App Canvas Layout */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6 z-10">
        {/* Error Notification Banner */}
        {errorMessage && (
          <div className="p-4 bg-amber-950/60 backdrop-blur-xl border border-amber-500/40 rounded-2xl flex items-start justify-between gap-3 text-amber-200 text-xs shadow-2xl animate-in fade-in">
            <div className="flex items-start gap-2.5">
              <AlertTriangle size={18} className="text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-2">
                <p className="leading-relaxed font-medium">{errorMessage}</p>
                {errorMessage.includes("pestaña nueva") && (
                  <button
                    onClick={() => window.open(window.location.href, "_blank")}
                    className="px-3 py-1 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-lg text-xs transition inline-flex items-center gap-1 shadow-md"
                  >
                    🚀 Abrir en Pestaña Nueva para Permitir Transmisión
                  </button>
                )}
              </div>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-amber-400 hover:text-white text-xs font-bold underline shrink-0"
            >
              Cerrar
            </button>
          </div>
        )}

        {/* Primary Controls Bar */}
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4 sm:p-5 shadow-2xl flex flex-col md:flex-row items-center justify-between gap-4">
          {/* Main Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            {transcriptionState === "idle" ? (
              <>
                <button
                  onClick={() => setShowGuideModal(true)}
                  className="flex-1 sm:flex-initial px-5 py-3 bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-500 hover:opacity-95 text-white rounded-xl font-bold text-sm shadow-xl shadow-cyan-500/20 flex items-center justify-center gap-2.5 transition transform active:scale-98"
                >
                  <Monitor size={18} />
                  <span>Compartir Pestaña (Pantalla y Audio)</span>
                </button>

                <button
                  onClick={handleStartMicCapture}
                  className="px-4 py-3 bg-white/5 hover:bg-white/10 text-slate-200 rounded-xl font-semibold text-sm border border-white/10 flex items-center justify-center gap-2 transition backdrop-blur-md"
                >
                  <Mic size={18} className="text-cyan-400" />
                  <span>Usar Micrófono</span>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={togglePause}
                  className="px-4 py-2.5 bg-white/5 hover:bg-white/10 text-slate-200 rounded-xl font-semibold text-xs border border-white/10 flex items-center gap-2 transition backdrop-blur-md"
                >
                  {transcriptionState === "recording" ? (
                    <>
                      <Pause size={16} className="text-amber-400" />
                      <span>Pausar</span>
                    </>
                  ) : (
                    <>
                      <Play size={16} className="text-emerald-400" />
                      <span>Reanudar</span>
                    </>
                  )}
                </button>

                <button
                  onClick={stopTranscription}
                  className="px-5 py-2.5 bg-rose-500/80 hover:bg-rose-500 text-white rounded-xl font-bold text-xs shadow-lg border border-rose-400/30 flex items-center gap-2 transition active:scale-98 backdrop-blur-md"
                >
                  <Square size={16} />
                  <span>Detener Captura</span>
                </button>
              </>
            )}
          </div>

          {/* Recording Timer & Status Indicators */}
          <div className="flex items-center gap-4 text-xs font-mono w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 pt-3 md:pt-0 border-white/10">
            <div className="flex items-center gap-2 bg-slate-950/60 px-3 py-1.5 rounded-xl border border-white/10 backdrop-blur-md">
              <span className="text-slate-400">Tiempo:</span>
              <span className="font-bold text-cyan-300 text-sm">
                {formatTimestamp(recordingDurationMs)}
              </span>
            </div>

            <div
              data-local-engine-status={localEngineStatus}
              data-local-engine-backend={localEngineBackend || ""}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 backdrop-blur-md"
            >
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  transcriptionState === "recording"
                    ? "bg-cyan-400 animate-pulse shadow-[0_0_10px_rgba(34,211,238,0.8)]"
                    : transcriptionState === "paused"
                    ? "bg-amber-400"
                    : "bg-slate-500"
                }`}
              />
              <span className="capitalize font-sans font-semibold text-slate-200">
                {transcriptionState === "recording"
                  ? localEngineStatus === "loading"
                    ? "Cargando Whisper..."
                    : localEngineStatus === "ready"
                      ? `Whisper local${localEngineBackend ? ` (${localEngineBackend.toUpperCase()})` : ""}`
                      : localEngineStatus === "fallback"
                        ? "Respaldo Gemini"
                        : "Capturando..."
                  : transcriptionState === "paused"
                  ? "En Pausa"
                  : transcriptionState === "requesting"
                  ? "Conectando..."
                  : "Listo"}
              </span>
            </div>
          </div>
        </div>

        {/* Audio Visualizer Bar */}
        <AudioVisualizer
          stream={stream}
          isRecording={transcriptionState === "recording"}
          sourceType={sourceType}
        />

        {/* Split Grid: Left Live Stream, Right AI Insights & Video Thumbnail */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Transcript Stream Column (2 cols) */}
          <div className="lg:col-span-2 flex flex-col min-h-[500px]">
            <LiveTranscriptStream
              segments={segments}
              settings={settings}
              onUpdateSegment={handleUpdateSegment}
              onDeleteSegment={handleDeleteSegment}
              onClearAll={handleClearAll}
              isRecording={transcriptionState === "recording"}
              isProcessingChunk={isProcessingChunk}
            />
          </div>

          {/* Right Sidebar Column (1 col): Video Preview + AI Summary */}
          <div className="space-y-6 flex flex-col">
            {/* Tab Video Preview Box (if capturing display stream) */}
            {stream && sourceType === "tab" && settings.showVideoPreview && (
              <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                    <Tv size={14} className="text-cyan-400" />
                    <span>Vista Previa de Pestaña</span>
                  </span>
                  <span className="text-[10px] bg-cyan-400/10 text-cyan-300 border border-cyan-400/20 px-2 py-0.5 rounded-full font-mono font-semibold">
                    En Vivo
                  </span>
                </div>

                <div className="relative aspect-video bg-slate-950/80 rounded-xl overflow-hidden border border-white/10 shadow-inner group">
                  <video
                    ref={videoPreviewRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-contain"
                  />
                  <button
                    onClick={() => setShowFastHelperModal(true)}
                    className="absolute bottom-3 right-3 px-3 py-1.5 bg-cyan-500/90 hover:bg-cyan-400 text-slate-950 text-xs font-bold rounded-lg shadow-xl backdrop-blur-md flex items-center gap-1.5 transition active:scale-95"
                  >
                    <Zap size={14} />
                    <span>⚡ Captura Rápida AI</span>
                  </button>
                </div>
              </div>
            )}

            {/* AI Summary Panel */}
            <div className="flex-1">
              <AISummaryPanel
                segments={segments}
                summary={summary}
                isGenerating={isGeneratingSummary}
                onGenerateSummary={handleGenerateSummary}
              />
            </div>
          </div>
        </div>
      </main>

      {/* Modals */}
      <TabShareGuideModal
        isOpen={showGuideModal}
        onClose={() => setShowGuideModal(false)}
        onConfirmStart={handleStartTabCapture}
      />

      <AIChatModal
        isOpen={showChatModal}
        onClose={() => setShowChatModal(false)}
        segments={segments}
        videoRef={videoPreviewRef}
        stream={stream}
      />

      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        settings={settings}
        onUpdateSettings={(newSet) => setSettings((prev) => ({ ...prev, ...newSet }))}
      />

      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        segments={segments}
      />

      <FastScreenHelperModal
        isOpen={showFastHelperModal}
        onClose={() => setShowFastHelperModal(false)}
        videoRef={videoPreviewRef}
        stream={stream}
      />
    </div>
  );
}
