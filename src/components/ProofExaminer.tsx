import React, { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Feather, Loader2, RefreshCw, ScrollText, Stamp } from "lucide-react";
import { useStudio } from "./StudioContext";
import { ProofTabToggle } from "./proof/ProofTabToggle";
import { ProofReader } from "./proof/ProofReader";
import { buildProofFolio } from "../utils/proofLayout";
import {
  ALL_RULES,
  FAMILY_COLOR,
  FAMILY_LABEL,
  analyzeTypography,
  type TypographyFamily,
} from "../utils/typographyEngine";

/** Familles présentées en cartouches d'inventaire (page gauche du Feuillet VII). */
const CARD_FAMILIES: TypographyFamily[] = ["punctuation", "dialogue", "letters", "numbers", "hygiene"];

/**
 * **Page gauche du Correcteur** — porte la bascule d'en-tête (partagée avec la
 * page droite du livre) et déploie l'un des deux diptyques in-folio :
 *
 * * **Feuillet VII — Indice de Pureté** : sceau d'intégrité (jauge circulaire),
 *   cartouche de synthèse (mots, anomalies, gravités), inventaire des règles par
 *   famille, et les ordres majeurs `[ Imposer l'Usage Typographique Aldin › ]`
 *   et `[ Consigner le chapitre au registre ]` (la grille des règles activables,
 *   « Les Règles Analysées », siège sur la page droite).
 * * **Feuillet VIII — Banc d'Épreuve** : pupitre de lecture (sélecteur de
 *   chapitre stylisé en laiton, `[ Recharger ]`, pagination de feuillet, filtre
 *   « feuillets à anomalies ») et **grand feuillet de lecture** en vélin chaud,
 *   texte aéré en Garamond 16 px avec surlignages discrets à l'encre.
 *
 * Le moteur est `src/utils/typographyEngine.ts` ; les conseils de l'Imprimeur
 * sont composés sur la page droite du Feuillet VIII (`ProofWorkbench.tsx`).
 */
