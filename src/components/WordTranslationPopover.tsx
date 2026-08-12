import { ArrowRight, Languages, Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export type TranslationLanguage = "en" | "es";

export type WordTranslationSelection = {
  word: string;
  sourceLanguage: TranslationLanguage;
  targetLanguage: TranslationLanguage;
  anchor: {
    centerX: number;
    top: number;
    bottom: number;
  };
};

type WordTranslationPopoverProps = {
  selection: WordTranslationSelection | null;
  onClose: () => void;
};

type TranslationState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; translatedText: string }
  | { status: "error"; message: string };

const translationCache = new Map<string, string>();

const languageLabel: Record<TranslationLanguage, string> = {
  en: "Inglés",
  es: "Español",
};

export function WordTranslationPopover({ selection, onClose }: WordTranslationPopoverProps) {
  const [translation, setTranslation] = useState<TranslationState>({ status: "idle" });

  useEffect(() => {
    setTranslation({ status: "idle" });
  }, [selection?.word, selection?.sourceLanguage, selection?.targetLanguage]);

  useEffect(() => {
    if (!selection) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [selection, onClose]);

  if (!selection || typeof document === "undefined") return null;

  const cacheKey = `${selection.sourceLanguage}:${selection.targetLanguage}:${selection.word.toLocaleLowerCase()}`;

  const translateWord = async () => {
    const cached = translationCache.get(cacheKey);
    if (cached) {
      setTranslation({ status: "ready", translatedText: cached });
      return;
    }

    setTranslation({ status: "loading" });
    try {
      const response = await fetch("/api/translate-word", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          word: selection.word,
          sourceLanguage: selection.sourceLanguage,
          targetLanguage: selection.targetLanguage,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.translatedText) {
        throw new Error(payload.error || "No se pudo traducir esta palabra.");
      }

      const translatedText = String(payload.translatedText);
      translationCache.set(cacheKey, translatedText);
      setTranslation({ status: "ready", translatedText });
    } catch (error) {
      setTranslation({
        status: "error",
        message: error instanceof Error ? error.message : "No se pudo traducir esta palabra.",
      });
    }
  };

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const popoverWidth = Math.min(320, viewportWidth - 24);
  const halfWidth = popoverWidth / 2;
  const left = Math.min(viewportWidth - halfWidth - 12, Math.max(halfWidth + 12, selection.anchor.centerX));
  const placeAbove = selection.anchor.bottom + 210 > viewportHeight;
  const top = placeAbove ? selection.anchor.top - 10 : selection.anchor.bottom + 10;

  return createPortal(
    <div className="fixed inset-0 z-[220]" onMouseDown={onClose}>
      <div
        className="fixed rounded-2xl border border-cyan-300/20 bg-slate-950/95 p-3.5 text-left shadow-[0_18px_60px_rgba(2,6,23,0.75),0_0_30px_rgba(34,211,238,0.08)] backdrop-blur-2xl"
        style={{
          width: popoverWidth,
          left,
          top,
          transform: placeAbove ? "translate(-50%, -100%)" : "translateX(-50%)",
        }}
        role="dialog"
        aria-label={`Traducir ${selection.word}`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-lg font-bold text-white">{selection.word}</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
              {languageLabel[selection.sourceLanguage]}
              <ArrowRight size={10} />
              {languageLabel[selection.targetLanguage]}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-500 transition hover:bg-white/10 hover:text-white"
            aria-label="Cerrar traducción"
          >
            <X size={15} />
          </button>
        </div>

        {translation.status === "ready" ? (
          <div className="mt-3 rounded-xl border border-emerald-300/15 bg-emerald-400/[0.08] px-3.5 py-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300/70">Traducción</span>
            <p className="mt-0.5 text-xl font-bold text-emerald-100">{translation.translatedText}</p>
          </div>
        ) : (
          <button
            type="button"
            onClick={translateWord}
            disabled={translation.status === "loading"}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 px-4 py-2.5 text-sm font-bold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-wait disabled:opacity-70"
          >
            {translation.status === "loading" ? <Loader2 size={16} className="animate-spin" /> : <Languages size={16} />}
            {translation.status === "loading" ? "Traduciendo…" : "Traducir"}
          </button>
        )}

        {translation.status === "error" && (
          <p className="mt-2 text-xs leading-relaxed text-rose-300">{translation.message}</p>
        )}
        <p className="mt-2 text-center text-[9px] text-slate-600">Traducción rápida EN ↔ ES</p>
      </div>
    </div>,
    document.body,
  );
}
