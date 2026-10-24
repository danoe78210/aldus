import { useEffect, useRef, useState } from "react";
import { FastForward, Pause, Play, Rewind, SkipBack, SkipForward, Volume2 } from "lucide-react";

interface TapeDeckProps {
  src: string | undefined;
  title: string;
  /** Relance la lecture sur la bande suivante lorsqu'elle était en marche. */
  autoPlay?: boolean;
  onPrevious?: (wasPlaying: boolean) => void;
  onNext?: (wasPlaying: boolean) => void;
}

const SKIP_SECONDS = 15;

const clock = (seconds: number): string => {
  const safe = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
};

const Reel = ({ spinning }: { spinning: boolean }) => (
  <svg viewBox="0 0 100 100" aria-hidden="true" data-testid="reel" data-spinning={spinning} className={`h-24 w-24 shrink-0 ${spinning ? "animate-[spin_2.4s_linear_infinite] motion-reduce:animate-none" : ""}`}>
    <circle cx="50" cy="50" r="46" fill="#1a1714" stroke="#d4af37" strokeWidth="2" />
    {[0, 120, 240].map((angle) => <circle key={angle} cx="50" cy="26" r="10" fill="#13110f" stroke="#6b5327" strokeWidth="1.5" transform={`rotate(${angle} 50 50)`} />)}
    <circle cx="50" cy="50" r="8" fill="#13110f" stroke="#d4af37" strokeWidth="2" />
  </svg>
);

const keyClass = "flex h-10 w-10 items-center justify-center rounded-sm border border-[#6b5327] bg-[#211c15] text-[#d4af37] transition-colors hover:border-[#d4af37] hover:bg-[#302619] disabled:opacity-40";

/** Lecteur à bande magnétique : l'élément audio est démonté avec la bande, ce qui coupe toute lecture fantôme. */
export const TapeDeck = ({ src, title, autoPlay = false, onPrevious, onNext }: TapeDeckProps) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [error, setError] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    return () => audio?.pause();
  }, []);

  const toggle = async () => {
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

  const seek = (seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    const target = Math.min(Math.max(seconds, 0), duration || 0);
    audio.currentTime = target;
    setTime(target);
  };

  return (
    <div data-playing={playing} className="flex min-w-0 flex-col gap-4 rounded-sm border border-[#3a2f1d] bg-[#1a1612] p-4">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        autoPlay={autoPlay}
        aria-label={`Bande ${title}`}
        onTimeUpdate={(event) => setTime(event.currentTarget.currentTime)}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); onNext?.(true); }}
        onError={() => { setError(true); setPlaying(false); }}
        className="sr-only"
      />
      <div className="flex items-center justify-between gap-3">
        <Reel spinning={playing} />
        <div className="flex min-w-0 flex-1 flex-col items-center gap-1 text-center">
          <p className="max-w-full truncate font-serif text-sm text-[#f3f0ea]">{title}</p>
          <output aria-label="Compteur de bande" className="rounded-sm border border-[#3a2f1d] bg-[#13110f] px-3 py-1 font-mono text-lg tabular-nums text-[#d4af37]">{clock(time)} / {clock(duration)}</output>
        </div>
        <Reel spinning={playing} />
      </div>
      <input
        type="range"
        min={0}
        max={duration || 0}
        step={0.1}
        value={Math.min(time, duration || 0)}
        disabled={!duration}
        aria-label="Position de la bande"
        onChange={(event) => seek(Number(event.target.value))}
        className="h-1.5 w-full cursor-pointer accent-[#d4af37] disabled:cursor-default disabled:opacity-40"
      />
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button type="button" aria-label="Piste précédente" disabled={!onPrevious} onClick={() => onPrevious?.(playing)} className={keyClass}><SkipBack size={16} /></button>
        <button type="button" aria-label={`Reculer de ${SKIP_SECONDS} secondes`} disabled={!src} onClick={() => seek(time - SKIP_SECONDS)} className={keyClass}><Rewind size={16} /></button>
        <button type="button" aria-label={playing ? "Pause" : "Lecture"} disabled={!src} onClick={() => void toggle()} className={`${keyClass} h-12 w-12`}>
          {playing ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" />}
        </button>
        <button type="button" aria-label={`Avancer de ${SKIP_SECONDS} secondes`} disabled={!src} onClick={() => seek(time + SKIP_SECONDS)} className={keyClass}><FastForward size={16} /></button>
        <button type="button" aria-label="Piste suivante" disabled={!onNext} onClick={() => onNext?.(playing)} className={keyClass}><SkipForward size={16} /></button>
      </div>
      <label className="flex items-center gap-2 text-xs text-[#a99a83]">
        <Volume2 size={14} className="shrink-0 text-[#c5a059]" />
        <span className="sr-only">Volume</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={volume}
          aria-label="Volume"
          onChange={(event) => {
            const next = Number(event.target.value);
            if (audioRef.current) audioRef.current.volume = next;
            setVolume(next);
          }}
          className="h-1.5 w-full max-w-48 cursor-pointer accent-[#d4af37]"
        />
      </label>
      {error && <p role="status" className="text-xs text-[#d28b75]">Lecture audio indisponible pour {title}.</p>}
    </div>
  );
};
