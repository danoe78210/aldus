import React, { useMemo, useState } from "react";
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

/** Règles composées par feuillet des « Règles Analysées » (18 règles / 6 par page). */
const RULES_PER_PAGE = 6;
/** Feuillets de la pagination des règles. */
const TOTAL_RULES_FOLIOS = 3;

/**
 * **Page droite du Correcteur** — la bascule d'en-tête vit désormais sur la
 * page gauche (`ProofExaminer.tsx`) ; ici, chaque feuillet s'ouvre directement
 * sur son titre :
 *
 * * **Feuillet VII — Les Règles Analysées** : colonne unique pleine largeur des
 *   règles activables, **paginée sur trois feuillets de six règles** (cartes
 *   `min-h-[58px]`, coche or antique, libellé bistre). Le réglage est partagé :
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
    activeAnomalyId,
    setActiveAnomalyId,
  } = useStudio();

  const [mode, setMode] = useState<"face" | "linguistic">("face");
  const [adviceId, setAdviceId] = useState<string | null>(null);
  // Pagination des « Règles Analysées » : colonne unique sur trois feuillets.
  const [rulesPage, setRulesPage] = useState<1 | 2 | 3>(1);

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
    const currentRules = ALL_RULES.slice(
      (rulesPage - 1) * RULES_PER_PAGE,
      rulesPage * RULES_PER_PAGE,
    );
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

          {/* Paginator d'Atelier — trois feuillets de six règles */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setRulesPage((page) => Math.max(1, page - 1) as 1 | 2 | 3)}
              disabled={rulesPage === 1}
              className="px-2.5 py-1 rounded-xs border border-[#382f22] bg-[#141210] font-cinzel text-xs text-[#d4af37] hover:border-[#8f6e2b] disabled:opacity-25 disabled:cursor-not-allowed transition-all"
              title="Feuillet précédent"
              aria-label="Feuillet précédent des règles"
            >
              ‹
            </button>
            <span className="px-1.5 font-cinzel text-xs uppercase tracking-wider text-[#c9bea9]">
              Feuillet {rulesPage} sur {TOTAL_RULES_FOLIOS}
            </span>
            <button
              type="button"
              onClick={() => setRulesPage((page) => Math.min(TOTAL_RULES_FOLIOS, page + 1) as 1 | 2 | 3)}
              disabled={rulesPage === TOTAL_RULES_FOLIOS}
              className="px-2.5 py-1 rounded-xs border border-[#382f22] bg-[#141210] font-cinzel text-xs text-[#d4af37] hover:border-[#8f6e2b] disabled:opacity-25 disabled:cursor-not-allowed transition-all"
              title="Feuillet suivant"
              aria-label="Feuillet suivant des règles"
            >
              ›
            </button>
          </div>
        </div>

        {/* Colonne unique — une page tient naturellement en hauteur, sans ascenseur */}
        <div className="min-h-0 flex-1">
          <div className="flex flex-col gap-3">
            {currentRules.map((rule) => {
              const enabled = proofEnabledRules.includes(rule.id);
              const count = report.anomalies.filter((anomaly) => anomaly.rule === rule.id).length;
              return (
                <label
                  key={rule.id}
                  className="w-full min-h-[58px] px-4 py-3 rounded-xs border border-[#382f22] bg-[#161310] flex items-center justify-between gap-4 transition-all hover:border-[#8f6e2b] hover:bg-[#1a1612]"
                  style={enabled ? undefined : { opacity: 0.55 }}
                >
                  {/* Zone gauche : case à cocher + intitulé & catégorie */}
                  <span className="flex min-w-0 flex-1 items-center gap-3.5">
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={() => onToggleProofRule(rule.id)}
                      aria-label={rule.label}
                      className="h-4 w-4 shrink-0 cursor-pointer rounded-xs border-[#6b5327] bg-[#120f0c] accent-[#d4af37]"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-serif text-sm font-medium leading-snug text-[#f5efe4]">
                        {rule.label}
                      </span>
                      <span className="mt-0.5 block font-serif text-xs text-[#8f8373]">
                        {FAMILY_LABEL[rule.family]} ·{" "}
                        <span style={{ color: SEVERITY_COLOR[rule.severity] }}>
                          {SEVERITY_WORD[rule.severity]}
                        </span>
                      </span>
                    </span>
                  </span>

                  {/* Zone droite : badge d'anomalies */}
                  {count > 0 && (
                    <span className="shrink-0 min-w-[28px] px-2 py-0.5 rounded-xs border border-[#5a4f3f] bg-[#1c1813] font-mono text-xs font-semibold text-[#d4af37] text-center tabular-nums shadow-xs">
                      {count}
                    </span>
                  )}
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
                  <div className="mt-3 flex items-center gap-2 pt-2 border-t border-[#2a241c]">
                    {/* Bouton Localiser — surbrillance or vénitien dans le feuillet */}
                    <button
                      type="button"
                      onClick={() => setActiveAnomalyId(activeAnomalyId === anomaly.id ? null : anomaly.id)}
                      className={`px-2.5 py-1 rounded-xs border font-cinzel text-[11px] tracking-wider uppercase flex items-center gap-1.5 transition-all cursor-pointer ${
                        activeAnomalyId === anomaly.id
                          ? "border-[#d4af37] bg-[#2d2212] text-[#f3e5ab] shadow-[0_0_10px_rgba(212,175,55,0.3)]"
                          : "border-[#382f22] bg-[#141210] text-[#c9bea9] hover:border-[#8f6e2b] hover:text-[#d4af37]"
                      }`}
                      title="Localiser et surligner l'anomalie dans le feuillet"
                    >
                      <span className="text-xs">⌖</span>
                      <span>Localiser</span>
                    </button>

                    {/* Bouton Corriger — correctif unitaire */}
                    <button
                      type="button"
                      onClick={() => applyProofAnomaly(anomaly)}
                      className="px-2.5 py-1 rounded-xs border border-[#382f22] bg-[#141210] font-cinzel text-[11px] tracking-wider uppercase text-[#c9bea9] hover:border-[#8f6e2b] hover:text-[#d4af37] flex items-center gap-1.5 transition-all cursor-pointer"
                      title="Imposer ce seul correctif"
                    >
                      <span className="text-xs">✒</span>
                      <span>Corriger</span>
                    </button>

                    {/* Bouton Règle — explication de l'Imprimerie nationale */}
                    <button
                      type="button"
                      onClick={() => setAdviceId(adviceId === anomaly.id ? null : anomaly.id)}
                      aria-expanded={adviceId === anomaly.id}
                      className="px-2.5 py-1 rounded-xs border border-[#2a2218] bg-transparent font-cinzel text-[11px] tracking-wider uppercase text-[#8f8373] hover:text-[#c9bea9] flex items-center gap-1 transition-all cursor-pointer"
                      title="Règle de l'Imprimerie nationale"
                    >
                      <span className="text-xs">ⓘ</span>
                      <span>Règle</span>
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