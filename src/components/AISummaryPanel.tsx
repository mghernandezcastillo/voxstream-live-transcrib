import React, { useState } from "react";
import { AISummary, TranscriptSegment } from "../types";
import {
  Sparkles,
  RefreshCw,
  ListChecks,
  Tag,
  CheckCircle2,
  FileText,
  Copy,
  Check,
  ChevronRight,
} from "lucide-react";

interface AISummaryPanelProps {
  segments: TranscriptSegment[];
  summary: AISummary | null;
  isGenerating: boolean;
  onGenerateSummary: () => void;
}

export const AISummaryPanel: React.FC<AISummaryPanelProps> = ({
  segments,
  summary,
  isGenerating,
  onGenerateSummary,
}) => {
  const [copied, setCopied] = useState(false);

  const handleCopySummary = () => {
    if (!summary) return;
    const text = `RESUMEN EJECUTIVO:\n${summary.summary}\n\nPUNTOS CLAVE:\n${summary.keyPoints
      .map((k) => `• ${k}`)
      .join("\n")}\n\nTEMAS:\n${summary.topics.join(", ")}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 shadow-2xl flex flex-col h-full">
      {/* Panel Header */}
      <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 to-cyan-400 p-0.5 shadow-md flex items-center justify-center">
            <div className="w-full h-full bg-[#020617]/80 rounded-[10px] flex items-center justify-center text-cyan-400">
              <Sparkles size={18} />
            </div>
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
              Resumen Inteligente
            </h3>
            <p className="text-xs text-slate-400">Puntos clave en tiempo real con Gemini</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {summary && (
            <button
              onClick={handleCopySummary}
              className="p-1.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded-xl text-xs transition border border-white/10 backdrop-blur-md"
              title="Copiar resumen completo"
            >
              {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            </button>
          )}

          <button
            onClick={onGenerateSummary}
            disabled={segments.length === 0 || isGenerating}
            className="px-3 py-1.5 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-slate-950 rounded-xl text-xs font-bold flex items-center gap-1.5 transition shadow-lg shadow-cyan-500/20 active:scale-95"
          >
            <RefreshCw size={13} className={isGenerating ? "animate-spin" : ""} />
            <span>{isGenerating ? "Generando..." : summary ? "Actualizar" : "Generar Resumen"}</span>
          </button>
        </div>
      </div>

      {/* Summary Content Body */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {!summary && !isGenerating && (
          <div className="h-full min-h-[180px] flex flex-col items-center justify-center text-center p-4 border border-white/10 rounded-2xl bg-slate-950/40 backdrop-blur-md">
            <FileText size={28} className="text-slate-500 mb-2" />
            <p className="text-xs text-slate-400 max-w-xs">
              Haz clic en <strong>Generar Resumen</strong> para extraer los conceptos principales, conclusiones y temas del audio transmitido.
            </p>
          </div>
        )}

        {isGenerating && (
          <div className="space-y-3 p-2">
            <div className="h-4 bg-white/10 rounded-lg animate-pulse w-3/4" />
            <div className="h-4 bg-white/10 rounded-lg animate-pulse w-full" />
            <div className="h-4 bg-white/10 rounded-lg animate-pulse w-5/6" />
            <div className="pt-3 space-y-2">
              <div className="h-3 bg-white/5 rounded-lg animate-pulse w-1/2" />
              <div className="h-3 bg-white/5 rounded-lg animate-pulse w-2/3" />
            </div>
          </div>
        )}

        {summary && !isGenerating && (
          <div className="space-y-4 text-xs">
            {/* Executive Summary Box */}
            <div className="bg-cyan-400/10 border border-cyan-400/20 rounded-xl p-3.5 backdrop-blur-md">
              <h4 className="font-bold text-cyan-300 mb-1.5 flex items-center gap-1.5">
                <FileText size={14} />
                <span>Resumen Ejecutivo</span>
              </h4>
              <p className="text-slate-200 leading-relaxed font-sans">{summary.summary}</p>
            </div>

            {/* Key Points */}
            {summary.keyPoints && summary.keyPoints.length > 0 && (
              <div>
                <h4 className="font-bold text-slate-200 mb-2 flex items-center gap-1.5">
                  <ListChecks size={14} className="text-cyan-400" />
                  <span>Puntos Clave ({summary.keyPoints.length})</span>
                </h4>
                <ul className="space-y-2">
                  {summary.keyPoints.map((point, idx) => (
                    <li
                      key={idx}
                      className="bg-white/5 border border-white/10 rounded-xl p-2.5 flex items-start gap-2 text-slate-200 backdrop-blur-md"
                    >
                      <ChevronRight size={13} className="text-cyan-400 mt-0.5 shrink-0" />
                      <span className="leading-normal">{point}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Topics Tags */}
            {summary.topics && summary.topics.length > 0 && (
              <div>
                <h4 className="font-bold text-slate-200 mb-2 flex items-center gap-1.5">
                  <Tag size={14} className="text-fuchsia-400" />
                  <span>Temas Detectados</span>
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {summary.topics.map((topic, idx) => (
                    <span
                      key={idx}
                      className="bg-white/10 text-cyan-200 border border-white/10 px-2.5 py-1 rounded-lg text-[11px] font-semibold backdrop-blur-md"
                    >
                      #{topic}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Action Items */}
            {summary.actionItems && summary.actionItems.length > 0 && (
              <div>
                <h4 className="font-bold text-slate-200 mb-2 flex items-center gap-1.5">
                  <CheckCircle2 size={14} className="text-emerald-400" />
                  <span>Conclusiones & Acciones</span>
                </h4>
                <ul className="space-y-1.5">
                  {summary.actionItems.map((item, idx) => (
                    <li
                      key={idx}
                      className="text-slate-200 bg-white/5 p-2 rounded-xl border border-white/10 flex items-center gap-2 backdrop-blur-md"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
