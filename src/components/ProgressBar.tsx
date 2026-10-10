import React from "react";

interface ProgressBarProps {
  /** Avancement global de 0 à 100. */
  progress: number;
  /** Libellé de l'opération en cours. */
  label: string;
  /** Indique qu'un traitement lourd est actif. */
  running?: boolean;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  label,
  running = false,
}) => {
  const clamped = Math.min(100, Math.max(0, Math.round(progress)));
  const scale = [0, 25, 50, 75, 100];

  return (
    <div className="w-full max-w-6xl">
      {/* Pupitre supérieur — pupitre de typographe en ébène et laiton */}
      <div className="relative rounded-xs border-b border-[#382f22] bg-[#141210] px-5 py-3 text-[#e2dbce] shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_6px_14px_rgba(0,0,0,0.5)]">
        {/* Vis de fixation aux quatre coins */}
        <span className="absolute left-2 top-2 h-1.5 w-1.5 rounded-full bg-brass/70 shadow-[inset_0_1px_1px_rgba(0,0,0,0.6)]" />
        <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-brass/70 shadow-[inset_0_1px_1px_rgba(0,0,0,0.6)]" />
        <span className="absolute bottom-2 left-2 h-1.5 w-1.5 rounded-full bg-brass/70 shadow-[inset_0_1px_1px_rgba(0,0,0,0.6)]" />
        <span className="absolute bottom-2 right-2 h-1.5 w-1.5 rounded-full bg-brass/70 shadow-[inset_0_1px_1px_rgba(0,0,0,0.6)]" />

        <div className="mb-2 flex items-end justify-between">
          {/* Statut d'opération — encre bistre, accentuation or */}
          <span className="font-serif text-[11px] tracking-[0.3em] text-[#9e9587] uppercase">
            {label}
            {running && <span className="ml-2 text-[#d4af37]">— en cours</span>}
          </span>
          {/* Compteur gradué à trois chiffres */}
          <span className="rounded-xs border border-[#2e261b] bg-[#0f0c0a] px-2 py-0.5 font-mono text-sm tracking-widest text-[#d4af37] tabular-nums shadow-[inset_0_2px_4px_rgba(0,0,0,0.9)]">
            {String(clamped).padStart(3, "0")}&#8202;%
          </span>
        </div>

        {/* Réglette de typographe : rainure en laiton sombre + curseur brossé */}
        <div className="relative h-3 w-full overflow-hidden rounded-xs border border-[#2e261b] bg-[#1c1814] shadow-[inset_0_2px_6px_rgba(0,0,0,0.9)]">
          <div
            className={`h-full bg-linear-to-r from-[#8f6e2b] via-[#c5a059] to-[#8f6e2b] transition-all duration-200 ease-out ${
              running ? "animate-pulse" : ""
            }`}
            style={{ width: `${clamped}%` }}
          />
          {/* Tirets millimétriques tous les 10 % (filigrane) */}
          <div
            className="pointer-events-none absolute inset-0 opacity-40"
            style={{
              backgroundImage:
                "repeating-linear-gradient(90deg, transparent 0 10%, rgba(0,0,0,0.75) 10%, rgba(0,0,0,0.75) calc(10% + 1px))",
            }}
          />
        </div>

        {/* Échelle graduée */}
        <div className="mt-1 flex justify-between font-mono text-[9px] tracking-widest text-[#9e9587]/70 uppercase">
          {scale.map((tick) => (
            <span key={tick}>{tick}</span>
          ))}
        </div>
      </div>
    </div>
  );
};

