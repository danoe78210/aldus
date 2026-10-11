import React, { useMemo, useState } from "react";
import { Feather, Info } from "lucide-react";
import { useStudio } from "./StudioContext";
import { CorrectorView } from "./CorrectorView";
import { ProofTabToggle } from "./proof/ProofTabToggle";
import { anomaliesOfFolio, buildProofFolio, showSpaces } from "../utils/proofLayout";
import {
  ALL_RULES,
  FAMILY_COLOR,
  FAMILY_LABEL,
  SEVERITY_COLOR,
  analyzeTypography,
  type TypographySeverity,
} from "../utils/typographyEngine";

/** Signe de correcteur traditionnel selon la gravité. */
const CORRECTOR_SIGN: Record<TypographySeverity, string> = {
  critical: "✗",
  advice: "+",
  minor: "~",
};

/** Gravité humanisée (sous-libellé des cartes de règles). */
const SEVERITY_WORD: Record<TypographySeverity, string> = {
  critical: "critique",
  advice: "style",
  minor: "mineur",
};

/**
 * **Page droite du Correcteur** — porte la même bascule d'en-tête que la page
 * gauche (état partagé) et déploie la page droite du diptyque actif :
 *
 * * **Feuillet VII — Les Règles Analysées** : la grille aérée des règles
 *   activables (sur toute la largeur de la page, deux colonnes bien espacées),
 *   cases à cocher en or antique sur fond d'ébène, libellé bistre chaud. Le
 *   réglage est partagé : l'analyse « Indice de Pureté » (page gauche) suit le
 *   filtre désigné ici.
 * * **Feuillet VIII — Conseils de l'Imprimeur** : liste défilante discrète
 *   (barre sombre) des signalements du feuillet actif, avec correctif unitaire
 *   `[ Corriger ]` et explication de la règle `[ Règle ]` ; la bascule
 *   `[ Relecture linguistique ]` conserve l'épreuve LanguageTool
 *   (`CorrectorView`).
 *
 * Le pupitre de lecture (sélecteur, pagination, grand feuillet vélin) siège sur
 * la page gauche — `ProofExaminer.tsx`.
 */