export const ProofExaminer: React.FC = () => {
  const {
    chapterFiles,
    proofTab,
    onProofTabChange,
    proofEnabledRules,
    proofChapter,
    proofText,
    proofLoading,
    proofError,
    loadProofChapter,
    proofPage,
    setProofPage,
    proofOnlyAnomalies,
    setProofOnlyAnomalies,
    imposeProofUsage,
    persistProofChapter,
    saveProofRevisions,
    activeAnomalyId,
  } = useStudio();

  const report = useMemo(
    () => analyzeTypography(proofText, proofEnabledRules),
    [proofText, proofEnabledRules],
  );
  const folio = useMemo(
    () => buildProofFolio(proofText, proofPage, proofOnlyAnomalies, report.anomalies),
    [proofText, proofPage, proofOnlyAnomalies, report.anomalies],
  );

  // Survol : voile doré discret sur les anomalies du grand feuillet de lecture.
  const [hovered, setHovered] = useState<string | null>(null);

  const severityOf = report.bySeverity;

  return (
    <div className="animate-ink-reveal flex h-full w-full min-h-0 flex-col justify-between overflow-y-auto proof-scroll-dark px-2 pr-1">
      {/* Bascule d'en-tête — les deux diptyques autonomes du Correcteur */}
      <div className="mb-4 shrink-0">
        <ProofTabToggle tab={proofTab} onChange={onProofTabChange} />
        <h2 className="mt-3 shrink-0 text-center font-cinzel text-sm sm:text-base tracking-[0.25em] text-[#d4af37] uppercase">
          {proofTab === "purete" ? "VII. Indice de Pureté" : "VIII. Le Banc d'Épreuve"}
        </h2>
      </div>

      {proofTab === "purete" ? (
        /* ═══════ Feuillet VII — Indice de Pureté (volet gauche) ═══════ */
        <>
          {/* [1] Sélecteur de chapitre — même pupitre que le banc : le changement de
              chapitre met immédiatement à jour l'indice, les anomalies et la
              jauge, tout en restant synchronisé avec le Feuillet VIII. */}
          <div className="mb-3 flex shrink-0 flex-wrap items-center gap-2">
            <ScrollText size={14} className="shrink-0 text-[#8f6e2b]" />
            <select
              value={proofChapter}
              onChange={(event) => void loadProofChapter(event.target.value)}
              disabled={proofLoading}
              aria-label="Chapitre examiné"
              className="h-9 min-w-0 flex-1 rounded-xs border border-[#3a3022] bg-[#13110f] px-3 font-serif text-sm text-[#f5efe4] focus:border-[#d4af37] focus:outline-none"
            >
              <option value="">Choisir un chapitre…</option>
              {chapterFiles.map((file) => (
                <option key={file} value={file}>
                  {file}
                </option>
              ))}
            </select>
            {proofLoading && <Loader2 size={14} className="animate-spin text-[#c5a059]" />}
          </div>
          {proofError && (
            <p className="mb-3 shrink-0 border border-[#a83232]/50 bg-[#a83232]/10 px-3 py-2 font-serif text-xs text-[#a83232]">
              {proofError}
            </p>
          )}

          {/* [2] Sceau d'intégrité — jauge circulaire & cartouche de synthèse */}
          <div className="mb-4 flex shrink-0 items-center gap-5">
            <div
              className="relative flex h-[92px] w-[92px] shrink-0 items-center justify-center rounded-full border-2 border-[#8f6e2b]/60 bg-[#13110f] shadow-[inset_0_0_18px_rgba(0,0,0,0.9),0_0_18px_rgba(212,175,55,0.18)]"
              role="img"
              aria-label={`Indice de pureté typographique : ${report.purity} pour cent`}
            >
              <span className="absolute inset-1.5 rounded-full border border-[#8f6e2b]/30" aria-hidden />
              <span
                className="font-cinzel text-lg text-[#d4af37] tabular-nums"
                style={{ textShadow: "0 1px 2px rgba(0,0,0,0.8)" }}
              >
                {report.purity}
                <span className="font-cinzel text-[11px]"> %</span>
              </span>
              <Stamp size={11} className="absolute bottom-3 text-[#8f6e2b]" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-cinzel text-xs uppercase tracking-widest text-[#d4af37]">
                Indice de pureté
              </p>
              <p className="mt-1 font-serif text-[12px] text-[#c9bea9]">
                {proofText === ""
                  ? "Aucun chapitre chargé"
                  : report.total === 0
                    ? `${report.words.toLocaleString("fr-FR")} mots : la composition est pure`
                    : `${report.words.toLocaleString("fr-FR")} mots · ${report.total} anomalies`}
              </p>
              {proofText !== "" && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <span className="rounded-xs border border-[#5c2424] bg-[#2a1414] px-2 py-0.5 font-mono text-[11px] leading-none text-[#c25454] tabular-nums">
                    {severityOf.critical} critiques
                  </span>
                  <span className="rounded-xs border border-[#5c4618] bg-[#241c10] px-2 py-0.5 font-mono text-[11px] leading-none text-[#d4af37] tabular-nums">
                    {severityOf.advice} de style
                  </span>
                  <span className="rounded-xs border border-[#383228] bg-[#1a1714] px-2 py-0.5 font-mono text-[11px] leading-none text-[#8c8270] tabular-nums">
                    {severityOf.minor} mineures
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* [3] Grille des anomalies par catégorie */}
          <div className="mb-4 grid gap-2.5 sm:grid-cols-2">
            {CARD_FAMILIES.map((family) => {
              const count = report.byFamily[family];
              const rules = ALL_RULES.filter(
                (rule) => rule.family === family && report.anomalies.some((a) => a.rule === rule.id),
              );
              return (
                <div
                  key={family}
                  className="shrink-0 rounded-xs border border-[#3a3022]/70 bg-[#13110f]/60 p-2.5"
                  style={{ borderLeft: `3px solid ${FAMILY_COLOR[family]}` }}
                >
                  <p className="flex items-baseline justify-between gap-2">
                    <span className="font-cinzel text-[11px] uppercase tracking-wider text-[#d4af37]">
                      {FAMILY_LABEL[family]}
                    </span>
                    <span className="font-mono text-[12px] font-semibold text-[#f5efe4] tabular-nums">{count}</span>
                  </p>
                  {rules.length > 0 ? (
                    <ul className="mt-1 space-y-0.5">
                      {rules.map((rule) => (
                        <li key={rule.id} className="flex items-baseline justify-between gap-2">
                          <span className="font-serif text-[12px] text-[#e2dbce]">{rule.label}</span>
                          <span className="font-mono text-[11px] text-[#9e9587] tabular-nums">
                            {report.anomalies.filter((a) => a.rule === rule.id).length}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 font-serif text-[11px] italic text-[#8f8373]">
                      Aucune anomalie.
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          {/* [4] Ordres solennels d'atelier */}
          <div className="shrink-0">
            <button
              type="button"
              onClick={imposeProofUsage}
              disabled={proofText === ""}
              className="w-full border border-[#8f6e2b]/60 bg-linear-to-b from-[#2e1d0f] to-[#170f07] py-2.5 font-cinzel text-xs tracking-wider text-[#eedcb8] uppercase shadow-xl transition-all hover:border-[#ffd700] hover:text-[#ffd700] hover:shadow-[0_0_20px_rgba(212,175,55,0.25)] active:scale-[0.99] disabled:opacity-40"
            >
              <Feather size={13} className="mr-2 inline" />
              [ Imposer l&rsquo;Usage Typographique Aldin &rsaquo; ]
            </button>
            <button
              type="button"
              onClick={() => void persistProofChapter()}
              disabled={proofText === "" || proofChapter === ""}
              className="mt-2 w-full border border-[#3a3022] py-1.5 font-cinzel text-[11px] tracking-widest text-[#8f8373] uppercase transition-colors hover:text-[#d4af37] disabled:opacity-40"
            >
              [ Consigner le chapitre au registre ]
            </button>
          </div>
        </>
      ) : (
        /* ═══════ Feuillet VIII — Le Banc d'Épreuve (volet gauche) ═══════ */
        <>
          {/* [1] Pupitre : sélecteur de chapitre en laiton & rechargement */}
          <div className="mb-3 flex shrink-0 flex-wrap items-center gap-2">
            <ScrollText size={14} className="shrink-0 text-[#8f6e2b]" />
            <select
              value={proofChapter}
              onChange={(event) => void loadProofChapter(event.target.value)}
              disabled={proofLoading}
              aria-label="Chapitre mis en épreuve"
              className="h-9 min-w-0 flex-1 rounded-xs border border-[#3a3022] bg-[#13110f] px-3 font-serif text-sm text-[#f5efe4] focus:border-[#d4af37] focus:outline-none"
            >
              <option value="">Choisir un chapitre…</option>
              {chapterFiles.map((file) => (
                <option key={file} value={file}>
                  {file}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void loadProofChapter(proofChapter)}
              disabled={proofChapter === "" || proofLoading}
              title="Reprendre le texte du chapitre (après correction sur l'autre feuillet)"
              className="rounded-xs border border-[#3a3022] px-2.5 py-1.5 font-mono text-[11px] tracking-widest text-[#9e9587] uppercase transition-colors hover:text-[#c5a059] disabled:opacity-40"
            >
              <RefreshCw size={12} className="mr-1 inline" />
              Recharger
            </button>
            {proofLoading && <Loader2 size={14} className="animate-spin text-[#c5a059]" />}
          </div>
          {proofError && (
            <p className="mb-3 shrink-0 border border-[#a83232]/50 bg-[#a83232]/10 px-3 py-2 font-serif text-xs text-[#a83232]">
              {proofError}
            </p>
          )}

          {/* [2] Pagination de feuillet */}
          <div className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-2 border-y border-[#382f22] py-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setProofPage(Math.max(1, folio.safePage - 1))}
                disabled={folio.safePage <= 1}
                className="rounded-xs border border-[#3a3022] px-2 py-1 font-serif text-[11px] tracking-widest text-[#c9bea9] uppercase transition-colors hover:text-[#ffd700] disabled:opacity-40"
              >
                <ChevronLeft size={12} className="mr-1 inline" />
                Feuillet précédent
              </button>
              <span className="font-mono text-[11px] text-[#9e9587] tabular-nums">
                Feuillet {folio.safePage} sur {Math.max(1, folio.visiblePages.length)}
              </span>
              <button
                type="button"
                onClick={() => setProofPage(Math.min(folio.visiblePages.length, folio.safePage + 1))}
                disabled={folio.safePage >= folio.visiblePages.length}
                className="rounded-xs border border-[#3a3022] px-2 py-1 font-serif text-[11px] tracking-widest text-[#c9bea9] uppercase transition-colors hover:text-[#ffd700] disabled:opacity-40"
              >
                Feuillet suivant
                <ChevronRight size={12} className="ml-1 inline" />
              </button>
            </div>
            <label className="flex items-center gap-2 font-serif text-[11px] text-[#c9bea9]">
              <input
                type="checkbox"
                checked={proofOnlyAnomalies}
                onChange={(event) => {
                  setProofOnlyAnomalies(event.target.checked);
                  setProofPage(1);
                }}
                className="h-4 w-4 accent-[#d4af37]"
              />
              Afficher uniquement les feuillets contenant des anomalies
            </label>
          </div>

          {/* [3] Grand feuillet de lecture au papier/vélin chaud (16 px aéré) */}
          <ProofReader
            text={proofText}
            report={report}
            currentLines={folio.currentLines}
            hovered={hovered}
            activeAnomalyId={activeAnomalyId}
            onSave={saveProofRevisions}
            onHover={setHovered}
          />
        </>
      )}
    </div>
  );
};