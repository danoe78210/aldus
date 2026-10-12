import React from "react";
import type { ProofTab } from "../StudioContext";

/** Feuillets proposés par la bascule d'en-tête du Correcteur (diptyques VII & VIII). */
const PROOF_TABS: { id: ProofTab; label: string }[] = [
  { id: "purete", label: "VII. Indice de Qualité Typographique" },
  { id: "banc", label: "VIII. Le Banc d'Épreuve" },
];

interface ProofTabToggleProps {
  /** Feuillet actuellement déployé par la bascule. */
  tab: ProofTab;
  /** Bascule du diptyque (émise par la page gauche ou la page droite du livre). */
  onChange: (tab: ProofTab) => void;
}

/**
 * **Bascule d'en-tête du Correcteur** — même modèle que le marbre de montage de
 * la couverture (`[ Épreuve à plat 2D ] | [ Volume relié 3D ]`) : l'état est
 * partagé entre la page gauche et la page droite du livre, qui basculent de
 * concert entre le Feuillet VII (Indice de Qualité Typographique) et le Feuillet VIII
 * (Banc d'Épreuve).
 */
export const ProofTabToggle: React.FC<ProofTabToggleProps> = ({ tab, onChange }) => (
  <div
    role="group"
    aria-label="Feuillets du Correcteur"
    className="grid shrink-0 grid-cols-2 gap-2 border-b border-[#382f22] pb-2.5"
  >
    {PROOF_TABS.map(({ id, label }) => {
      const active = tab === id;
      return (
        <button
          key={id}
          type="button"
          onClick={() => onChange(id)}
          aria-current={active ? "page" : undefined}
          className={`rounded-xs border px-2 py-2 text-center font-serif text-[11px] tracking-widest uppercase transition-colors ${
            active
              ? "border-[#d4af37] bg-[#221b14] text-[#f3e5ab]"
              : "border-[#382f22] bg-[#0f0e0d] text-[#a89f91] hover:border-[#8f6e2b] hover:text-[#c5a059]"
          }`}
        >
          [ {label} ]
        </button>
      );
    })}
  </div>
);