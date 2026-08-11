import React from "react";
import { Settings } from "../types";
import { Settings as SettingsIcon, X, Sliders, Type, Languages, Clock, Eye } from "lucide-react";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: Settings;
  onUpdateSettings: (newSettings: Partial<Settings>) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
}) => {
  if (!isOpen) return null;

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
            <SettingsIcon size={20} />
          </div>
          <div>
            <h3 className="text-base font-bold text-white">Configuración de Transcripción</h3>
            <p className="text-xs text-slate-400">Ajusta parámetros de procesamiento e interfaz</p>
          </div>
        </div>

        <div className="space-y-4 text-xs font-sans">
          {/* AI Engine Selection */}
          <div>
            <label className="block text-slate-200 font-semibold mb-1 flex items-center gap-1.5">
              <Sliders size={14} className="text-cyan-400" />
              <span>Motor de Inteligencia Artificial</span>
            </label>
            <select
              value={settings.aiEngine}
              onChange={(e) => onUpdateSettings({ aiEngine: e.target.value as Settings["aiEngine"] })}
              className="w-full bg-slate-950/60 border border-white/10 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-400 backdrop-blur-md"
            >
              <option value="local">Local (Whisper) - Recomendado, sin API key</option>
              <option value="cloud">Cloud (Gemini) - Solo si el usuario lo elige</option>
            </select>
            {settings.aiEngine === "cloud" && (
              <p className="text-[10px] text-emerald-400 mt-1.5 ml-1">
                Gemini requiere una API key del servidor y solo se usará mientras este modo esté seleccionado.
              </p>
            )}
          </div>

          {/* Chunk interval */}
          <div>
            <label className="block text-slate-200 font-semibold mb-1 flex items-center gap-1.5">
              <Clock size={14} className="text-cyan-400" />
              <span>Intervalo de Envío / Buffer</span>
            </label>
            <select
              value={settings.chunkDurationSec}
              onChange={(e) => onUpdateSettings({ chunkDurationSec: Number(e.target.value) })}
              className="w-full bg-slate-950/60 border border-white/10 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-400 backdrop-blur-md"
            >
              <option value={1.2}>1.2s (Rápido - Solo para PC Gamer/M1)</option>
              <option value={2.0}>2.0s (Equilibrado)</option>
              <option value={3.0}>3.0s (Estable - Recomendado para portátiles)</option>
              <option value={5.0}>5.0s (Lento - Para PCs de bajos recursos)</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-200 font-semibold mb-1 flex items-center gap-1.5">
              <Languages size={14} className="text-cyan-400" />
              <span>Idioma hablado (Optimización de latencia)</span>
            </label>
            <select
              value={settings.inputLanguage}
              onChange={(e) =>
                onUpdateSettings({
                  inputLanguage: e.target.value as Settings["inputLanguage"],
                })
              }
              className="w-full bg-slate-950/60 border border-white/10 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-400 backdrop-blur-md"
            >
              <option value="auto">Automático (Más lento - Detectar idioma)</option>
              <option value="english">Inglés Fijo (Más rápido y óptimo)</option>
              <option value="spanish">Español Fijo (Más rápido y óptimo)</option>
            </select>
            <p className="text-[10px] text-emerald-400 mt-1.5 ml-1">
              Fijar el idioma evita que la IA procese la detección, acelerando significativamente la respuesta.
            </p>
          </div>

          {/* Auto Translate Settings */}
          <div className="p-3.5 bg-white/5 border border-white/10 rounded-xl space-y-3 backdrop-blur-md">
            <div className="flex items-center justify-between">
              <span className="text-slate-200 font-semibold flex items-center gap-1.5">
                <Languages size={14} className="text-cyan-400" />
                <span>Traducción en Tiempo Real</span>
              </span>
              <input
                type="checkbox"
                checked={settings.autoTranslate}
                onChange={(e) => onUpdateSettings({ autoTranslate: e.target.checked })}
                className="w-4 h-4 rounded bg-slate-900 border-white/20 text-cyan-500 focus:ring-cyan-400"
              />
            </div>

            {settings.autoTranslate && (
              <div>
                <label className="block text-slate-400 text-[11px] mb-1">Idioma de Destino:</label>
                <select
                  value={settings.targetLanguage}
                  onChange={(e) => onUpdateSettings({ targetLanguage: e.target.value })}
                  className="w-full bg-slate-950/60 border border-white/10 rounded-lg px-2.5 py-1.5 text-slate-200 focus:outline-none focus:border-cyan-400"
                >
                  <option value="Español">Español</option>
                  <option value="Inglés">Inglés</option>
                  <option value="Francés">Francés</option>
                  <option value="Alemán">Alemán</option>
                  <option value="Portugués">Portugués</option>
                  <option value="Italiano">Italiano</option>
                  <option value="Japonés">Japonés</option>
                  <option value="Chino">Chino</option>
                </select>
              </div>
            )}
          </div>

          {/* Typography Size */}
          <div>
            <label className="block text-slate-200 font-semibold mb-1 flex items-center gap-1.5">
              <Type size={14} className="text-cyan-400" />
              <span>Tamaño de Texto</span>
            </label>
            <div className="grid grid-cols-4 gap-2">
              {(["sm", "md", "lg", "xl"] as const).map((size) => (
                <button
                  key={size}
                  onClick={() => onUpdateSettings({ fontSize: size })}
                  className={`py-1.5 rounded-xl border text-center font-bold capitalize transition backdrop-blur-md ${
                    settings.fontSize === size
                      ? "bg-cyan-500 border-cyan-400 text-slate-950 shadow-md"
                      : "bg-white/5 border-white/10 text-slate-300 hover:bg-white/10"
                  }`}
                >
                  {size === "sm" ? "Chico" : size === "md" ? "Normal" : size === "lg" ? "Grande" : "Extra"}
                </button>
              ))}
            </div>
          </div>

          {/* Toggles */}
          <div className="space-y-2 pt-2 border-t border-white/10">
            <div className="flex items-center justify-between">
              <span className="text-slate-200 flex items-center gap-1.5">
                <Clock size={14} className="text-slate-400" />
                <span>Mostrar Marcas de Tiempo</span>
              </span>
              <input
                type="checkbox"
                checked={settings.showTimestamps}
                onChange={(e) => onUpdateSettings({ showTimestamps: e.target.checked })}
                className="w-4 h-4 rounded bg-slate-900 border-white/20 text-cyan-500"
              />
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-200 flex items-center gap-1.5">
                <Eye size={14} className="text-slate-400" />
                <span>Desplazamiento Automático (Auto-Scroll)</span>
              </span>
              <input
                type="checkbox"
                checked={settings.autoScroll}
                onChange={(e) => onUpdateSettings({ autoScroll: e.target.checked })}
                className="w-4 h-4 rounded bg-slate-900 border-white/20 text-cyan-500"
              />
            </div>
          </div>
        </div>

        <div className="mt-6 pt-3 border-t border-white/10 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold text-slate-950 bg-cyan-500 hover:bg-cyan-400 rounded-xl transition shadow-md"
          >
            Listo
          </button>
        </div>
      </div>
    </div>
  );
};
