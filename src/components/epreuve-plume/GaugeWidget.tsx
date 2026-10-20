import React from "react";
import { riskTone } from "../../utils/stylometryView";

const MicroMetric: React.FC<{ label: string; value: number | null }> = ({ label, value }) => {
  const percent = Math.round(Math.min(100, Math.max(0, value ?? 0)));
  return (
    <div>
      <div className="flex justify-between font-sans text-xs text-[#f0ece1]">
        <span>{label}</span>
        <span className="tabular-nums">{value === null ? "—" : `${percent} %`}</span>
      </div>
      <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}       className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#2a2622]">
              <div className="h-full rounded-full bg-[#d99b32] transition-[width] duration-500" style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
};

interface GaugeWidgetProps {
  risk: number | null;
  burstiness: number | null;
  lexicalRichness: number | null;
  /** Légende affichée tant qu'aucun score n'est disponible. */
  placeholder: string;
  alertCount: number;
}

export const GaugeWidget: React.FC<GaugeWidgetProps> = ({ risk, burstiness, lexicalRichness, placeholder, alertCount }) => {
  const tone = riskTone(risk ?? 0);
  return (
    <div className="flex shrink-0 items-center gap-4 border-y border-[#382f22] py-4">
      <div
        className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full border-2 border-[#8f6e2b]/70 bg-[#13110f] shadow-[inset_0_0_18px_rgba(0,0,0,0.9),0_0_18px_rgba(212,175,55,0.16)] transition-[background-image] duration-500"
        style={{ backgroundImage: `conic-gradient(${tone.color} ${risk ?? 0}%, #29231a 0)` }}
        role="img"
        aria-label={`Risque IA : ${risk ?? 0} pour cent`}
      >
        <span className="flex h-[74px] w-[74px] items-center justify-center rounded-full bg-[#13110f] font-cinzel text-lg tabular-nums" style={{ color: tone.color }}>
          {risk ?? "—"}<span className="text-[11px]">{risk === null ? "" : " %"}</span>
        </span>
      </div>
      <div className="min-w-0 flex-1 space-y-2">
        <div>
          <p className="font-cinzel text-xs tracking-widest text-[#d4af37] uppercase">Risque de détection IA</p>
          <p className="mt-0.5 font-sans text-sm" style={{ color: risk === null ? "#e2dbce" : tone.color }}>
            {risk === null ? placeholder : `${tone.label} · ${alertCount} alerte${alertCount > 1 ? "s" : ""} active${alertCount > 1 ? "s" : ""}`}
          </p>
        </div>
        <MicroMetric label="Rythme & Souffle (Burstiness)" value={burstiness} />
        <MicroMetric label="Empreinte syntaxique / Perplexité" value={lexicalRichness} />
      </div>
    </div>
  );
};
