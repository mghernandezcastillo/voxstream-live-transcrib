import { BrainCircuit, Check, Cpu, Languages, Sparkles } from "lucide-react";
import { useEffect } from "react";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
} from "motion/react";

type AIStartupLoaderProps = {
  progress: number;
  status: string;
};

const neuralNodes = [
  { left: "17%", top: "30%", delay: 0 },
  { left: "78%", top: "23%", delay: 0.35 },
  { left: "84%", top: "66%", delay: 0.7 },
  { left: "25%", top: "78%", delay: 1.05 },
];

export function AIStartupLoader({ progress, status }: AIStartupLoaderProps) {
  const reduceMotion = useReducedMotion();
  const normalizedProgress = Math.min(100, Math.max(0, Math.round(progress)));
  const isReady = normalizedProgress >= 100;
  const progressValue = useMotionValue(0);
  const smoothProgress = useSpring(progressValue, {
    stiffness: 150,
    damping: 24,
    mass: 0.5,
  });
  const displayedProgress = useTransform(smoothProgress, (value) => Math.round(value));

  useEffect(() => {
    progressValue.set(normalizedProgress);
  }, [normalizedProgress, progressValue]);

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.025, filter: "blur(10px)" }}
      transition={{ duration: reduceMotion ? 0.2 : 0.7, ease: [0.16, 1, 0.3, 1] }}
      className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-[#020617] px-5 py-8"
      aria-live="polite"
      aria-busy={!isReady}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_42%,rgba(8,145,178,0.18),transparent_30%),radial-gradient(circle_at_18%_18%,rgba(79,70,229,0.16),transparent_27%),radial-gradient(circle_at_84%_78%,rgba(168,85,247,0.13),transparent_29%)]" />
      <motion.div
        animate={reduceMotion ? undefined : { opacity: [0.18, 0.38, 0.18], scale: [0.96, 1.04, 0.96] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        className="absolute left-1/2 top-[43%] h-[30rem] w-[30rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-500/10 blur-[100px]"
      />
      <div
        className="absolute inset-0 opacity-[0.055]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(148,163,184,.45) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,.45) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage: "radial-gradient(circle at center, black 15%, transparent 72%)",
        }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_32%,rgba(2,6,23,0.74)_78%)]" />

      <div className="relative z-10 flex w-full max-w-xl flex-col items-center text-center">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55 }}
          className="mb-6 flex items-center gap-2.5 rounded-full border border-cyan-300/15 bg-slate-900/55 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-200/80 shadow-[0_10px_40px_rgba(2,6,23,0.45)] backdrop-blur-xl"
        >
          <Sparkles size={13} className="text-cyan-300" />
          VoxStream Neural Engine
        </motion.div>

        <div
          className="relative flex h-64 w-64 items-center justify-center sm:h-72 sm:w-72"
          role="progressbar"
          aria-label="Progreso de preparación de los motores locales"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={normalizedProgress}
        >
          <motion.div
            animate={reduceMotion ? undefined : { scale: [0.92, 1.08, 0.92], opacity: [0.24, 0.06, 0.24] }}
            transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
            className={`absolute inset-6 rounded-full border ${isReady ? "border-emerald-300/50" : "border-cyan-300/40"}`}
          />
          <motion.div
            animate={reduceMotion ? undefined : { rotate: 360 }}
            transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
            className="absolute inset-1 rounded-full border border-dashed border-indigo-300/20"
          >
            <span className="absolute left-1/2 top-[-4px] h-2 w-2 -translate-x-1/2 rounded-full bg-indigo-300 shadow-[0_0_16px_rgba(165,180,252,0.95)]" />
            <span className="absolute bottom-[12%] right-[10%] h-1.5 w-1.5 rounded-full bg-fuchsia-300 shadow-[0_0_14px_rgba(240,171,252,0.9)]" />
          </motion.div>
          <motion.div
            animate={reduceMotion ? undefined : { rotate: -360 }}
            transition={{ duration: 11, repeat: Infinity, ease: "linear" }}
            className="absolute inset-5 rounded-full border border-dotted border-cyan-200/25"
          >
            <span className="absolute bottom-2 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-cyan-300 shadow-[0_0_18px_rgba(103,232,249,1)]" />
          </motion.div>

          <svg className="absolute inset-0 h-full w-full -rotate-90 overflow-visible" viewBox="0 0 288 288" aria-hidden="true">
            <defs>
              <linearGradient id="startup-progress-gradient" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor={isReady ? "#6ee7b7" : "#818cf8"} />
                <stop offset="48%" stopColor={isReady ? "#34d399" : "#22d3ee"} />
                <stop offset="100%" stopColor={isReady ? "#2dd4bf" : "#e879f9"} />
              </linearGradient>
              <filter id="startup-progress-glow" x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <circle cx="144" cy="144" r="137" fill="none" stroke="rgba(148,163,184,0.1)" strokeWidth="3" />
            <motion.circle
              cx="144"
              cy="144"
              r="137"
              fill="none"
              stroke="url(#startup-progress-gradient)"
              strokeWidth="3.5"
              strokeLinecap="round"
              pathLength="1"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: normalizedProgress / 100 }}
              transition={{ duration: reduceMotion ? 0.1 : 0.55, ease: "easeOut" }}
              filter="url(#startup-progress-glow)"
            />
          </svg>

          <div className="absolute inset-[22%] rounded-full border border-white/10 bg-slate-950/70 shadow-[inset_0_0_35px_rgba(34,211,238,0.08),0_0_60px_rgba(8,145,178,0.16)] backdrop-blur-2xl">
            <div className="absolute inset-3 rounded-full border border-cyan-300/10 bg-gradient-to-br from-cyan-400/10 via-indigo-500/5 to-fuchsia-500/10" />

            <div className="absolute inset-5">
              <svg className="h-full w-full" viewBox="0 0 100 100" aria-hidden="true">
                <g stroke="rgba(103,232,249,.22)" strokeWidth="0.8">
                  <line x1="50" y1="50" x2="15" y2="28" />
                  <line x1="50" y1="50" x2="82" y2="23" />
                  <line x1="50" y1="50" x2="88" y2="69" />
                  <line x1="50" y1="50" x2="25" y2="82" />
                </g>
                {neuralNodes.map((node) => (
                  <motion.circle
                    key={`${node.left}-${node.top}`}
                    cx={node.left}
                    cy={node.top}
                    r="2.2"
                    fill={isReady ? "#6ee7b7" : "#67e8f9"}
                    animate={reduceMotion ? undefined : { opacity: [0.35, 1, 0.35], r: [1.8, 2.8, 1.8] }}
                    transition={{ duration: 1.8, delay: node.delay, repeat: Infinity, ease: "easeInOut" }}
                  />
                ))}
              </svg>
            </div>

            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <motion.div
                animate={reduceMotion || isReady ? undefined : { filter: ["drop-shadow(0 0 5px rgba(34,211,238,.35))", "drop-shadow(0 0 14px rgba(34,211,238,.8))", "drop-shadow(0 0 5px rgba(34,211,238,.35))"] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
              >
                {isReady ? (
                  <Check size={34} strokeWidth={2.1} className="text-emerald-300" />
                ) : (
                  <BrainCircuit size={36} strokeWidth={1.65} className="text-cyan-200" />
                )}
              </motion.div>
              <span className={`mt-2 text-3xl font-semibold tracking-[-0.06em] ${isReady ? "text-emerald-200" : "text-white"}`}>
                <motion.span>{reduceMotion ? normalizedProgress : displayedProgress}</motion.span>
                <span className="ml-1 text-sm font-medium tracking-normal text-slate-400">%</span>
              </span>
            </div>
          </div>
        </div>

        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.55 }}
          className="mt-6 flex flex-col items-center"
        >
          <h1 className="text-2xl font-semibold tracking-[-0.03em] text-white sm:text-3xl">
            {isReady ? "Todo está listo" : "Preparando tu inteligencia local"}
          </h1>
          <div className={`mt-3 flex max-w-md items-center gap-2 rounded-full border px-4 py-2 text-xs font-medium backdrop-blur-xl ${isReady ? "border-emerald-300/20 bg-emerald-400/10 text-emerald-200" : "border-cyan-300/15 bg-cyan-400/[0.07] text-cyan-100/80"}`}>
            <motion.span
              animate={reduceMotion || isReady ? undefined : { opacity: [0.35, 1, 0.35] }}
              transition={{ duration: 1.35, repeat: Infinity, ease: "easeInOut" }}
              className={`h-1.5 w-1.5 shrink-0 rounded-full ${isReady ? "bg-emerald-300" : "bg-cyan-300"}`}
            />
            <span>{status || (isReady ? "Sistema preparado" : "Sincronizando motores de voz...")}</span>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">
            <span className="flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.025] px-3 py-1.5">
              <Cpu size={11} /> IA local
            </span>
            <span className="flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.025] px-3 py-1.5">
              <Languages size={11} /> EN + ES
            </span>
            <span className="flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.025] px-3 py-1.5">
              <Check size={11} /> Caché persistente
            </span>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
