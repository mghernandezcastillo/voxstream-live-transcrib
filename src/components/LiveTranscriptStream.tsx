import React, { useEffect, useRef, useState } from "react";
import { TranscriptSegment, Settings } from "../types";
import {
  ArrowDown,
  Check,
  Clock,
  Copy,
  Edit2,
  History,
  Languages,
  Radio,
  Search,
  Sparkles,
  Trash2,
  User,
  Volume2,
} from "lucide-react";

interface LiveTranscriptStreamProps {
  segments: TranscriptSegment[];
  settings: Settings;
  onUpdateSegment: (id: string, newText: string) => void;
  onDeleteSegment: (id: string) => void;
  onClearAll: () => void;
  isRecording: boolean;
  isProcessingChunk: boolean;
  latencyMs?: number | null;
}

export const LiveTranscriptStream: React.FC<LiveTranscriptStreamProps> = ({
  segments,
  settings,
  onUpdateSegment,
  onDeleteSegment,
  onClearAll,
  isRecording,
  isProcessingChunk,
  latencyMs,
}) => {
  const historyRef = useRef<HTMLDivElement | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [showTranslatedOnly, setShowTranslatedOnly] = useState(false);
  const [isFollowingLive, setIsFollowingLive] = useState(true);

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredSegments = segments.filter(
    (segment) =>
      !normalizedSearch ||
      segment.text.toLowerCase().includes(normalizedSearch) ||
      segment.translatedText?.toLowerCase().includes(normalizedSearch),
  );
  const activeSegment = isRecording ? segments.at(-1) : undefined;
  const historySegments = filteredSegments.filter(
    (segment) => !activeSegment || segment.id !== activeSegment.id,
  );

  useEffect(() => {
    const history = historyRef.current;
    if (!history) return;

    if (settings.autoScroll && isFollowingLive) {
      history.scrollTop = history.scrollHeight;
      return;
    }

    const distanceFromEnd = history.scrollHeight - history.scrollTop - history.clientHeight;
    setIsFollowingLive(distanceFromEnd <= 72);
  }, [historySegments.length, isRecording, searchQuery, settings.autoScroll]);

  const handleHistoryScroll = () => {
    const history = historyRef.current;
    if (!history) return;
    const distanceFromEnd = history.scrollHeight - history.scrollTop - history.clientHeight;
    setIsFollowingLive(distanceFromEnd <= 72);
  };

  const scrollToLatest = () => {
    const history = historyRef.current;
    if (!history) return;
    history.scrollTo({ top: history.scrollHeight, behavior: "smooth" });
    setIsFollowingLive(true);
  };

  const handleCopySegment = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyAll = () => {
    const fullText = segments.map((segment) => `[${segment.timestamp}] ${segment.text}`).join("\n");
    navigator.clipboard.writeText(fullText);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const handleStartEdit = (segment: TranscriptSegment) => {
    setEditingId(segment.id);
    setEditingText(segment.text);
  };

  const handleSaveEdit = (id: string) => {
    if (editingText.trim()) onUpdateSegment(id, editingText.trim());
    setEditingId(null);
  };

  const getHistoryFontSizeClass = () => {
    switch (settings.fontSize) {
      case "sm":
        return "text-sm leading-relaxed";
      case "lg":
        return "text-lg leading-relaxed";
      case "xl":
        return "text-xl leading-relaxed";
      default:
        return "text-base leading-relaxed";
    }
  };

  const getLiveFontSizeClass = () => {
    switch (settings.fontSize) {
      case "sm":
        return "text-xl sm:text-2xl";
      case "lg":
        return "text-3xl sm:text-4xl";
      case "xl":
        return "text-4xl sm:text-5xl";
      default:
        return "text-2xl sm:text-3xl lg:text-4xl";
    }
  };

  const numericLatency = Number.isFinite(latencyMs) ? Math.max(0, Number(latencyMs)) : null;
  const latencySeconds = numericLatency === null ? null : numericLatency / 1000;
  const latencyTone = latencySeconds === null || latencySeconds < 2
    ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
    : latencySeconds < 5
      ? "border-amber-400/30 bg-amber-400/10 text-amber-300"
      : "border-orange-400/40 bg-orange-400/10 text-orange-300";

  const renderSegmentText = (segment: TranscriptSegment, live = false) => {
    const fontClass = live ? getLiveFontSizeClass() : getHistoryFontSizeClass();
    return (
      <div className={live ? "space-y-3" : "space-y-2"}>
        {(!showTranslatedOnly || !segment.translatedText) && (
          <p
            className={`${fontClass} font-semibold tracking-[-0.015em] text-slate-50 ${
              live ? "leading-[1.22] text-balance" : ""
            }`}
          >
            {segment.text}
          </p>
        )}

        {settings.autoTranslate && segment.translatedText && (
          <div className={live ? "pt-3 border-t border-white/10" : "pt-2 border-t border-white/10"}>
            <p className={`${live ? "text-lg sm:text-xl" : fontClass} text-cyan-200 italic`}>
              <span className="not-italic text-[10px] font-bold text-cyan-300 uppercase mr-2 bg-cyan-400/10 px-2 py-0.5 rounded-md border border-cyan-400/20">
                {settings.targetLanguage}
              </span>
              {segment.translatedText}
            </p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-[720px] min-h-[560px] max-h-[calc(100vh-7rem)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-2xl backdrop-blur-xl">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 bg-white/5 p-4 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 p-2 text-cyan-400">
            <Volume2 size={18} />
          </div>
          <div>
            <h2 className="flex items-center gap-2 text-base font-bold text-white">
              Transcripción en Vivo
              {isRecording && (
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-cyan-400" />
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-400">
              {segments.length} fragmentos · {segments.reduce((total, segment) => total + segment.text.split(" ").length, 0)} palabras
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar..."
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="w-32 rounded-xl border border-white/10 bg-slate-950/60 py-1.5 pl-8 pr-3 text-xs text-slate-200 placeholder-slate-400 transition focus:border-cyan-400 focus:outline-none sm:w-44"
            />
          </div>

          {settings.autoTranslate && (
            <button
              onClick={() => setShowTranslatedOnly((current) => !current)}
              className={`flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs font-semibold transition ${
                showTranslatedOnly
                  ? "border-cyan-400 bg-cyan-500 text-slate-950 shadow-md"
                  : "border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
              }`}
            >
              <Languages size={14} />
              <span>{showTranslatedOnly ? "Traducido" : "Vista dual"}</span>
            </button>
          )}

          <button
            onClick={handleCopyAll}
            disabled={segments.length === 0}
            className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-white/10 disabled:opacity-40"
            title="Copiar toda la transcripción"
          >
            {copiedAll ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            <span className="hidden sm:inline">{copiedAll ? "Copiado" : "Copiar todo"}</span>
          </button>

          <button
            onClick={onClearAll}
            disabled={segments.length === 0}
            className="flex items-center gap-1 rounded-xl border border-rose-500/20 bg-rose-500/10 px-2.5 py-1.5 text-xs font-semibold text-rose-300 transition hover:bg-rose-500/20 disabled:opacity-30"
            title="Limpiar transcripción"
          >
            <Trash2 size={14} />
            <span className="hidden sm:inline">Limpiar</span>
          </button>
        </div>
      </div>

      <section
        className={`relative flex shrink-0 flex-col items-center justify-center overflow-hidden border-b border-white/10 bg-gradient-to-br from-cyan-400/[0.08] via-slate-950/40 to-indigo-500/[0.08] px-5 text-center transition-all duration-300 sm:px-10 ${
          isRecording ? "min-h-[230px] basis-[40%] py-6" : "min-h-[104px] basis-[16%] py-4"
        }`}
        aria-live="polite"
        aria-atomic="true"
      >
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent" />

        {isRecording ? (
          <>
            <div className="mb-4 flex flex-wrap items-center justify-center gap-2">
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${latencyTone}`}>
                <Radio size={12} className="animate-pulse" />
                {latencySeconds === null ? "En vivo" : `En vivo · atraso ${latencySeconds.toFixed(1)} s`}
              </span>
              {activeSegment?.language && (
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-300">
                  {activeSegment.language}
                </span>
              )}
              {isProcessingChunk && (
                <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-cyan-300/80">
                  <Sparkles size={11} className="animate-spin" />
                  Escuchando
                </span>
              )}
            </div>

            <div className="max-h-[170px] w-full max-w-4xl overflow-y-auto px-1 py-1 [scrollbar-width:thin] sm:max-h-[220px]">
              {activeSegment ? (
                renderSegmentText(activeSegment, true)
              ) : (
                <div className="space-y-2">
                  <p className={`${getLiveFontSizeClass()} font-semibold text-slate-200`}>Escuchando el audio…</p>
                  <p className="text-sm text-slate-400">La primera frase aparecerá aquí y permanecerá centrada.</p>
                </div>
              )}
            </div>

            {activeSegment && settings.showTimestamps && (
              <span className="mt-4 inline-flex items-center gap-1 font-mono text-[10px] text-slate-500">
                <Clock size={11} />
                {activeSegment.timestamp}
              </span>
            )}
          </>
        ) : segments.length > 0 ? (
          <div className="flex items-center gap-3 text-left">
            <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-2 text-emerald-300">
              <Check size={18} />
            </div>
            <div>
              <p className="font-semibold text-slate-100">Transcripción lista para revisar</p>
              <p className="text-xs text-slate-400">Todo el contenido permanece disponible en el historial.</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 text-left">
            <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 p-2 text-cyan-400">
              <Sparkles size={18} />
            </div>
            <div>
              <p className="font-semibold text-slate-200">Esperando audio…</p>
              <p className="text-xs text-slate-400">Usa el micrófono o comparte una pestaña con audio.</p>
            </div>
          </div>
        )}
      </section>

      <div className="flex min-h-0 flex-1 flex-col bg-slate-950/25">
        <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-2.5 sm:px-6">
          <div className="flex items-center gap-2">
            <History size={14} className="text-cyan-400" />
            <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-slate-300">Historial completo</h3>
            <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-slate-500">
              {historySegments.length}
            </span>
          </div>
          {isRecording && activeSegment && (
            <span className="text-[10px] text-slate-500">La frase activa se añadirá al finalizar</span>
          )}
        </div>

        <div className="relative min-h-0 flex-1">
          <div
            ref={historyRef}
            onScroll={handleHistoryScroll}
            className="absolute inset-0 space-y-1 overflow-y-auto scroll-smooth px-3 py-3 sm:px-5 sm:py-4"
          >
            {historySegments.length === 0 ? (
              <div className="flex min-h-full items-center justify-center p-6 text-center">
                <div>
                  <History size={24} className="mx-auto mb-2 text-slate-600" />
                  <p className="text-sm font-medium text-slate-400">
                    {searchQuery
                      ? `No hay resultados para “${searchQuery}”.`
                      : isRecording
                        ? "Las frases terminadas aparecerán aquí."
                        : "Todavía no hay contenido transcrito."}
                  </p>
                </div>
              </div>
            ) : (
              historySegments.map((segment, index) => {
                const isLatest = index === historySegments.length - 1;
                return (
                  <article
                    key={segment.id}
                    className={`group relative grid grid-cols-[auto_1fr] gap-3 rounded-xl border px-3 py-3 transition sm:gap-4 sm:px-4 ${
                      isLatest && isRecording
                        ? "border-cyan-400/20 bg-cyan-400/[0.06]"
                        : "border-transparent hover:border-white/10 hover:bg-white/[0.04]"
                    }`}
                  >
                    <div className="w-11 pt-0.5 text-right sm:w-14">
                      {settings.showTimestamps ? (
                        <span className="font-mono text-[10px] font-semibold text-cyan-400/70">
                          {segment.timestamp}
                        </span>
                      ) : (
                        <span className="font-mono text-[10px] text-slate-600">{index + 1}</span>
                      )}
                    </div>

                    <div className="min-w-0 pr-1">
                      <div className="mb-1.5 flex min-h-5 items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          {settings.showSpeakers && segment.speaker && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-300">
                              <User size={10} />
                              {segment.speaker}
                            </span>
                          )}
                          {segment.language && (
                            <span className="text-[9px] font-semibold uppercase tracking-wider text-slate-500">
                              {segment.language}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-0.5 opacity-60 transition group-hover:opacity-100">
                          <button
                            onClick={() => handleCopySegment(segment.id, segment.text)}
                            className="rounded-lg p-1 text-slate-500 transition hover:bg-white/10 hover:text-slate-100"
                            title="Copiar frase"
                          >
                            {copiedId === segment.id ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                          </button>
                          <button
                            onClick={() => handleStartEdit(segment)}
                            className="rounded-lg p-1 text-slate-500 transition hover:bg-white/10 hover:text-cyan-300"
                            title="Editar frase"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => onDeleteSegment(segment.id)}
                            className="rounded-lg p-1 text-slate-500 transition hover:bg-white/10 hover:text-rose-400"
                            title="Eliminar frase"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>

                      {editingId === segment.id ? (
                        <div className="space-y-2">
                          <textarea
                            value={editingText}
                            onChange={(event) => setEditingText(event.target.value)}
                            className="w-full resize-y rounded-xl border border-cyan-400 bg-slate-950 p-3 text-sm text-slate-100 focus:outline-none"
                            rows={2}
                            autoFocus
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => setEditingId(null)}
                              className="rounded-lg px-3 py-1 text-xs text-slate-400 transition hover:bg-white/10 hover:text-white"
                            >
                              Cancelar
                            </button>
                            <button
                              onClick={() => handleSaveEdit(segment.id)}
                              className="rounded-lg bg-cyan-400 px-3.5 py-1 text-xs font-bold text-slate-950 transition hover:bg-cyan-300"
                            >
                              Guardar
                            </button>
                          </div>
                        </div>
                      ) : (
                        renderSegmentText(segment)
                      )}
                    </div>
                  </article>
                );
              })
            )}
          </div>

          {!isFollowingLive && historySegments.length > 0 && (
            <button
              onClick={scrollToLatest}
              className="absolute bottom-4 right-4 flex items-center gap-1.5 rounded-full bg-cyan-500 px-3.5 py-2 text-xs font-bold text-slate-950 shadow-xl shadow-cyan-500/20 transition hover:scale-105 hover:bg-cyan-400 active:scale-95"
            >
              <ArrowDown size={14} />
              Volver al directo
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
