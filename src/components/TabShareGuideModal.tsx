import React from "react";
import { CheckSquare, Monitor, Volume2, HelpCircle, X, Sparkles, ArrowRight, Zap, Tv } from "lucide-react";

interface TabShareGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmStart: () => void;
}

export const TabShareGuideModal: React.FC<TabShareGuideModalProps> = ({
  isOpen,
  onClose,
  onConfirmStart,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#020617]/90 backdrop-blur-2xl border border-white/10 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative overflow-hidden">
        {/* Background glow accent */}
        <div className="absolute -top-12 -right-12 w-44 h-44 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none" />

        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-xl hover:bg-white/10 transition"
        >
          <X size={20} />
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-cyan-400/10 border border-cyan-400/20 flex items-center justify-center text-cyan-400">
            <Tv size={22} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Transmisión de Pestaña (Pantalla y Audio)</h3>
            <p className="text-xs text-slate-400">Transcripción en vivo + Consultas de visión en pantalla con bajo consumo</p>
          </div>
        </div>

        {/* Feature Highlights Banner */}
        <div className="p-3 bg-gradient-to-r from-cyan-500/10 to-indigo-500/10 border border-cyan-400/20 rounded-xl mb-4 text-xs text-cyan-200 flex items-center gap-2.5">
          <Zap size={18} className="text-cyan-400 shrink-0" />
          <p className="leading-relaxed">
            Al compartir la pestaña, se transcribirá el audio en tiempo real y podrás hacer preguntas a la IA sobre <strong>lo que aparece en pantalla</strong> (exámenes, presentaciones, código) <em>sin gastar casi tokens</em>.
          </p>
        </div>

        <div className="space-y-3.5 my-4">
          <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 flex gap-3 items-start backdrop-blur-md">
            <div className="w-6 h-6 rounded-full bg-cyan-500 text-slate-950 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5 shadow-md">
              1
            </div>
            <div>
              <p className="text-sm font-medium text-slate-200">
                Selecciona <strong>"Pestaña de Chrome"</strong> (o Tab).
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                Elige la pestaña con la clase, examen, reunión o video.
              </p>
            </div>
          </div>

          <div className="bg-cyan-400/10 border border-cyan-400/30 rounded-xl p-3.5 flex gap-3 items-start relative overflow-hidden backdrop-blur-md">
            <div className="w-6 h-6 rounded-full bg-cyan-400 text-slate-950 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5 shadow-md">
              2
            </div>
            <div>
              <p className="text-sm font-bold text-cyan-300 flex items-center gap-1.5">
                <CheckSquare size={16} /> ¡MUY IMPORTANTE!
              </p>
              <p className="text-xs text-slate-200 mt-1 leading-relaxed">
                Asegúrate de <strong>MARCAR LA CASILLA</strong>{" "}
                <span className="bg-cyan-400/20 text-cyan-300 px-1.5 py-0.5 rounded font-mono font-semibold border border-cyan-400/30">
                  "Compartir audio de la pestaña"
                </span>{" "}
                en la esquina inferior izquierda.
              </p>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-3.5 flex gap-3 items-start backdrop-blur-md">
            <div className="w-6 h-6 rounded-full bg-cyan-500 text-slate-950 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5 shadow-md">
              3
            </div>
            <div>
              <p className="text-sm font-medium text-slate-200">
                ¡Usa el Chat de IA para preguntar sobre la pantalla!
              </p>
              <p className="text-xs text-slate-400 mt-0.5">
                Solo se envía una minicaptura compresa cuando preguntas algo en el chat, ahorrando el 99% de los tokens.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-400 hover:text-white rounded-xl hover:bg-white/10 transition"
          >
            Cancelar
          </button>
          <button
            onClick={() => {
              onClose();
              onConfirmStart();
            }}
            className="px-5 py-2.5 text-sm font-bold text-slate-950 bg-cyan-500 hover:bg-cyan-400 rounded-xl shadow-lg shadow-cyan-500/20 flex items-center gap-2 transition active:scale-98"
          >
            <span>Iniciar Transmisión de Pestaña</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
};

