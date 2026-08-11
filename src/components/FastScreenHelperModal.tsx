import React, { useState, useRef, useEffect } from "react";
import {
  Zap,
  Camera,
  X,
  Sparkles,
  Copy,
  Check,
  HelpCircle,
  Loader2,
  FileQuestion,
  Lightbulb,
  Send,
  Eye,
} from "lucide-react";

interface FastScreenHelperModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoRef: React.RefObject<HTMLVideoElement | null>;
  stream: MediaStream | null;
}

export const FastScreenHelperModal: React.FC<FastScreenHelperModalProps> = ({
  isOpen,
  onClose,
  videoRef,
  stream,
}) => {
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);
  const [customPrompt, setCustomPrompt] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [activeMode, setActiveMode] = useState<"fast_answer" | "explain" | "custom">("fast_answer");
  const hiddenCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Capture current video frame and downscale to max 800px width (JPEG 0.6 quality)
  const captureSnapshot = (): string | null => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      return null;
    }

    const canvas = hiddenCanvasRef.current || document.createElement("canvas");
    hiddenCanvasRef.current = canvas;

    // Downscale for ultra-lightweight payload & fast token processing
    const maxDimension = 800;
    let width = video.videoWidth;
    let height = video.videoHeight;

    if (width > maxDimension || height > maxDimension) {
      if (width > height) {
        height = Math.round((height * maxDimension) / width);
        width = maxDimension;
      } else {
        width = Math.round((width * maxDimension) / height);
        height = maxDimension;
      }
    }

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, width, height);
    // Compress as JPEG 0.60 quality for light tokens
    return canvas.toDataURL("image/jpeg", 0.6);
  };

  const handleTakeSnapshotAndQuery = async (
    mode: "fast_answer" | "explain" | "custom",
    overridePrompt?: string
  ) => {
    setActiveMode(mode);
    setLoading(true);
    setAnswer(null);

    const imgBase64 = captureSnapshot();
    if (!imgBase64) {
      setAnswer("⚠️ No se pudo obtener la captura de la pestaña compartida. Asegúrate de que la reproducción de la transmisión esté activa.");
      setLoading(false);
      return;
    }

    setSnapshotUrl(imgBase64);

    try {
      const promptToSend =
        overridePrompt ||
        (mode === "fast_answer"
          ? "Identifica la pregunta o examen mostrado en pantalla y proporciona la opción o respuesta exacta directamente."
          : mode === "explain"
          ? "Explica brevemente lo que se observa en esta captura de pantalla."
          : customPrompt);

      const res = await fetch("/api/fast-vision-query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: imgBase64,
          prompt: promptToSend,
          mode,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setAnswer(data.answer || "No se obtuvo respuesta.");
      } else {
        setAnswer(`Error: ${data.error || "No se pudo procesar la consulta."}`);
      }
    } catch (err: any) {
      setAnswer(`Error de conexión: ${err?.message || "Inténtalo de nuevo."}`);
    } finally {
      setLoading(false);
    }
  };

  // Auto-take snapshot when opening modal if stream exists
  useEffect(() => {
    if (isOpen) {
      const img = captureSnapshot();
      if (img) setSnapshotUrl(img);
    }
  }, [isOpen]);

  const handleCopy = () => {
    if (answer) {
      navigator.clipboard.writeText(answer);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#020617]/95 backdrop-blur-2xl border border-white/10 rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]">
        {/* Glow accent */}
        <div className="absolute -top-16 -right-16 w-56 h-56 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-400 to-indigo-500 p-0.5 shadow-lg shadow-cyan-500/20">
              <div className="w-full h-full bg-[#020617] rounded-[10px] flex items-center justify-center text-cyan-400">
                <Zap size={20} />
              </div>
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Asistente Rápido de Pantalla / Exámenes
                <span className="text-[10px] bg-cyan-400/10 text-cyan-300 border border-cyan-400/30 px-2 py-0.5 rounded-full font-mono">
                  Bajo Consumo de Tokens
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Captura instantánea de la pestaña en vivo con consulta Gemini optimizada
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-xl hover:bg-white/10 transition"
          >
            <X size={20} />
          </button>
        </div>

        {/* Fast Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-4">
          <button
            onClick={() => handleTakeSnapshotAndQuery("fast_answer")}
            disabled={loading}
            className="p-3 bg-gradient-to-r from-cyan-500/20 to-indigo-500/20 hover:from-cyan-500/30 hover:to-indigo-500/30 border border-cyan-400/40 rounded-xl flex items-center gap-2.5 text-left text-slate-100 transition group backdrop-blur-md"
          >
            <div className="p-2 rounded-lg bg-cyan-400 text-slate-950 font-bold group-hover:scale-105 transition-transform">
              <FileQuestion size={16} />
            </div>
            <div>
              <div className="text-xs font-bold text-cyan-300">⚡ Resolver Pregunta</div>
              <div className="text-[10px] text-slate-400">Respuesta directa de examen</div>
            </div>
          </button>

          <button
            onClick={() => handleTakeSnapshotAndQuery("explain")}
            disabled={loading}
            className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-cyan-400/30 rounded-xl flex items-center gap-2.5 text-left text-slate-100 transition group backdrop-blur-md"
          >
            <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 group-hover:scale-105 transition-transform">
              <Lightbulb size={16} />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-200">💡 Explicar Pantalla</div>
              <div className="text-[10px] text-slate-400">Resumen y concepto clave</div>
            </div>
          </button>

          <button
            onClick={() => {
              const img = captureSnapshot();
              if (img) setSnapshotUrl(img);
            }}
            disabled={loading}
            className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl flex items-center gap-2.5 text-left text-slate-100 transition group backdrop-blur-md"
          >
            <div className="p-2 rounded-lg bg-slate-800 text-slate-300 group-hover:scale-105 transition-transform">
              <Camera size={16} />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-200">📸 Nueva Captura</div>
              <div className="text-[10px] text-slate-400">Refrescar fotograma en vivo</div>
            </div>
          </button>
        </div>

        {/* Content Body: Image Thumbnail & Answer Output */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">
          {/* Screenshot Preview */}
          <div className="relative bg-slate-950/80 rounded-xl border border-white/10 overflow-hidden min-h-[140px] max-h-[220px] flex items-center justify-center">
            {snapshotUrl ? (
              <img
                src={snapshotUrl}
                alt="Captura de pantalla"
                className="w-full h-full object-contain max-h-[200px]"
              />
            ) : (
              <div className="p-6 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
                <Eye size={24} className="text-slate-500" />
                <span>Transmitiendo pestaña... Haz clic en "Resolver Pregunta" para capturar el cuadro actual.</span>
              </div>
            )}
            {snapshotUrl && (
              <div className="absolute top-2 right-2 bg-slate-950/80 backdrop-blur-md border border-white/10 text-[10px] font-mono text-cyan-300 px-2 py-0.5 rounded-md">
                JPEG Compreso (~800px) • Ultra-Ligero
              </div>
            )}
          </div>

          {/* Custom prompt bar */}
          <div className="flex gap-2">
            <input
              type="text"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="Escribe una pregunta específica sobre la captura..."
              onKeyDown={(e) => {
                if (e.key === "Enter" && customPrompt.trim()) {
                  handleTakeSnapshotAndQuery("custom", customPrompt);
                }
              }}
              className="flex-1 bg-slate-950/60 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:border-cyan-400 backdrop-blur-md"
            />
            <button
              onClick={() => handleTakeSnapshotAndQuery("custom", customPrompt)}
              disabled={loading || !customPrompt.trim()}
              className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-slate-950 rounded-xl text-xs font-bold flex items-center gap-1.5 transition active:scale-95 shadow-md"
            >
              <Send size={14} />
              <span>Consultar</span>
            </button>
          </div>

          {/* AI Response Output */}
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 backdrop-blur-md min-h-[120px] relative">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                <Sparkles size={14} />
                <span>Respuesta Rápida de Gemini:</span>
              </span>
              {answer && (
                <button
                  onClick={handleCopy}
                  className="px-2 py-1 bg-white/10 hover:bg-white/20 text-slate-200 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition"
                >
                  {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                  <span>{copied ? "Copiado" : "Copiar"}</span>
                </button>
              )}
            </div>

            {loading ? (
              <div className="py-6 flex flex-col items-center justify-center gap-2 text-xs text-cyan-300 font-medium">
                <Loader2 size={22} className="animate-spin text-cyan-400" />
                <span>Analizando captura de pantalla en tiempo récord...</span>
              </div>
            ) : answer ? (
              <div className="text-xs sm:text-sm text-slate-100 leading-relaxed font-sans whitespace-pre-wrap selection:bg-cyan-500 selection:text-slate-950">
                {answer}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic py-2">
                Haz clic en <strong>Resolver Pregunta</strong> o realiza una consulta personalizada sobre la transmisión en vivo para ver la respuesta aquí.
              </p>
            )}
          </div>
        </div>

        {/* Footer info */}
        <div className="pt-3 mt-3 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400">
          <span className="flex items-center gap-1">
            <HelpCircle size={13} className="text-cyan-400" />
            Tip: Maximiza la ventana compartida para mayor nitidez.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-bold text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
