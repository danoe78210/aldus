import React, { useMemo } from "react";
import { AlertTriangle, BookOpen, Ruler, Scissors } from "lucide-react";
import { useStudio } from "./StudioContext";
import {
  KDP_MIN_PAGES,
  PAPER_COEFFICIENT_MM,
  PAPER_LABEL,
  SPINE_SAFETY_ZONE_MM,
  misplacedChapters,
  placeChapters,
  planCahiers,
  romanNumeral,
  sheetsOf,
  spineThicknessMm,
} from "../data/imposition";

/** Panneau de registre : titre de section en petites capitales dorées. */
const Panel: React.FC<{ title: string; icon: React.ReactNode; children: React.ReactNode }> = ({
  title,
  icon,
  children,
}) => (
  <section className="mb-7 border border-[#3a3022]/70 bg-[#13110f]/60 p-4">
    <h3 className="mb-3 flex items-center gap-2 border-b border-[#3a3022] pb-2 font-serif text-[11px] tracking-widest text-[#d4af37] uppercase">
      {icon}
      {title}
    </h3>
    {children}
  </section>
);

/** Ligne « libellé … valeur » du registre technique. */
const Row: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="flex items-baseline justify-between gap-3 py-1">
    <span className="font-serif text-xs text-[#c9bea9]">{label}</span>
    <span className="font-mono text-xs text-[#e2dbce] tabular-nums">{value}</span>
  </div>
);

/**
 * **Feuillet VI — Imposition & Calibrage KDP** (page de droite de l'onglet
 * Organisation) : répartition en cahiers, épaisseur de dos, zones de sécurité
 * et détection d'anomalies de mise en page.
 *
 * La pagination mesurée par Typst prévaut sur l'estimation au volume de mots.
 * `src/data/imposition.ts` est le miroir frontend de
 * `src-tauri/src/kdp.rs` et `cover/geometry.rs`.
 */
