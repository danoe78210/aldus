import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { FastForward, Pause, Play, Rewind, SkipBack, SkipForward, Volume2 } from "lucide-react";
import { VU_REST_ANGLE, dbToLevel, levelToAngle, useVuMeters } from "./useVuMeters";

interface TapeDeckProps {
  src: string | undefined;
  title: string;
  /** Relance la lecture sur la bande suivante lorsqu'elle était en marche. */
  autoPlay?: boolean;
  onPrevious?: (wasPlaying: boolean) => void;
  onNext?: (wasPlaying: boolean) => void;
}

const SKIP_SECONDS = 15;
const SUPPLY = { x: 130, y: 125 };
const TAKE_UP = { x: 510, y: 125 };
const FLANGE_RADIUS = 100;
const PACK_MIN = 38;
const PACK_SPAN = 42;
const GUIDES = [{ x: 232, y: 238 }, { x: 268, y: 262 }, { x: 372, y: 262 }, { x: 408, y: 238 }];

const clock = (seconds: number): string => {
  const safe = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
};

const polar = (cx: number, cy: number, radius: number, degrees: number) => {
  const radians = (degrees * Math.PI) / 180;
  return { x: cx + radius * Math.sin(radians), y: cy - radius * Math.cos(radians) };
};

/** Bobine à six branches : la galette de bande (pack) change de diamètre avec l'avancement, les flasques tournent seules. */
const Reel = ({ x, y, pack, spinning }: { x: number; y: number; pack: number; spinning: boolean }) => (
  <g>
    <circle cx={x} cy={y} r={FLANGE_RADIUS} fill="url(#reel-flange)" stroke="#d4af37" strokeWidth={3} />
    <circle cx={x} cy={y} r={92} fill="none" stroke="#6b5327" strokeWidth={1.5} />
    <circle cx={x} cy={y} r={pack} fill="#2a1d12" stroke="#4a3520" strokeWidth={2} />
    <g
      data-testid="reel"
      data-spinning={spinning}
      style={{ transformBox: "fill-box", transformOrigin: "center", animationPlayState: spinning ? "running" : "paused" }}
      className="animate-[spin_2.4s_linear_infinite] motion-reduce:animate-none"
    >
      <circle cx={x} cy={y} r={84} fill="none" stroke="#8f6e2b" strokeWidth={4} />
      {[0, 60, 120, 180, 240, 300].map((angle) => <rect key={angle} x={x - 3.5} y={y - 84} width={7} height={62} rx={2} fill="#8f6e2b" stroke="#13110f" strokeWidth={0.8} transform={`rotate(${angle} ${x} ${y})`} />)}
      <circle cx={x} cy={y} r={23} fill="url(#reel-brass)" stroke="#13110f" strokeWidth={1.5} />
      {[0, 120, 240].map((angle) => <circle key={angle} cx={x} cy={y - 13} r={3} fill="#13110f" transform={`rotate(${angle} ${x} ${y})`} />)}
      <circle cx={x} cy={y} r={5} fill="#13110f" />
    </g>
    {Array.from({ length: 12 }, (_, index) => {
      const rivet = polar(x, y, 96, index * 30);
      return <circle key={index} cx={rivet.x} cy={rivet.y} r={1.8} fill="#e6c85a" />;
    })}
  </g>
);

