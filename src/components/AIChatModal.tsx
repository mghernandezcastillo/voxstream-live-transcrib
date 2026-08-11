import React, { useState, useRef } from "react";
import { ChatMessage, TranscriptSegment } from "../types";
import {
  MessageSquare,
  Send,
  Bot,
  User,
  X,
  Sparkles,
  Loader2,
  Camera,
  Zap,
  Lightbulb,
  FileQuestion,
  Trash2,
} from "lucide-react";

interface AIChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  segments: TranscriptSegment[];
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  stream?: MediaStream | null;
}

export const AIChatModal: React.FC<AIChatModalProps> = ({
  isOpen,
  onClose,
  segments,
  videoRef,
  stream,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "¡Hola! Soy tu asistente VoxStream. Hazme cualquier pregunta sobre lo que se habla en el audio o lo que se ve en la pantalla compartida (ej: 'Responde la pregunta del examen en pantalla', '¿Qué significa esa gráfica?', 'Resume los últimos minutos').",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    },
  ]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [attachedImage, setAttachedImage] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  if (!isOpen) return null;

  // Capture downscaled frame for minimal token consumption (~800px max, 0.6 JPEG)
  const captureCurrentScreen = (): string | null => {
    if (!videoRef || !videoRef.current) return null;
    const video = videoRef.current;
    if (video.videoWidth === 0 || video.videoHeight === 0) return null;

    const canvas = canvasRef.current || document.createElement("canvas");
    canvasRef.current = canvas;

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
    return canvas.toDataURL("image/jpeg", 0.6);
  };

  const handleAttachScreen = () => {
    const img = captureCurrentScreen();
    if (img) {
      setAttachedImage(img);
    } else {
      alert("No hay una pestaña o pantalla en vivo activa para capturar.");
    }
  };

  const handleQuickPrompt = (promptText: string, autoAttachScreen: boolean = false) => {
    setInput(promptText);
    if (autoAttachScreen) {
      const img = captureCurrentScreen();
      if (img) setAttachedImage(img);
    }
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if ((!input.trim() && !attachedImage) || isSending) return;

    const promptTextToSend = input.trim() || "Analiza el contenido visible en la pantalla.";
    const imageToSend = attachedImage;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: promptTextToSend + (imageToSend ? " [📸 Captura de pantalla adjunta]" : ""),
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setAttachedImage(null);
    setIsSending(true);

    const fullTranscriptText = segments.map((s) => `[${s.timestamp}] ${s.text}`).join("\n");

    try {
      const res = await fetch("/api/chat-transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullTranscript: fullTranscriptText,
          question: promptTextToSend,
          imageBase64: imageToSend || undefined,
        }),
      });

      const data = await res.json().catch(() => ({ answer: "No se pudo obtener una respuesta válida del servidor." }));

      const botMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.answer || "No pude responder con la información actual.",
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      console.error("Error asking question:", err);
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "Ocurrió un error al consultar con Gemini.",
          timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150">
      <div className="bg-[#020617]/90 backdrop-blur-2xl border border-white/10 rounded-2xl max-w-xl w-full h-[620px] flex flex-col shadow-2xl relative overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 bg-white/5 border-b border-white/10 backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-400/10 text-cyan-400 border border-cyan-400/20 flex items-center justify-center">
              <Bot size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                Consultar Transcripción y Pantalla
                <Sparkles size={14} className="text-cyan-400" />
              </h3>
              <p className="text-[11px] text-slate-400">
                Respuesta multimodal con bajísimo consumo de tokens (On-Demand Frame)
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-xl hover:bg-white/10 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Quick Action Chips */}
        <div className="p-2.5 bg-slate-950/40 border-b border-white/5 flex gap-2 overflow-x-auto text-[11px] font-semibold text-slate-300">
          <button
            onClick={() =>
              handleQuickPrompt("Analiza la pregunta de examen visible y da la opción correcta con una frase explicativa.", true)
            }
            className="px-2.5 py-1 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 rounded-lg flex items-center gap-1 shrink-0 transition"
          >
            <Zap size={12} className="text-cyan-400" />
            <span>⚡ Examen en Pantalla</span>
          </button>

          <button
            onClick={() =>
              handleQuickPrompt("Explica brevemente lo que se observa en la pantalla compartida.", true)
            }
            className="px-2.5 py-1 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 rounded-lg flex items-center gap-1 shrink-0 transition"
          >
            <Lightbulb size={12} className="text-indigo-400" />
            <span>💡 Explicar Diapositiva</span>
          </button>

          <button
            onClick={() => handleQuickPrompt("¿Cuáles son los puntos principales mencionados hasta ahora en el audio?")}
            className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10 rounded-lg flex items-center gap-1 shrink-0 transition"
          >
            <MessageSquare size={12} className="text-slate-400" />
            <span>📝 Resumir Audio</span>
          </button>
        </div>

        {/* Message stream */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 font-sans">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-2.5 max-w-[85%] ${
                msg.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"
              }`}
            >
              <div
                className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold ${
                  msg.role === "user"
                    ? "bg-cyan-500 text-slate-950 shadow-md"
                    : "bg-white/10 border border-white/10 text-cyan-400"
                }`}
              >
                {msg.role === "user" ? <User size={13} /> : <Bot size={13} />}
              </div>

              <div
                className={`p-3 rounded-2xl text-xs leading-relaxed ${
                  msg.role === "user"
                    ? "bg-cyan-500 text-slate-950 rounded-tr-none font-medium shadow-lg shadow-cyan-500/20"
                    : "bg-white/5 border border-white/10 text-slate-200 rounded-tl-none backdrop-blur-md"
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
                <span
                  className={`block text-[10px] mt-1 text-right ${
                    msg.role === "user" ? "text-slate-900/80 font-bold" : "text-slate-400"
                  }`}
                >
                  {msg.timestamp}
                </span>
              </div>
            </div>
          ))}

          {isSending && (
            <div className="flex gap-2.5 mr-auto">
              <div className="w-7 h-7 rounded-full bg-white/10 border border-white/10 text-cyan-400 flex items-center justify-center text-xs">
                <Bot size={13} />
              </div>
              <div className="bg-white/5 border border-white/10 p-3 rounded-2xl rounded-tl-none text-xs text-slate-300 flex items-center gap-2 backdrop-blur-md">
                <Loader2 size={14} className="animate-spin text-cyan-400" />
                <span>Analizando transcripción e imagen de pantalla con Gemini...</span>
              </div>
            </div>
          )}
        </div>

        {/* Image Attachment Bar */}
        {attachedImage && (
          <div className="px-3 py-2 bg-slate-950/80 border-t border-white/10 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <img
                src={attachedImage}
                alt="Captura de pantalla"
                className="w-12 h-8 object-cover rounded border border-cyan-400/40"
              />
              <div className="text-[11px]">
                <div className="text-cyan-300 font-bold">Captura de pantalla adjunta</div>
                <div className="text-[10px] text-slate-400">JPEG Compreso (~800px) • ~258 tokens</div>
              </div>
            </div>

            <button
              onClick={() => setAttachedImage(null)}
              className="p-1 text-slate-400 hover:text-rose-400 transition"
              title="Quitar captura"
            >
              <Trash2 size={16} />
            </button>
          </div>
        )}

        {/* Input footer */}
        <form onSubmit={handleSend} className="p-3 bg-white/5 border-t border-white/10 flex items-center gap-2 backdrop-blur-md">
          {stream && (
            <button
              type="button"
              onClick={handleAttachScreen}
              className={`p-2 rounded-xl text-xs font-semibold border transition backdrop-blur-md ${
                attachedImage
                  ? "bg-cyan-500/20 text-cyan-300 border-cyan-400/40"
                  : "bg-white/5 hover:bg-white/10 text-slate-300 border-white/10"
              }`}
              title="Adjuntar captura de pantalla actual"
            >
              <Camera size={16} />
            </button>
          )}

          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              attachedImage
                ? "Haz tu pregunta sobre la imagen o el audio..."
                : "Escribe tu pregunta sobre el audio o la pantalla..."
            }
            className="flex-1 bg-slate-950/60 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder-slate-400 focus:outline-none focus:border-cyan-400 backdrop-blur-md"
          />

          <button
            type="submit"
            disabled={(!input.trim() && !attachedImage) || isSending}
            className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-slate-950 rounded-xl text-xs font-bold flex items-center gap-1.5 transition active:scale-95 shadow-md shrink-0"
          >
            <Send size={14} />
            <span className="hidden sm:inline">Enviar</span>
          </button>
        </form>
      </div>
    </div>
  );
};