export const ImpositionPanel: React.FC = () => {
  const { structure, cover, bookPagination, paginationError } = useStudio();

  const chapters = useMemo(
    () => structure.filter((item) => item.type === "chapter"),
    [structure],
  );

  const totalPages = bookPagination?.pageCount ?? 0;
  const bindingPages = totalPages + totalPages % 2;
  const spineMm = spineThicknessMm(bindingPages, cover.paperType);
  const cahiers = planCahiers(totalPages);
  const placements = useMemo(
    () => placeChapters(structure, totalPages),
    [structure, totalPages],
  );
  const misplaced = misplacedChapters(placements);

  if (!bookPagination) {
    return <div className="mx-auto w-full max-w-2xl p-4 font-serif text-sm text-[#9e9587]">
      <h2 className="mb-6 text-center text-lg tracking-[0.25em] text-[#d4af37] uppercase">
        VI. Imposition &amp; Calibrage KDP
      </h2>
      {paginationError ? <p role="alert" className="text-[#c25454]">{paginationError}</p>
        : <p>Pagination en attente du calcul natif du manuscrit.</p>}
    </div>;
  }

  // Schéma proportionnel de la tranche : largeur du dos + zones de sécurité.
  const schemaWidthMm = spineMm + 2 * SPINE_SAFETY_ZONE_MM;
  const safeRatio = schemaWidthMm > 0 ? SPINE_SAFETY_ZONE_MM / schemaWidthMm : 0;

  return (
    <div className="animate-ink-reveal mx-auto flex h-full w-full max-w-2xl flex-col overflow-y-auto px-2 pr-1">
      <h2 className="mb-6 text-center font-serif text-lg tracking-[0.25em] text-[#d4af37] uppercase">
        VI. Imposition &amp; Calibrage KDP
      </h2>
      <Panel title="Pagination de référence" icon={<BookOpen size={13} />}>
        <Row label="Pagination du manuscrit" value={
          bookPagination ? <span className="inline-flex items-center gap-2">
            {bookPagination.isMeasured && <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[#80946c]" />}
            {bookPagination.isMeasured ? "" : "~"}{totalPages} pages ({bookPagination.isMeasured ? "mesurées" : "estimées"})
          </span> : "Pagination indisponible"
        } />
        {paginationError && <p role="alert" className="text-xs text-[#c25454]">{paginationError}</p>}
        {!bookPagination?.isMeasured && <p className="mt-2 font-serif text-xs text-[#9e9587]">
          Estimation à 250 mots par page, arrondie au pair. Composez l'aperçu PDF pour mesurer la pagination.
        </p>}
        <Row label="Feuillets" value={`${sheetsOf(totalPages)}`} />
        <Row label="Chapitres composés" value={`${chapters.length}`} />
        {bindingPages !== totalPages && <Row label="Bloc relié (page blanche de parité)" value={`${bindingPages} pages`} />}
      </Panel>

      <Panel title="Répartition en cahiers" icon={<Scissors size={13} />}>
        {totalPages < KDP_MIN_PAGES && (
          <p className="mb-2 font-serif text-xs text-[#a83232] italic">
            Sous le minimum KDP de {KDP_MIN_PAGES} pages : impression non éligible.
          </p>
        )}
        {cahiers.map((plan) => (
          <div key={plan.size} className="flex items-baseline justify-between gap-3 py-1">
            <span className="font-serif text-xs text-[#c9bea9]">
              Cahiers de {plan.size} pages{" "}
              <span className="text-[#9e9587]">(multiple de 4)</span>
            </span>
            <span className="font-mono text-xs text-[#e2dbce] tabular-nums">
              {plan.count} × {plan.size}
              {plan.remainder > 0 ? ` + ${plan.remainder}` : " — complet"}
            </span>
          </div>
        ))}
      </Panel>

      <Panel title="Calculateur d'épaisseur de dos" icon={<Ruler size={13} />}>
        <p className="mb-3 border-b border-dotted border-[#5a4f3f] pb-2 font-mono text-[11px] text-[#9e9587]">
          Épaisseur = Pages × Coeff. papier ({PAPER_COEFFICIENT_MM[cover.paperType].toFixed(4)} mm —{" "}
          {PAPER_LABEL[cover.paperType]})
        </p>
        <Row
          label="Calcul"
          value={`${bindingPages} × ${PAPER_COEFFICIENT_MM[cover.paperType].toFixed(4)}`}
        />
        <Row
          label="Épaisseur de dos"
          value={<span className="text-[#ffd700]">{spineMm.toFixed(2)} mm</span>}
        />
        <Row
          label="Zone de sécurité (deux bords)"
          value={`${SPINE_SAFETY_ZONE_MM.toFixed(1)} mm ≈ 0,0625 po`}
        />

        {/* Schéma proportionnel : zones de sécurité encadrant le dos */}
        <div className="mt-3">
          <div className="relative flex h-9 w-full overflow-hidden border border-[#3a3022] bg-[#0f0c0a]">
            <span
              aria-hidden
              className="h-full bg-[#1c1814]"
              style={{ width: `${(safeRatio * 100).toFixed(2)}%`, minWidth: "6px" }}
            />
            <span
              aria-hidden
              className="h-full bg-linear-to-r from-[#8f6e2b] via-[#c5a059] to-[#8f6e2b]"
            />
            <span
              aria-hidden
              className="h-full bg-[#1c1814]"
              style={{ width: `${(safeRatio * 100).toFixed(2)}%`, minWidth: "6px" }}
            />
          </div>
          <div className="mt-1 flex justify-between font-mono text-[10px] text-[#9e9587]">
            <span>sécurité {SPINE_SAFETY_ZONE_MM} mm</span>
            <span>dos {spineMm.toFixed(2)} mm</span>
            <span>sécurité {SPINE_SAFETY_ZONE_MM} mm</span>
          </div>
        </div>
      </Panel>

      <Panel title="Détection d'anomalies" icon={<AlertTriangle size={13} />}>
        <p className="mb-2 font-serif text-xs text-[#9e9587]">Placement des chapitres estimé ; seule la pagination totale est mesurée par le PDF.</p>
        {chapters.length === 0 ? (
          <p className="font-serif text-xs text-[#9e9587] italic">
            Aucun chapitre composé : la détection s'activera dès le premier chapitre.
          </p>
        ) : misplaced.length === 0 ? (
          <p className="font-serif text-xs text-[#c5a059]">
            Aucune anomalie : chaque chapitre ouvre sur une belle page (feuillet impair).
          </p>
        ) : (
          <>
            <p className="mb-2 font-serif text-xs text-[#a83232]">
              {misplaced.length} chapitre{misplaced.length > 1 ? "s" : ""} débute
              {misplaced.length > 1 ? "nt" : ""} sur un feuillet pair (page de gauche) au lieu
              d'une belle page impaire.
            </p>
            <ul className="space-y-1">
              {misplaced.map((placement) => (
                <li
                  key={placement.id}
                  className="flex items-baseline justify-between gap-3 border-b border-dotted border-[#5a4f3f]/60 pb-1"
                >
                  <span className="font-serif text-xs text-[#f5efe4]">
                    {romanNumeral(placements.indexOf(placement) + 1)}. {placement.title}
                  </span>
                  <span className="font-mono text-[11px] text-[#c8a06a] tabular-nums">
                    page {placement.startPage} (feuillet {Math.ceil(placement.startPage / 2)})
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
      </Panel>
    </div>
  );
};