const DB_MARKS = [-20, -10, -7, -5, -3, -1, 0, 1, 3];
const SATURATION = "#b5452f";
const markAngle = (db: number): number => levelToAngle(dbToLevel(db));
const arcPath = (cx: number, cy: number, radius: number, from: number, to: number): string => {
  const start = polar(cx, cy, radius, from);
  const end = polar(cx, cy, radius, to);
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 0 1 ${end.x} ${end.y}`;
};

/** Galvanomètre rétroéclairé : l'aiguille est pilotée par `useVuMeters` à travers sa référence. */
const VuMeter = ({ x, label, needle }: { x: number; label: string; needle: RefObject<SVGLineElement | null> }) => {
  const top = 284;
  const width = 180;
  const height = 104;
  const pivot = { x: x + width / 2, y: top + height - 10 };
  return (
    <g>
      <rect x={x} y={top} width={width} height={height} rx={5} fill="url(#vu-glow)" stroke="#d4af37" strokeWidth={2} />
      <rect x={x + 6} y={top + 6} width={width - 12} height={height - 12} rx={3} fill="none" stroke="#6b5327" strokeWidth={1} />
      <text x={pivot.x} y={top + 17} textAnchor="middle" className="font-cinzel" fontSize={8.5} letterSpacing={2} fill="#c5a059">{label}</text>
      <path d={arcPath(pivot.x, pivot.y, 56, markAngle(-20), markAngle(1))} fill="none" stroke="#8c8275" strokeWidth={1.2} />
      <path d={arcPath(pivot.x, pivot.y, 56, markAngle(1), markAngle(3))} fill="none" stroke={SATURATION} strokeWidth={3.5} opacity={0.8} />
      {DB_MARKS.map((db) => {
        const angle = markAngle(db);
        const from = polar(pivot.x, pivot.y, db === 0 ? 47 : 50, angle);
        const to = polar(pivot.x, pivot.y, 58, angle);
        const text = polar(pivot.x, pivot.y, 67, angle);
        return (
          <g key={db}>
            <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={db > 0 ? SATURATION : "#e8dcc0"} strokeWidth={db === 0 ? 1.8 : 1.2} />
            <text x={text.x} y={text.y} textAnchor="middle" dominantBaseline="central" className="font-mono" fontSize={7} fill={db > 0 ? SATURATION : "#c9bea9"}>{db > 0 ? `+${db}` : db < 0 ? `−${-db}` : "0"}</text>
          </g>
        );
      })}
      <circle cx={pivot.x} cy={pivot.y} r={10} fill="#1a1714" stroke="#6b5327" strokeWidth={1.5} />
      <line
        ref={needle}
        data-testid="vu-needle"
        x1={pivot.x} y1={pivot.y} x2={pivot.x} y2={pivot.y - 64}
        stroke="#f3f0ea" strokeWidth={1.6} strokeLinecap="round"
        style={{ transformBox: "fill-box", transformOrigin: "50% 100%", transform: `rotate(${VU_REST_ANGLE}deg)` }}
      />
      <circle cx={pivot.x} cy={pivot.y} r={4.5} fill="#13110f" stroke="#d4af37" strokeWidth={1.5} />
    </g>
  );
};

const Mechanics = ({ playing, ratio, needles }: { playing: boolean; ratio: number; needles: { left: RefObject<SVGLineElement | null>; right: RefObject<SVGLineElement | null> } }) => {
  const supplyPack = PACK_MIN + PACK_SPAN * (1 - ratio);
  const takeUpPack = PACK_MIN + PACK_SPAN * ratio;
  const leave = { x: SUPPLY.x + supplyPack * 0.7071, y: SUPPLY.y + supplyPack * 0.7071 };
  const arrive = { x: TAKE_UP.x - takeUpPack * 0.7071, y: TAKE_UP.y + takeUpPack * 0.7071 };
  const path = `M ${leave.x} ${leave.y} ${GUIDES.map((guide) => `L ${guide.x} ${guide.y}`).join(" ")} L ${arrive.x} ${arrive.y}`;
  return (
    <svg viewBox="0 0 640 400" aria-hidden="true" className="w-full">
      <defs>
        <radialGradient id="reel-flange"><stop offset="0%" stopColor="#2a241c" /><stop offset="100%" stopColor="#13110f" /></radialGradient>
        <linearGradient id="reel-brass" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#f0d675" /><stop offset="55%" stopColor="#b08d37" /><stop offset="100%" stopColor="#6b5327" /></linearGradient>
        <radialGradient id="vu-glow" cx="50%" cy="70%" r="75%"><stop offset="0%" stopColor="#4a3418" /><stop offset="100%" stopColor="#2a2015" /></radialGradient>
      </defs>
      <Reel x={SUPPLY.x} y={SUPPLY.y} pack={supplyPack} spinning={playing} />
      <Reel x={TAKE_UP.x} y={TAKE_UP.y} pack={takeUpPack} spinning={playing} />
      <path d={path} fill="none" stroke="#7a5a35" strokeWidth={2.5} strokeLinejoin="round" />
      {GUIDES.map((guide) => <circle key={`${guide.x}-${guide.y}`} cx={guide.x} cy={guide.y} r={7} fill="#13110f" stroke="#d4af37" strokeWidth={2} />)}
      <rect x={282} y={266} width={76} height={70} rx={3} fill="#1a1714" stroke="#d4af37" strokeWidth={2} />
      {[292, 313, 334].map((nub) => <rect key={nub} x={nub} y={262} width={14} height={10} rx={1} fill="#6b5327" stroke="#d4af37" strokeWidth={1} />)}
      <text x={320} y={324} textAnchor="middle" className="font-cinzel" fontSize={9} letterSpacing={2} fill="#8c8275">TÊTES</text>
      <VuMeter x={70} label="VU · GAUCHE" needle={needles.left} />
      <VuMeter x={390} label="VU · DROITE" needle={needles.right} />
    </svg>
  );
};

const keyClass = "flex items-center justify-center rounded-md border border-[#6b5327] bg-[linear-gradient(180deg,#3a2f1d,#211c15)] text-[#d4af37] shadow-[0_3px_0_#0b0a09,inset_0_1px_0_rgb(255_235_160/25%)] transition-all hover:border-[#d4af37] active:translate-y-0.5 active:shadow-[0_1px_0_#0b0a09] disabled:opacity-40 disabled:active:translate-y-0";

const Key = ({ label, caption, disabled, onClick, main = false, lit = false, children }: { label: string; caption: string; disabled?: boolean; onClick: () => void; main?: boolean; lit?: boolean; children: ReactNode }) => (
  <div className="flex flex-col items-center gap-1.5">
    <button type="button" aria-label={label} disabled={disabled} onClick={onClick} className={`${keyClass} ${main ? "h-[4.5rem] w-[4.5rem] rounded-full border-2 border-[#d4af37]" : "h-14 w-14"} ${lit ? "bg-[linear-gradient(180deg,#8f6e2b,#5c4519)] text-[#fff3c4]" : ""}`}>{children}</button>
    <span aria-hidden="true" className="font-cinzel text-[9px] tracking-wider text-[#8c8275] uppercase">{caption}</span>
  </div>
);

const Screw = ({ position }: { position: string }) => (
  <span aria-hidden="true" className={`absolute h-2.5 w-2.5 rounded-full border border-[#13110f] bg-[radial-gradient(circle_at_35%_35%,#f0d675,#6b5327)] ${position}`} />
);

/** Magnétophone à bobines : l'élément audio est démonté avec la bande, ce qui coupe toute lecture fantôme. */
export const TapeDeck = ({ src, title, autoPlay = false, onPrevious, onNext }: TapeDeckProps) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [error, setError] = useState(false);
  const { prepare, ...needles } = useVuMeters(audioRef, playing);

  useEffect(() => {
    const audio = audioRef.current;
    return () => audio?.pause();
  }, []);

  const toggle = async () => {
    const audio = audioRef.current;
    if (!audio || !src) return;
    setError(false);
    try {
      if (audio.paused) {
        prepare();
        await audio.play();
      } else {
        audio.pause();
      }
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

  const ratio = duration > 0 ? Math.min(Math.max(time / duration, 0), 1) : 0;

  return (
    <div data-playing={playing} className="relative flex min-h-[36rem] min-w-0 flex-col gap-4 rounded-md border-2 border-[#8f6e2b] bg-[linear-gradient(180deg,#221c15,#15120f_60%,#1a1612)] p-6 shadow-[inset_0_1px_0_rgb(255_235_160/15%),0_8px_24px_rgb(0_0_0/45%)]">
      <Screw position="top-2 left-2" />
      <Screw position="top-2 right-2" />
      <Screw position="bottom-2 left-2" />
      <Screw position="right-2 bottom-2" />
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        crossOrigin="anonymous"
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
      <div className="flex flex-col items-center gap-1 text-center">
        <p className="font-cinzel text-[10px] tracking-[0.3em] text-[#8c8275] uppercase">Magnétophone · bande analogique</p>
      </div>
      <div className="relative">
        <Mechanics playing={playing} ratio={ratio} needles={needles} />
        <output aria-label="Compteur de bande" className="absolute top-[12%] left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-sm border border-[#6b5327] bg-[linear-gradient(180deg,#050403,#1d1812_50%,#050403)] px-3 py-1.5 font-mono text-sm tracking-widest whitespace-nowrap text-[#e6c85a] tabular-nums shadow-[inset_0_0_6px_#000] xl:text-base">{clock(time)} / {clock(duration)}</output>
      </div>
      <div className="mt-auto flex flex-col gap-5">
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={Math.min(time, duration || 0)}
          disabled={!duration}
          aria-label="Position de la bande"
          onChange={(event) => seek(Number(event.target.value))}
          className="tape-slider w-full cursor-pointer disabled:cursor-default disabled:opacity-40"
        />
        <div className="flex flex-wrap items-end justify-center gap-3">
          <Key label="Piste précédente" caption="Préc." disabled={!onPrevious} onClick={() => onPrevious?.(playing)}><SkipBack size={20} /></Key>
          <Key label={`Reculer de ${SKIP_SECONDS} secondes`} caption={`−${SKIP_SECONDS} s`} disabled={!src} onClick={() => seek(time - SKIP_SECONDS)}><Rewind size={20} /></Key>
          <Key main lit={playing} label={playing ? "Pause" : "Lecture"} caption={playing ? "Pause" : "Lecture"} disabled={!src} onClick={() => void toggle()}>
            {playing ? <Pause size={26} fill="currentColor" /> : <Play size={26} fill="currentColor" />}
          </Key>
          <Key label={`Avancer de ${SKIP_SECONDS} secondes`} caption={`+${SKIP_SECONDS} s`} disabled={!src} onClick={() => seek(time + SKIP_SECONDS)}><FastForward size={20} /></Key>
          <Key label="Piste suivante" caption="Suiv." disabled={!onNext} onClick={() => onNext?.(playing)}><SkipForward size={20} /></Key>
        </div>
        <div className="mx-auto flex w-full max-w-sm flex-col gap-1">
          <label className="flex items-center gap-3 text-xs text-[#a99a83]">
            <Volume2 size={16} className="shrink-0 text-[#c5a059]" />
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
              className="tape-slider w-full cursor-pointer"
            />
          </label>
          <div aria-hidden="true" className="ml-7 flex justify-between font-mono text-[9px] text-[#6b5327]">
            {Array.from({ length: 11 }, (_, index) => <span key={index}>{index}</span>)}
          </div>
        </div>
      </div>
      {error && <p role="status" className="text-center text-xs text-[#d28b75]">Lecture audio indisponible pour {title}.</p>}
    </div>
  );
};
