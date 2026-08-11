import React, { useState } from "react";
import { TranscriptSegment } from "../types";
import { downloadFile, generateSRT } from "../utils/audioUtils";
import { Download, FileText, Code, FileCode, Check, Copy, X } from "lucide-react";

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  segments: TranscriptSegment[];
}

export const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose, segments }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleExportTXT = () => {
    const text = segments.map((s) => `[${s.timestamp}] ${s.text}`).join("\n");
    downloadFile(text, `transcripcion_${Date.now()}.txt`, "text/plain");
  };

  const handleExportMD = () => {
    let md = `# Transcripción de Audio\n*Fecha: ${new Date().toLocaleDateString()}*\n\n`;
    segments.forEach((s) => {
      md += `**[${s.timestamp}]** ${s.text}\n\n`;
      if (s.translatedText) {
        md += `> *Traducción:* ${s.translatedText}\n\n`;
      }
    });
    downloadFile(md, `transcripcion_${Date.now()}.md`, "text/markdown");
  };

  const handleExportSRT = () => {
    const srt = generateSRT(segments);
    downloadFile(srt, `subtitulos_${Date.now()}.srt`, "text/plain");
  };

  const handleExportJSON = () => {
    const json = JSON.stringify(segments, null, 2);
    downloadFile(json, `transcripcion_${Date.now()}.json`, "application/json");
  };

  const handleCopyClipboard = () => {
    const text = segments.map((s) => `[${s.timestamp}] ${s.text}`).join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-150">
      <div className="bg-[#020617]/90 backdrop-blur-2xl border border-white/10 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-xl hover:bg-white/10 transition"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-2.5 mb-5 pb-3 border-b border-white/10">
          <div className="p-2 rounded-xl bg-cyan-400/10 text-cyan-400 border border-cyan-400/20">
            <Download size={20} />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Exportar Transcripción</h3>
            <p className="text-xs text-slate-400">{segments.length} registros listos para descargar</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mb-5">
          <button
            onClick={handleExportTXT}
            className="p-3.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-cyan-400/30 rounded-xl flex flex-col items-center justify-center gap-2 text-slate-200 transition group backdrop-blur-md"
          >
            <FileText size={22} className="text-cyan-400 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-semibold">Texto Plano (.txt)</span>
          </button>

          <button
            onClick={handleExportMD}
            className="p-3.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-cyan-400/30 rounded-xl flex flex-col items-center justify-center gap-2 text-slate-200 transition group backdrop-blur-md"
          >
            <FileCode size={22} className="text-fuchsia-400 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-semibold">Markdown (.md)</span>
          </button>

          <button
            onClick={handleExportSRT}
            className="p-3.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-cyan-400/30 rounded-xl flex flex-col items-center justify-center gap-2 text-slate-200 transition group backdrop-blur-md"
          >
            <FileText size={22} className="text-emerald-400 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-semibold">Subtítulos (.srt)</span>
          </button>

          <button
            onClick={handleExportJSON}
            className="p-3.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-cyan-400/30 rounded-xl flex flex-col items-center justify-center gap-2 text-slate-200 transition group backdrop-blur-md"
          >
            <Code size={22} className="text-amber-400 group-hover:scale-110 transition-transform" />
            <span className="text-xs font-semibold">JSON (.json)</span>
          </button>
        </div>

        <div className="pt-3 border-t border-white/10 flex justify-between items-center">
          <button
            onClick={handleCopyClipboard}
            className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-200 border border-white/10 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition backdrop-blur-md"
          >
            {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            <span>{copied ? "¡Copiado!" : "Copiar a Portapapeles"}</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};
