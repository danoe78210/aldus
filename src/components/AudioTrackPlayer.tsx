import { useRef, useState } from "react";
import { Pause, Play } from "lucide-react";

interface AudioTrackPlayerProps {
  src: string | undefined;
  title: string;
}

const formatTime = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainder}`;
};

export const AudioTrackPlayer = ({ src, title }: AudioTrackPlayerProps) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState(false);

  const togglePlayback = async () => {
    const audio = audioRef.current;
    if (!audio || !src) return;
    setError(false);
    try {
      if (audio.paused) await audio.play();
      else audio.pause();
    } catch {
      setError(true);
    }
  };

  return (
    <div className="flex min-w-0 items-center gap-3 rounded-sm border border-[#3a3228] bg-[#141210] px-3 py-2.5">
      <audio
        ref={audioRef}
        src={src}
        preload="none"
        aria-label={`Écouter ${title}`}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onError={() => { setError(true); setPlaying(false); }}
        className="sr-only"
      />
      <button
        type="button"
        disabled={!src}
        onClick={() => void togglePlayback()}
        aria-label={`${playing ? "Mettre en pause" : "Lire"} ${title}`}
        title={playing ? "Mettre en pause" : "Lire le chapitre"}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#d4af37]/55 bg-[#211c15] text-[#d4af37] transition-colors hover:border-[#d4af37] hover:bg-[#302619] hover:text-[#f3d995] disabled:opacity-40"
      >
        {playing ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
      </button>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="w-8 shrink-0 text-right font-mono text-[10px] tabular-nums text-[#c5a059]">{formatTime(currentTime)}</span>
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={Math.min(currentTime, duration || 0)}
          disabled={!duration}
          aria-label={`Position de lecture ${title}`}
          onChange={(event) => {
            const time = Number(event.target.value);
            if (audioRef.current) audioRef.current.currentTime = time;
            setCurrentTime(time);
          }}
          className="h-1.5 min-w-0 flex-1 cursor-pointer accent-[#d4af37] disabled:cursor-default disabled:opacity-40"
        />
        <span className="w-8 shrink-0 font-mono text-[10px] tabular-nums text-[#8c8275]">{formatTime(duration)}</span>
      </div>
      {error && <span role="status" className="sr-only">Lecture audio indisponible pour {title}.</span>}
    </div>
  );
};