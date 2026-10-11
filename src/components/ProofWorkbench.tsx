import React, { useMemo, useState } from "react";
import { Feather, Info } from "lucide-react";
import { useStudio } from "./StudioContext";
import { CorrectorView } from "./CorrectorView";
import { anomaliesOfFolio, buildProofFolio, showSpaces } from "../utils/proofLayout";
import {
  ALL_RULES,
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
 * **Page droite du Correcteur** — la bascule d'en-tête vit désormais sur la
 * page gauche (`ProofExaminer.tsx`) ; ici, chaque feuillet s'ouvre directement
 * sur son titre :
 *
 * * **Feuillet VII — Les Règles Analysées** : grille aérée à deux colonnes des
 *   règles activables, **paginée sur deux feuillets de neuf règles** (cartes
 *   `min-h-[66px]`, coche or antique, libellé bistre). Le réglage est partagé :
 *   l'analyse « Indice de Pureté » (page gauche) suit le filtre désigné ici.
 * * **Feuillet VIII — Conseils de l'Imprimeur** : liste défilante sombre des
 *   signalements du feuillet actif, correctif unitaire `[ Corriger ]` et
 *   explication `[ Règle ]` ; la bascule `[ Relecture linguistique ]` conserve
 *   l'épreuve LanguageTool (`CorrectorView`).
 *
 * Le pupitre de lecture (sélecteur, pagination, grand feuillet vélin) siège sur
 * la page gauche — `ProofExaminer.tsx`.
 */
export const ProofWorkbench: React.FC = () => {
  const {
    proofTab,
    proofEnabledRules,
    onToggleProofRule,
    proofText,
    proofPage,
    applyProofAnomaly,
  } = useStudio();

  const [mode, setMode] = useState<"face" | "linguistic">("face");
  const [adviceId, setAdviceId] = useState<string | null>(null);
  // Pagination des « Règles Analysées » : deux feuillets de neuf règles.
  const [rulesPage, setRulesPage] = useState<1 | 2>(1);

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
        <div className="flex shrink-0 items-center justify-between border-b border-[#382f22] pb-3 mb-4">
          <h3 className="font-cinzel text-sm uppercase tracking-widest text-[#d4af37]">
            Relecture linguistique
          </h3>
          <button
            type="button"
            onClick={() => setMode("face")}
            className="shrink-0 rounded-xs border border-[#2a2c33] bg-[#0f0e0d] px-3 py-1.5 font-serif text-[11px] tracking-widest text-[#9e9587] uppercase transition-colors hover:border-[#8f6e2b] hover:text-[#c5a059]"
          >
            [ Conseils de l&rsquo;Imprimeur ]
          </button>
        </div>
        <div className="min-h-0 flex-1">
          <CorrectorView />
        </div>
      </div>
    );
  }

  if (proofTab === "purete") {
    /* ═══════ Feuillet VII — Les Règles Analysées (volet droit) ═══════ */
    const currentRules = ALL_RULES.slice((rulesPage - 1) * 9, rulesPage * 9);
    return (
      <div className="animate-ink-reveal flex h-full min-h-0 flex-col overflow-hidden">
        {/* Bandeau : titre, statut global & pupitre de pagination */}
        <div className="flex shrink-0 items-center justify-between border-b border-[#382f22] pb-3 mb-5">
          <div className="min-w-0">
            <h3 className="font-cinzel text-sm uppercase tracking-widest text-[#d4af37]">
              Les Règles Analysées
            </h3>
            <p className="mt-0.5 font-serif text-[11px] text-[#8f8373]">
              {proofEnabledRules.length} contrôles actifs au registre
            </p>
          </div>

          {/* Paginator d'Atelier — deux feuillets de neuf règles */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setRulesPage(1)}
              disabled={rulesPage === 1}
              className="px-2 py-1 rounded-xs border border-[#382f22] bg-[#141210] font-cinzel text-xs text-[#d4af37] hover:border-[#8f6e2b] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              title="Feuillet précédent"
              aria-label="Feuillet précédent des règles"
            >
              ‹
            </button>
            <span className="px-1 font-cinzel text-xs uppercase tracking-wider text-[#c9bea9]">
              Feuillet {rulesPage} sur 2
            </span>
            <button
              type="button"
              onClick={() => setRulesPage(2)}
              disabled={rulesPage === 2}
              className="px-2 py-1 rounded-xs border border-[#382f22] bg-[#141210] font-cinzel text-xs text-[#d4af37] hover:border-[#8f6e2b] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              title="Feuillet suivant"
              aria-label="Feuillet suivant des règles"
            >
              ›
            </button>
          </div>
        </div>

        {/* Grille paginée — une page tient naturellement en hauteur, sans ascenseur */}
        <div className="min-h-0 flex-1">
          <div className="grid grid-cols-2 gap-3.5">
            {currentRules.map((rule) => {
              const enabled = proofEnabledRules.includes(rule.id);
              const count = report.anomalies.filter((anomaly) => anomaly.rule === rule.id).length;
              return (
                <label
                  key={rule.id}
                  className="min-h-[66px] p-3.5 rounded-xs border border-[#382f22] bg-[#161310] flex items-center justify-between gap-3 transition-all hover:border-[#8f6e2b] hover:bg-[#1a1612]"
                  style={enabled ? undefined : { opacity: 0.55 }}
                >
                  <span className="flex min-w-0 items-start gap-3">
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={() => onToggleProofRule(rule.id)}
                      aria-label={rule.label}
                      className="mt-0.5 h-4 w-4 shrink-0 rounded-xs border-[#6b5327] bg-[#120f0c] accent-[#d4af37]"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block font-serif text-sm leading-snug font-medium text-[#f5efe4]">
                        {rule.label}
                      </span>
                      <span className="mt-1 block font-serif text-xs text-[#8f8373]">
                        {FAMILY_LABEL[rule.family]} · {SEVERITY_WORD[rule.severity]}
                      </span>
                    </span>
                  </span>
                  {count > 0 ? (
                    <span className="min-w-[26px] shrink-0 px-2 py-0.5 rounded-xs border border-[#5a4f3f] bg-[#1c1813] font-mono text-xs font-semibold text-[#d4af37] text-center tabular-nums">
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
      <div className="flex shrink-0 items-center justify-between border-b border-[#382f22] pb-3 mb-4">
        <h3 className="font-cinzel text-sm uppercase tracking-widest text-[#d4af37]">
          Conseils de l&rsquo;Imprimeur
        </h3>
        <button
          type="button"
          onClick={() => setMode("linguistic")}
          className="shrink-0 rounded-xs border border-[#2a2c33] bg-[#0f0e0d] px-3 py-1.5 font-serif text-[11px] tracking-widest text-[#9e9587] uppercase transition-colors hover:border-[#8f6e2b] hover:text-[#c5a059]"
        >
          [ Relecture linguistique ]
        </button>
      </div>

      {/* Liste défilante discrète des signalements du feuillet actif */}
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden proof-scroll-dark pr-1.5">
        {proofText === "" ? (
          <p className="font-serif text-[11px] italic text-[#8f8373]">
            Sélectionnez un chapitre (pupitre de lecture) pour composer les conseils.
          </p>
        ) : anomaliesOfPage.length === 0 ? (
          <p className="font-serif text-[11px] italic text-[#8f8373]">
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
                    <span className="font-mono text-[11px] text-[#9e9587] tabular-nums">
                      L.{anomaly.line}
                    </span>
                    <span
                      className="font-serif text-[12px] font-medium"
                      style={{ color: SEVERITY_COLOR[anomaly.severity] }}
                    >
                      {CORRECTOR_SIGN[anomaly.severity]} {anomaly.label}
                    </span>
                  </p>
                  <p className="mt-0.5 font-mono text-[11px] text-[#8f8373]">
                    {showSpaces(anomaly.found)} → {showSpaces(anomaly.replacement) || "∅"}
                  </p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => applyProofAnomaly(anomaly)}
                      title="Imposer ce seul correctif"
                      className="rounded-xs border border-[#3a3022] px-2 py-1 font-serif text-[11px] tracking-wider text-[#eedcb8] uppercase transition-colors hover:border-[#ffd700] hover:text-[#ffd700]"
                    >
                      <Feather size={11} className="mr-1 inline" />
                      Corriger
                    </button>
                    <button
                      type="button"
                      onClick={() => setAdviceId(adviceId === anomaly.id ? null : anomaly.id)}
                      aria-expanded={adviceId === anomaly.id}
                      title="Règle de l'Imprimerie nationale"
                      className="rounded-xs border border-[#3a3022] px-2 py-1 font-mono text-[11px] tracking-wider text-[#9e9587] uppercase transition-colors hover:text-[#c5a059]"
                    >
                      <Info size={11} className="mr-1 inline" />
                      Règle
                    </button>
                  </div>
                  {adviceId === anomaly.id && (
                    <p className="mt-1.5 font-serif text-[11px] italic leading-relaxed text-[#c9bea9]">
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