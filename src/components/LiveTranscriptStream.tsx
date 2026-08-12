import React, { useEffect, useRef, useState } from "react";
import { TranscriptSegment, Settings } from "../types";
import {
  WordTranslationPopover,
  type TranslationLanguage,
  type WordTranslationSelection,
} from "./WordTranslationPopover";
import {
  AlertTriangle,
  ArrowDown,
  BookOpen,
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
  X,
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
  const repeatTextRef = useRef<HTMLDivElement | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedAll, setCopiedAll] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState("");
  const [showTranslatedOnly, setShowTranslatedOnly] = useState(false);
  const [isFollowingLive, setIsFollowingLive] = useState(true);
  const [showDetailedHistory, setShowDetailedHistory] = useState(false);
  const [showClearConfirmation, setShowClearConfirmation] = useState(false);
  const [wordTranslation, setWordTranslation] = useState<WordTranslationSelection | null>(null);

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredSegments = segments.filter(
    (segment) =>
      !normalizedSearch ||
      segment.text.toLowerCase().includes(normalizedSearch) ||
      segment.translatedText?.toLowerCase().includes(normalizedSearch),
  );
  const activeSegment = isRecording ? segments.at(-1) : undefined;

  useEffect(() => {
    const repeatText = repeatTextRef.current;
    if (!repeatText) return;

    if (settings.autoScroll && isFollowingLive) {
      repeatText.scrollTop = repeatText.scrollHeight;
      return;
    }

    const distanceFromEnd = repeatText.scrollHeight - repeatText.scrollTop - repeatText.clientHeight;
    setIsFollowingLive(distanceFromEnd <= 72);
  }, [segments, isRecording, settings.autoScroll]);

  useEffect(() => {
    if (!showDetailedHistory) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowDetailedHistory(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [showDetailedHistory]);

  const handleRepeatTextScroll = () => {
    const repeatText = repeatTextRef.current;
    if (!repeatText) return;
    const distanceFromEnd = repeatText.scrollHeight - repeatText.scrollTop - repeatText.clientHeight;
    setIsFollowingLive(distanceFromEnd <= 72);
  };

  const scrollToLatest = () => {
    const repeatText = repeatTextRef.current;
    if (!repeatText) return;
    repeatText.scrollTo({ top: repeatText.scrollHeight, behavior: "smooth" });
    setIsFollowingLive(true);
  };

  const handleCopySegment = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyAll = () => {
    const fullText = segments.map((segment) => segment.text).join(" ");
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

  const getTextLanguage = (segment: TranscriptSegment, translated = false): TranslationLanguage => {
    if (translated) {
      return settings.targetLanguage.toLocaleLowerCase().includes("ingl") ? "en" : "es";
    }

    const segmentLanguage = String(segment.language || "").toLocaleLowerCase();
    if (segmentLanguage.includes("españ") || segmentLanguage.includes("spanish")) return "es";
    if (segmentLanguage.includes("ingl") || segmentLanguage.includes("english")) return "en";
    return settings.inputLanguage === "spanish" ? "es" : "en";
  };

  const openWordTranslation = (
    event: React.MouseEvent<HTMLButtonElement>,
    word: string,
    sourceLanguage: TranslationLanguage,
  ) => {
    event.stopPropagation();
    const bounds = event.currentTarget.getBoundingClientRect();
    setWordTranslation({
      word,
      sourceLanguage,
      targetLanguage: sourceLanguage === "en" ? "es" : "en",
      anchor: {
        centerX: bounds.left + bounds.width / 2,
        top: bounds.top,
        bottom: bounds.bottom,
      },
    });
  };

  const renderInteractiveText = (text: string, sourceLanguage: TranslationLanguage) => {
    const tokens = text.split(/(\p{L}+(?:['’\-]\p{L}+)*)/gu);
    return tokens.map((token, index) => {
      if (!/^[\p{L}]+(?:['’\-][\p{L}]+)*$/u.test(token)) {
        return <React.Fragment key={`${index}-${token}`}>{token}</React.Fragment>;
      }

      return (
        <button
          key={`${index}-${token}`}
          type="button"
          onClick={(event) => openWordTranslation(event, token, sourceLanguage)}
          className="inline rounded-[0.2em] px-[0.04em] align-baseline [font:inherit] [line-height:inherit] text-inherit transition hover:bg-cyan-300/15 hover:text-cyan-200 focus-visible:bg-cyan-300/15 focus-visible:text-cyan-200 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-300/60"
          title={`Traducir “${token}”`}
        >
          {token}
        </button>
      );
    });
  };

  const clearRepeatText = () => {
    setWordTranslation(null);
    onClearAll();
  };

  const confirmClearTranscript = () => {
    setShowClearConfirmation(false);
    setShowDetailedHistory(false);
    clearRepeatText();
  };

  const getDetailedHistoryFontSizeClass = () => {
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

  const getRepeatFontSizeClass = () => {
    switch (settings.fontSize) {
      case "sm":
        return "text-xl sm:text-2xl";
      case "lg":
        return "text-3xl sm:text-4xl";
      case "xl":
        return "text-4xl sm:text-5xl";
      default:
        return "text-2xl sm:text-3xl lg:text-[2rem]";
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
    const fontClass = live ? getLiveFontSizeClass() : getDetailedHistoryFontSizeClass();
    return (
      <div className={live ? "space-y-3" : "space-y-2"}>
        {(!showTranslatedOnly || !segment.translatedText) && (
          <p
            className={`${fontClass} font-semibold tracking-[-0.015em] text-slate-50 ${
              live ? "leading-[1.22] text-balance" : ""
            }`}
          >
            {renderInteractiveText(segment.text, getTextLanguage(segment))}
          </p>
        )}

        {settings.autoTranslate && segment.translatedText && (
          <div className={live ? "pt-3 border-t border-white/10" : "pt-2 border-t border-white/10"}>
            <p className={`${live ? "text-lg sm:text-xl" : fontClass} text-cyan-200 italic`}>
              <span className="not-italic text-[10px] font-bold text-cyan-300 uppercase mr-2 bg-cyan-400/10 px-2 py-0.5 rounded-md border border-cyan-400/20">
                {settings.targetLanguage}
              </span>
              {renderInteractiveText(segment.translatedText, getTextLanguage(segment, true))}
            </p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="relative flex h-[720px] min-h-[560px] max-h-[calc(100vh-7rem)] flex-col overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-2xl backdrop-blur-xl">
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
          <button
            onClick={() => setShowDetailedHistory(true)}
            className="flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-cyan-400/30 hover:bg-white/10"
            title="Abrir historial detallado"
          >
            <History size={14} className="text-cyan-400" />
            <span>Historial</span>
          </button>

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
            onClick={() => setShowClearConfirmation(true)}
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
              <p className="text-xs text-slate-400">El texto completo está listo para leer y repetir.</p>
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
            <BookOpen size={14} className="text-cyan-400" />
            <h3 className="text-xs font-bold uppercase tracking-[0.12em] text-slate-300">Texto para repetir</h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-[10px] text-slate-500 sm:inline">
              {segments.length > 0 ? `${segments.length} frases unidas` : "Se formará mientras escuchas"}
            </span>
            <button
              type="button"
              onClick={clearRepeatText}
              disabled={segments.length === 0}
              className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-[10px] font-semibold text-slate-400 transition hover:border-rose-400/30 hover:bg-rose-400/10 hover:text-rose-300 disabled:opacity-30"
              title="Limpiar texto para repetir sin confirmación"
            >
              <Trash2 size={11} />
              Limpiar
            </button>
          </div>
        </div>

        <div className="relative min-h-0 flex-1">
          <div
            ref={repeatTextRef}
            onScroll={handleRepeatTextScroll}
            className="absolute inset-0 overflow-y-auto scroll-smooth px-5 py-6 sm:px-10 sm:py-8"
          >
            {segments.length === 0 ? (
              <div className="flex min-h-full items-center justify-center text-center">
                <div className="max-w-md">
                  <BookOpen size={26} className="mx-auto mb-3 text-slate-600" />
                  <p className="text-base font-medium text-slate-400">
                    Aquí aparecerá todo el audio como un solo texto fácil de leer y repetir.
                  </p>
                </div>
              </div>
            ) : (
              <div className="mx-auto flex min-h-full max-w-4xl items-center justify-center">
                <p className={`text-center font-semibold leading-[1.55] tracking-[-0.01em] text-slate-100 ${getRepeatFontSizeClass()}`}>
                  {segments.map((segment, index) => {
                    const displayedText = showTranslatedOnly && segment.translatedText
                      ? segment.translatedText
                      : segment.text;
                    const isNewest = index === segments.length - 1;
                    return (
                      <React.Fragment key={segment.id}>
                        <span
                          className={`transition-colors duration-500 ${
                            isNewest && isRecording ? "text-cyan-300" : "text-slate-100"
                          }`}
                        >
                          {renderInteractiveText(
                            displayedText,
                            getTextLanguage(segment, Boolean(showTranslatedOnly && segment.translatedText)),
                          )}
                        </span>
                        {index < segments.length - 1 ? " " : ""}
                      </React.Fragment>
                    );
                  })}
                </p>
              </div>
            )}
          </div>

          {!isFollowingLive && segments.length > 0 && (
            <button
              onClick={scrollToLatest}
              className="absolute bottom-4 right-4 flex items-center gap-1.5 rounded-full bg-cyan-500 px-3.5 py-2 text-xs font-bold text-slate-950 shadow-xl shadow-cyan-500/20 transition hover:scale-105 hover:bg-cyan-400 active:scale-95"
            >
              <ArrowDown size={14} />
              Ver texto más reciente
            </button>
          )}
        </div>
      </div>

      {showDetailedHistory && (
        <div
          className="absolute inset-0 z-50 flex flex-col bg-slate-950/98 backdrop-blur-xl"
          role="dialog"
          aria-modal="true"
          aria-label="Historial completo de la transcripción"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 p-4 sm:px-6">
            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-cyan-400/20 bg-cyan-400/10 p-2 text-cyan-400">
                <History size={18} />
              </div>
              <div>
                <h3 className="font-bold text-white">Historial completo</h3>
                <p className="text-xs text-slate-400">Fragmentos, horas y herramientas de revisión</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar en el historial..."
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="w-44 rounded-xl border border-white/10 bg-slate-900 py-1.5 pl-8 pr-3 text-xs text-slate-200 placeholder-slate-500 transition focus:border-cyan-400 focus:outline-none sm:w-56"
                  autoFocus
                />
              </div>
              <button
                onClick={() => setShowDetailedHistory(false)}
                className="rounded-xl border border-white/10 bg-white/5 p-2 text-slate-300 transition hover:bg-white/10 hover:text-white"
                title="Cerrar historial"
              >
                <X size={17} />
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-4 sm:px-6">
            {filteredSegments.length === 0 ? (
              <div className="flex min-h-full items-center justify-center p-6 text-center">
                <div>
                  <History size={28} className="mx-auto mb-3 text-slate-600" />
                  <p className="text-sm font-medium text-slate-400">
                    {searchQuery ? `No hay resultados para “${searchQuery}”.` : "Todavía no hay contenido transcrito."}
                  </p>
                </div>
              </div>
            ) : (
              filteredSegments.map((segment, index) => (
                <article
                  key={segment.id}
                  className="group relative grid grid-cols-[auto_1fr] gap-3 rounded-xl border border-transparent px-3 py-3 transition hover:border-white/10 hover:bg-white/[0.04] sm:gap-4 sm:px-4"
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
                        {segment.isPartial && (
                          <span className="text-[9px] font-bold uppercase tracking-wider text-cyan-300">En vivo</span>
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
              ))
            )}
          </div>
        </div>
      )}

      {showClearConfirmation && (
        <div
          className="absolute inset-0 z-[80] flex items-center justify-center bg-slate-950/85 p-5 backdrop-blur-md"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="clear-transcript-title"
          onMouseDown={() => setShowClearConfirmation(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl border border-rose-400/20 bg-slate-950 p-5 shadow-2xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="rounded-xl border border-rose-400/20 bg-rose-400/10 p-2.5 text-rose-300">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 id="clear-transcript-title" className="font-bold text-white">¿Limpiar la transcripción?</h3>
                <p className="mt-1 text-sm leading-relaxed text-slate-400">
                  Se borrarán la transcripción en vivo y el texto acumulado para repetir.
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowClearConfirmation(false)}
                className="rounded-xl border border-white/10 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:bg-white/10"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmClearTranscript}
                className="flex items-center gap-1.5 rounded-xl bg-rose-500 px-4 py-2 text-sm font-bold text-white transition hover:bg-rose-400"
              >
                <Trash2 size={14} />
                Limpiar todo
              </button>
            </div>
          </div>
        </div>
      )}

      <WordTranslationPopover
        selection={wordTranslation}
        onClose={() => setWordTranslation(null)}
      />
    </div>
  );
};
