import React, { useRef, useEffect, useState } from "react";
import { TranscriptSegment, Settings } from "../types";
import {
  Copy,
  Check,
  Edit2,
  Trash2,
  Languages,
  Search,
  ArrowDown,
  Sparkles,
  Volume2,
  Clock,
  User,
  Share2,
} from "lucide-react";

interface LiveTranscriptStreamProps {
  segments: TranscriptSegment[];
  settings: Settings;
  onUpdateSegment: (id: string, newText: string) => void;
  onDeleteSegment: (id: string) => void;
  onClearAll: () => void;
  isRecording: boolean;
  isProcessingChunk: boolean;
}

export const LiveTranscriptStream: React.FC<LiveTranscriptStreamProps> = ({
  segments,
  settings,
  onUpdateSegment,
  onDeleteSegment,
  onClearAll,
  isRecording,
  isProcessingChunk,
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<string>("");
  const [showTranslatedOnly, setShowTranslatedOnly] = useState<boolean>(false);

  // Auto-scroll to bottom when new segment arrives if autoScroll is enabled
  useEffect(() => {
    if (settings.autoScroll && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [segments, settings.autoScroll, isProcessingChunk]);

  const handleCopySegment = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyAll = () => {
    const fullText = segments.map((s) => `[${s.timestamp}] ${s.text}`).join("\n");
    navigator.clipboard.writeText(fullText);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const handleStartEdit = (seg: TranscriptSegment) => {
    setEditingId(seg.id);
    setEditingText(seg.text);
  };

  const handleSaveEdit = (id: string) => {
    if (editingText.trim()) {
      onUpdateSegment(id, editingText.trim());
    }
    setEditingId(null);
  };

  const filteredSegments = segments.filter(
    (s) =>
      s.text.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.translatedText && s.translatedText.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const getFontSizeClass = () => {
    switch (settings.fontSize) {
      case "sm":
        return "text-xs leading-relaxed";
      case "md":
        return "text-sm leading-relaxed";
      case "lg":
        return "text-base leading-relaxed";
      case "xl":
        return "text-lg leading-relaxed";
      default:
        return "text-sm leading-relaxed";
    }
  };

  return (
    <div className="flex flex-col h-full bg-white/5 border border-white/10 rounded-2xl shadow-2xl backdrop-blur-xl overflow-hidden relative">
      {/* Transcript Toolbar Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-white/5 border-b border-white/10 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-cyan-400/10 text-cyan-400 border border-cyan-400/20">
            <Volume2 size={18} />
          </div>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              Transcripción en Vivo
              {isRecording && (
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400"></span>
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-400">
              {segments.length} fragmentos registrados &bull;{" "}
              {segments.reduce((acc, s) => acc + s.text.split(" ").length, 0)} palabras
            </p>
          </div>
        </div>

        {/* Controls & Search */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Search Box */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar en transcripción..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-slate-950/60 border border-white/10 rounded-xl text-xs text-slate-200 placeholder-slate-400 focus:outline-none focus:border-cyan-400 transition w-36 sm:w-48 backdrop-blur-md"
            />
          </div>

          {/* Toggle Translation View if autoTranslate is enabled */}
          {settings.autoTranslate && (
            <button
              onClick={() => setShowTranslatedOnly(!showTranslatedOnly)}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition border backdrop-blur-md ${
                showTranslatedOnly
                  ? "bg-cyan-500 text-slate-950 border-cyan-400 shadow-md"
                  : "bg-white/5 text-slate-300 border-white/10 hover:bg-white/10"
              }`}
            >
              <Languages size={14} />
              <span>{showTranslatedOnly ? "Solo Traducido" : "Vista Dual"}</span>
            </button>
          )}

          {/* Copy All Button */}
          <button
            onClick={handleCopyAll}
            disabled={segments.length === 0}
            className="px-2.5 py-1.5 bg-white/5 hover:bg-white/10 disabled:opacity-40 text-slate-200 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition border border-white/10 backdrop-blur-md"
            title="Copiar toda la transcripción"
          >
            {copiedAll ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            <span>{copiedAll ? "¡Copiado!" : "Copiar Todo"}</span>
          </button>

          {/* Clear Button */}
          <button
            onClick={onClearAll}
            disabled={segments.length === 0}
            className="px-2.5 py-1.5 bg-rose-500/10 hover:bg-rose-500/20 disabled:opacity-30 text-rose-300 rounded-xl text-xs font-semibold flex items-center gap-1 transition border border-rose-500/20 backdrop-blur-md"
            title="Limpiar transcripción"
          >
            <Trash2 size={14} />
            <span className="hidden sm:inline">Limpiar</span>
          </button>
        </div>
      </div>

      {/* Main Scrolling Transcript Area */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 font-sans relative min-h-[320px] max-h-[600px] scroll-smooth"
      >
        {filteredSegments.length === 0 ? (
          <div className="h-full min-h-[250px] flex flex-col items-center justify-center text-center p-6 border border-white/10 rounded-2xl bg-slate-950/40 backdrop-blur-md">
            <div className="w-12 h-12 rounded-2xl bg-cyan-400/10 border border-cyan-400/20 text-cyan-400 flex items-center justify-center mb-3 shadow-inner">
              <Sparkles size={24} />
            </div>
            <h3 className="text-sm font-semibold text-slate-200">
              {searchQuery ? "Sin resultados de búsqueda" : "Esperando audio..."}
            </h3>
            <p className="text-xs text-slate-400 max-w-sm mt-1 leading-relaxed">
              {searchQuery
                ? `No se encontraron coincidencias para "${searchQuery}".`
                : "Comparte la pestaña de tu navegador (YouTube, clase en vivo, podcast, reunión) para comenzar a ver la transcripción en tiempo real."}
            </p>
          </div>
        ) : (
          filteredSegments.map((seg, idx) => {
            const isLatest = idx === filteredSegments.length - 1;
            return (
              <div
                key={seg.id}
                className={`group relative p-4 rounded-xl transition-all duration-200 border ${
                  seg.isEditing
                    ? "bg-slate-900 border-cyan-400 shadow-lg"
                    : isLatest
                    ? "bg-cyan-400/5 border-cyan-400/30 border-l-4 border-l-cyan-400 shadow-lg"
                    : "bg-white/5 hover:bg-white/10 border-white/10 backdrop-blur-md"
                }`}
              >
                {/* Segment Metadata (Timestamp, Speaker, Language tag) */}
                <div className="flex items-center justify-between gap-2 mb-2 text-xs text-slate-400 font-mono">
                  <div className="flex items-center gap-2">
                    {settings.showTimestamps && (
                      <span className="flex items-center gap-1 bg-slate-950/60 px-2 py-0.5 rounded-lg text-cyan-300 font-bold border border-white/10">
                        <Clock size={11} />
                        {seg.timestamp}
                      </span>
                    )}
                    {settings.showSpeakers && seg.speaker && (
                      <span className="flex items-center gap-1 text-slate-200 bg-white/10 px-2 py-0.5 rounded-lg border border-white/10">
                        <User size={11} />
                        {seg.speaker}
                      </span>
                    )}
                    {seg.language && (
                      <span className="text-[10px] text-cyan-400/80 uppercase tracking-wider font-semibold">
                        [{seg.language}]
                      </span>
                    )}
                  </div>

                  {/* Individual Actions */}
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
                    <button
                      onClick={() => handleCopySegment(seg.id, seg.text)}
                      className="p-1 hover:bg-white/10 text-slate-400 hover:text-slate-100 rounded-lg transition"
                      title="Copiar párrafo"
                    >
                      {copiedId === seg.id ? (
                        <Check size={13} className="text-emerald-400" />
                      ) : (
                        <Copy size={13} />
                      )}
                    </button>
                    <button
                      onClick={() => handleStartEdit(seg)}
                      className="p-1 hover:bg-white/10 text-slate-400 hover:text-cyan-300 rounded-lg transition"
                      title="Editar texto"
                    >
                      <Edit2 size={13} />
                    </button>
                    <button
                      onClick={() => onDeleteSegment(seg.id)}
                      className="p-1 hover:bg-white/10 text-slate-400 hover:text-rose-400 rounded-lg transition"
                      title="Eliminar fragmento"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Segment Content / Editor */}
                {editingId === seg.id ? (
                  <div className="space-y-2 mt-1">
                    <textarea
                      value={editingText}
                      onChange={(e) => setEditingText(e.target.value)}
                      className="w-full bg-slate-950 border border-cyan-400 rounded-xl p-3 text-sm text-slate-100 focus:outline-none resize-y"
                      rows={2}
                      autoFocus
                    />
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => setEditingId(null)}
                        className="px-3 py-1 text-xs text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={() => handleSaveEdit(seg.id)}
                        className="px-3.5 py-1 text-xs font-bold text-slate-950 bg-cyan-400 hover:bg-cyan-300 rounded-lg transition shadow-md"
                      >
                        Guardar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {/* Original Text */}
                    {(!showTranslatedOnly || !seg.translatedText) && (
                      <p className={`text-slate-100 font-medium ${getFontSizeClass()}`}>{seg.text}</p>
                    )}

                    {/* Translated Text if active */}
                    {settings.autoTranslate && seg.translatedText && (
                      <div className="pt-2 border-t border-white/10 mt-2">
                        <p className={`text-cyan-200 italic font-sans ${getFontSizeClass()}`}>
                          <span className="not-italic text-[10px] font-bold text-cyan-300 uppercase mr-1.5 bg-cyan-400/10 px-2 py-0.5 rounded-md border border-cyan-400/20">
                            {settings.targetLanguage}:
                          </span>
                          {seg.translatedText}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}

        {isProcessingChunk && (
          <div className="flex items-center gap-2 px-3 py-1.5 opacity-50">
            <Sparkles size={12} className="animate-spin text-cyan-400" />
            <span className="text-[10px] text-cyan-400 font-semibold tracking-wider uppercase">Procesando...</span>
          </div>
        )}
      </div>

      {/* Floating Auto-Scroll Button */}
      {!settings.autoScroll && segments.length > 5 && (
        <div className="absolute bottom-4 right-6">
          <button
            onClick={() => {
              if (containerRef.current) {
                containerRef.current.scrollTop = containerRef.current.scrollHeight;
              }
            }}
            className="p-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 rounded-full shadow-xl flex items-center gap-1.5 text-xs font-bold transition transform hover:scale-105 active:scale-95"
          >
            <ArrowDown size={14} />
            <span>Ver más reciente</span>
          </button>
        </div>
      )}
    </div>
  );
};
