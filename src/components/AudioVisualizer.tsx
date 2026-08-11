import React, { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX, Radio, CheckCircle, AlertCircle } from "lucide-react";

interface AudioVisualizerProps {
  stream: MediaStream | null;
  isRecording: boolean;
  sourceType: "tab" | "mic" | "file";
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  stream,
  isRecording,
  sourceType,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [hasAudioTrack, setHasAudioTrack] = useState<boolean>(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!stream || !isRecording) {
      setHasAudioTrack(false);
      setAudioLevel(0);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }

    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) {
      setHasAudioTrack(false);
      return;
    }

    setHasAudioTrack(true);

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioCtx();
      audioCtxRef.current = audioCtx;

      const sourceNode = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.8;
      sourceNode.connect(analyser);
      analyserRef.current = analyser;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const draw = () => {
        if (!canvasRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        analyser.getByteFrequencyData(dataArray);

        // Calculate average audio level (0 to 100)
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const avg = sum / bufferLength;
        const normalizedLevel = Math.min(100, Math.round((avg / 128) * 100));
        setAudioLevel(normalizedLevel);

        // Render Canvas Visualizer Bars
        const width = canvas.width;
        const height = canvas.height;
        ctx.clearRect(0, 0, width, height);

        const barWidth = (width / bufferLength) * 1.5;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          const barHeight = (dataArray[i] / 255) * height;

          // Gradient color depending on intensity (Frosted cyan/indigo/fuchsia)
          const gradient = ctx.createLinearGradient(0, height, 0, 0);
          gradient.addColorStop(0, "rgba(99, 102, 241, 0.4)");
          gradient.addColorStop(0.5, "rgba(34, 211, 238, 0.8)");
          gradient.addColorStop(1, "rgba(217, 70, 239, 0.9)");

          ctx.fillStyle = gradient;
          ctx.beginPath();
          ctx.roundRect(x, height - barHeight, barWidth - 2, barHeight, [2, 2, 0, 0]);
          ctx.fill();

          x += barWidth + 1;
        }

        animFrameRef.current = requestAnimationFrame(draw);
      };

      draw();
    } catch (err) {
      console.error("Error setting up audio visualizer:", err);
    }

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, [stream, isRecording]);

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 shadow-2xl backdrop-blur-xl">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div
            className={`w-3 h-3 rounded-full ${
              isRecording && hasAudioTrack
                ? "bg-cyan-400 animate-pulse shadow-[0_0_12px_rgba(34,211,238,0.9)]"
                : "bg-slate-600"
            }`}
          />
          <span className="text-sm font-bold text-white tracking-tight">
            {isRecording
              ? sourceType === "tab"
                ? "Audio de Pestaña en Vivo"
                : "Micrófono Activo"
              : "Esperando inicio de captura"}
          </span>
          <span className="text-xs px-2.5 py-0.5 rounded-full bg-white/10 text-slate-300 border border-white/10 font-mono">
            {sourceType === "tab" ? "Pestaña Navegador" : sourceType === "mic" ? "Micrófono" : "Archivo"}
          </span>
        </div>

        {/* Audio Track Status Indicator */}
        <div className="flex items-center gap-3 text-xs font-mono">
          {isRecording && !hasAudioTrack && (
            <div className="flex items-center gap-1.5 text-amber-300 bg-amber-950/50 border border-amber-500/30 px-2.5 py-1 rounded-lg backdrop-blur-md">
              <AlertCircle size={14} />
              <span>Sin pista de audio</span>
            </div>
          )}

          {isRecording && hasAudioTrack && (
            <div className="flex items-center gap-2 text-cyan-400 bg-cyan-950/30 border border-cyan-400/30 px-2.5 py-1 rounded-lg backdrop-blur-md font-semibold">
              <Volume2 size={15} />
              <span>{audioLevel}% Nivel de entrada</span>
            </div>
          )}
        </div>
      </div>

      {/* Canvas Equalizer Display */}
      <div className="relative h-14 bg-slate-950/80 rounded-xl border border-white/10 overflow-hidden flex items-center justify-center shadow-inner">
        {isRecording && hasAudioTrack ? (
          <canvas
            ref={canvasRef}
            width={600}
            height={56}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex items-center gap-2 text-slate-400 text-xs font-sans">
            <Radio size={16} className={isRecording ? "animate-spin text-cyan-400" : "text-slate-500"} />
            <span>
              {isRecording
                ? "Conectando con el flujo de audio..."
                : "Haz clic en 'Compartir Pestaña' para iniciar la captura en tiempo real"}
            </span>
          </div>
        )}

        {/* Audio Volume DB Bar at bottom */}
        {isRecording && hasAudioTrack && (
          <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/10 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 via-cyan-400 to-fuchsia-400 transition-all duration-75"
              style={{ width: `${audioLevel}%` }}
            />
          </div>
        )}
      </div>
    </div>
  );
};