export const ProofWorkbench: React.FC = () => {
  const {
    proofTab,
    onProofTabChange,
    proofEnabledRules,
    onToggleProofRule,
    proofText,
    proofPage,
    applyProofAnomaly,
  } = useStudio();

  const [mode, setMode] = useState<"face" | "linguistic">("face");
  const [adviceId, setAdviceId] = useState<string | null>(null);

  const report = useMemo(
    () => analyzeTypography(proofText, proofEnabledRules),
    [proofText, proofEnabledRules],
  );
  const folio = useMemo(() => buildProofFolio(proofText, proofPage, false), [proofText, proofPage]);
  const anomaliesOfPage = useMemo(
    () => anomaliesOfFolio(report.anomalies, folio.currentLines),
    [report.anomalies, folio.currentLines],
  );

  /* Bascule secondaire — relecture linguistique (LanguageTool) : l'épreuve
     typographique cède la page droite à l'éditeur décoré in-situ. */
  if (mode === "linguistic") {
    return (
      <div className="animate-ink-reveal flex h-full min-h-0 flex-col overflow-hidden">
        <div className="mb-3 shrink-0">
          <ProofTabToggle tab={proofTab} onChange={onProofTabChange} />
          <div className="mt-2.5 flex justify-end">
            <button
              type="button"
              onClick={() => setMode("face")}
              className="rounded-xs border border-[#2a2c33] bg-[#0f0e0d] px-3 py-1.5 font-serif text-[10px] tracking-widest text-[#9e9587] uppercase transition-colors hover:border-[#8f6e2b] hover:text-[#c5a059]"
            >
              [ Conseils de l&rsquo;Imprimeur ]
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1">
          <CorrectorView />
        </div>
      </div>
    );
  }

  if (proofTab === "purete") {
    /* ═══════ Feuillet VII — Les Règles Analysées (volet droit) ═══════ */
    return (
      <div className="animate-ink-reveal flex h-full min-h-0 flex-col overflow-hidden">
        <div className="mb-2 shrink-0">
          <ProofTabToggle tab={proofTab} onChange={onProofTabChange} />
        </div>

        <h3 className="font-cinzel text-sm uppercase tracking-widest text-[#d4af37] border-b border-[#382f22] pb-2 mb-5">
          Les Règles Analysées
        </h3>

        <div className="min-h-0 flex-1">
          <div className="grid gap-3 sm:grid-cols-2">
            {ALL_RULES.map((rule) => {
              const enabled = proofEnabledRules.includes(rule.id);
              const count = report.anomalies.filter((anomaly) => anomaly.rule === rule.id).length;
              return (
                <label
                  key={rule.id}
                  className={`flex items-start gap-2.5 rounded-xs border p-2.5 transition-colors ${
                    enabled
                      ? "border-[#8f6e2b]/60 bg-[#141210]"
                      : "border-[#3a3022]/60 bg-[#141210]/70 opacity-55 hover:border-[#8f6e2b]/40 hover:opacity-80"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={() => onToggleProofRule(rule.id)}
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-[#d4af37]"
                  />
                  <span className="min-w-0 flex-1">
                    <span
                      className="block font-serif text-[11px] text-[#e2dbce]"
                      style={enabled ? { color: FAMILY_COLOR[rule.family] } : undefined}
                    >
                      {rule.label}
                    </span>
                    <span className="mt-0.5 block font-mono text-[9px] tracking-wider text-[#786c59]">
                      {FAMILY_LABEL[rule.family]} · {SEVERITY_WORD[rule.severity]}
                    </span>
                  </span>
                  {count > 0 ? (
                    <span className="shrink-0 rounded-full border border-[#8f6e2b]/50 px-1.5 font-mono text-[10px] text-[#c5a059] tabular-nums">
                      {count}
                    </span>
                  ) : null}
                </label>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  /* ═══════ Feuillet VIII — Conseils de l'Imprimeur (volet droit) ═══════ */
  return (
    <div className="animate-ink-reveal flex h-full min-h-0 flex-col overflow-hidden">
      <div className="mb-2 shrink-0">
        <ProofTabToggle tab={proofTab} onChange={onProofTabChange} />
        <div className="mt-2.5 flex shrink-0 justify-end">
          <button
            type="button"
            onClick={() => setMode("linguistic")}
            className="rounded-xs border border-[#2a2c33] bg-[#0f0e0d] px-3 py-1.5 font-serif text-[10px] tracking-widest text-[#9e9587] uppercase transition-colors hover:border-[#8f6e2b] hover:text-[#c5a059]"
          >
            [ Relecture linguistique ]
          </button>
        </div>
      </div>

      <h3 className="font-cinzel text-sm uppercase tracking-widest text-[#d4af37] border-b border-[#382f22] pb-2 mb-4">
        Conseils de l&rsquo;Imprimeur
      </h3>

      {/* Liste défilante discrète des signalements du feuillet actif */}
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden proof-scroll-dark pr-1">
        {proofText === "" ? (
          <p className="font-serif text-[11px] italic text-[#786c59]">
            Sélectionnez un chapitre (pupitre de lecture) pour composer les conseils.
          </p>
        ) : anomaliesOfPage.length === 0 ? (
          <p className="font-serif text-[11px] italic text-[#786c59]">
            Feuillet sans anomalie : la composition est pure.
          </p>
        ) : (
          <ul className="space-y-2">
            {anomaliesOfPage.map((anomaly) => (
              <li key={anomaly.id}>
                <div
                  className="rounded-xs border border-[#2c2414]/70 bg-[#0f0c0a] p-2"
                  style={{ borderLeft: `3px solid ${SEVERITY_COLOR[anomaly.severity]}` }}
                >
                  <p className="flex items-baseline gap-2">
                    <span className="font-mono text-[10px] text-[#9e9587] tabular-nums">
                      L.{anomaly.line}
                    </span>
                    <span className="font-serif text-[11px] font-medium" style={{ color: SEVERITY_COLOR[anomaly.severity] }}>
                      {CORRECTOR_SIGN[anomaly.severity]} {anomaly.label}
                    </span>
                  </p>
                  <p className="mt-0.5 font-mono text-[10px] text-[#786c59]">
                    {showSpaces(anomaly.found)} → {showSpaces(anomaly.replacement) || "∅"}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => applyProofAnomaly(anomaly)}
                      title="Imposer ce seul correctif"
                      className="rounded-xs border border-[#3a3022] px-2 py-1 font-serif text-[10px] tracking-wider text-[#eedcb8] uppercase transition-colors hover:border-[#ffd700] hover:text-[#ffd700]"
                    >
                      <Feather size={11} className="mr-1 inline" />
                      Corriger
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdviceId(adviceId === anomaly.id ? null : anomaly.id)}
                      aria-expanded={adviceId === anomaly.id}
                      title="Règle de l'Imprimerie nationale"
                      className="rounded-xs border border-[#3a3022] px-2 py-1 font-mono text-[10px] tracking-wider text-[#9e9587] uppercase transition-colors hover:text-[#c5a059]"
                    >
                      <Info size={11} className="mr-1 inline" />
                      Règle
                    </button>
                  </div>
                  {adviceId === anomaly.id && (
                    <p className="mt-1.5 font-serif text-[10px] italic leading-relaxed text-[#c9bea9]">
                      {anomaly.advice}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};