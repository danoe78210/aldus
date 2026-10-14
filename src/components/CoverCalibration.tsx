import React, { useEffect, useState } from "react";
import { Image as ImageIcon } from "lucide-react";
import { useStudio } from "./StudioContext";
import { SpineGauge } from "./cover/SpineGauge";
import {
  inspectCoverImages,
  pickCoverImage,
  type ImageInspectionReport,
} from "../utils/coverApi";
import { findTrimPreset } from "../data/trimSizes";
import {
  BARCODE_HEIGHT_MM,
  BARCODE_SAFETY_MARGIN_MM,
  BARCODE_WIDTH_MM,
  BLEED_KDP_MM,
  BLEED_MM,
  blurbFit,
  coverMetrics,
  trimToMm,
} from "../data/coverMetrics";
import { PAPER_COEFFICIENT_MM } from "../data/imposition";
import type { CoverFinish, CoverPaperType } from "../types";

/** Libellé de champ — petite capitale vénitienne. */
const labelClass =
  "mb-1.5 block font-serif text-xs tracking-wider text-[#c9bea9] uppercase";

/** Base commune des champs — ébène feutré, filet laiton au focus. */
const inputBase =
  "w-full rounded-xs border border-[#3a3022] bg-[#13110f] px-3 py-2 font-serif text-sm text-[#f5efe4] transition-colors placeholder:italic placeholder:text-[#5a5040] focus:border-[#d4af37] focus:ring-1 focus:ring-[#d4af37]/30 focus:outline-none";

/** Panneau de section du registre de reliure. */
const Section: React.FC<{ index: number; title: string; children: React.ReactNode }> = ({
  index,
  title,
  children,
}) => (
  <section className="mb-7 border border-[#3a3022]/70 bg-[#13110f]/60 p-4">
    <h3 className="mb-3 flex items-center gap-2 border-b border-[#3a3022] pb-2 font-serif text-[11px] tracking-widest text-[#d4af37] uppercase">
      <span className="text-[#8f6e2b]">[{index}]</span>
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

/** Papiers KDP proposés par le sélecteur de matière. */
const PAPERS: { id: CoverPaperType; title: string; note: string }[] = [
  { id: "cream", title: "Papier Crème", note: "Recommandé roman — 0,0635 mm/page" },
  { id: "white", title: "Papier Blanc", note: "0,0572 mm/page" },
  { id: "color", title: "Papier Couleur", note: "0,0596 mm/page" },
];

/** Finitions de pelliculage proposées. */
const FINISHES: { id: CoverFinish; title: string; note: string }[] = [
  { id: "mat", title: "Mat Velouté", note: "Toucher feutré, reflets contenus" },
  { id: "glossy", title: "Brillant Éclatant", note: "Contraste profond, vernis vif" },
];

/**
 * **Feuillet VIII — Calibrage du Volume & Reliure** (page de droite de l'atelier de
 * couverture) : matière & finitions, métriques temps réel de la forme complète
 * et composition du plat IV (prière d'insérer + cartouche code-barres KDP).
 *
 * Les métriques proviennent du miroir `data/coverMetrics.ts` (source de vérité :
 * `src-tauri/src/cover/geometry.rs`) ; l'épreuve 2D/3D et l'export sont sur le
 * Feuillet VII (marbre de montage).
 */
export const CoverCalibration: React.FC = () => {
  const { cover, onCoverChange, manuscriptConfig, onRequestCoverExport } = useStudio();
  const trim = findTrimPreset(manuscriptConfig.trimSize);
  const trimWidthMm = trim ? trimToMm(trim.width, trim.unit) : 152.4;
  const trimHeightMm = trim ? trimToMm(trim.height, trim.unit) : 228.6;

  const metrics = coverMetrics(trimWidthMm, trimHeightMm, cover.pageCount, cover.paperType);
  const blurb = cover.blurb ?? "";
  const finish: CoverFinish = cover.finish ?? "mat";
  const fit = blurbFit(blurb, trimWidthMm, trimHeightMm);

  const [inspection, setInspection] = useState<ImageInspectionReport | null>(null);
  const [picking, setPicking] = useState(false);

  // Inspection des plats dès qu'ils changent (silencieuse hors application native).
  useEffect(() => {
    let active = true;
    void inspectCoverImages(
      cover.frontPath ?? "",
      cover.backPath ?? "",
      manuscriptConfig.trimSize,
    )
      .then((report) => {
        if (active) setInspection(report);
      })
      .catch(() => {
        if (active) setInspection(null);
      });
    return () => {
      active = false;
    };
  }, [cover.frontPath, cover.backPath, manuscriptConfig.trimSize]);

  /** Sélection native d'un plat (silencieuse hors Tauri). */
  const handlePick = async () => {
    setPicking(true);
    try {
      const path = await pickCoverImage();
      if (path) {
        onCoverChange(cover.frontPath ? { backPath: path } : { frontPath: path });
      }
    } catch {
      /* sélecteur indisponible (SPA) : aucun chemin à mémoriser */
    } finally {
      setPicking(false);
    }
  };

  return (
    <div className="animate-ink-reveal mx-auto flex h-full w-full max-w-2xl flex-col overflow-y-auto px-2 pr-1">
      <h2 className="mb-6 text-center font-serif text-lg tracking-[0.25em] text-[#d4af37] uppercase">
        VIII. Calibrage du Volume &amp; Reliure
      </h2>

      <Section index={1} title="Matière & Finitions">
        <div className="mb-4">
          <label className={labelClass}>Pagination déclarée</label>
          <input
            type="number"
            min={1}
            defaultValue={cover.pageCount}
            onBlur={(event) => {
              const value = Number.parseInt(event.target.value, 10);
              onCoverChange({ pageCount: Number.isFinite(value) && value > 0 ? value : 1 });
            }}
            className={inputBase}
          />
        </div>

        <label className={labelClass}>Papier d&rsquo;imprimerie</label>
        <div className="mb-4 grid gap-2">
          {PAPERS.map((paper) => (
            <button
              key={paper.id}
              type="button"
              onClick={() => onCoverChange({ paperType: paper.id })}
              aria-pressed={cover.paperType === paper.id}
              className={`flex items-baseline justify-between gap-3 rounded-xs border px-3 py-2 text-left transition-colors ${
                cover.paperType === paper.id
                  ? "border-[#d4af37] bg-[#1c1814] text-[#ffd700]"
                  : "border-[#3a3022] bg-[#13110f] text-[#c9bea9] hover:border-[#8f6e2b]"
              }`}
            >
              <span className="font-serif text-sm">{paper.title}</span>
              <span className="font-mono text-[10px] text-[#9e9587]">{paper.note}</span>
            </button>
          ))}
        </div>

        <label className={labelClass}>Finition de pelliculage</label>
        <div className="mb-4 grid gap-2">
          {FINISHES.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => onCoverChange({ finish: option.id })}
              aria-pressed={finish === option.id}
              className={`flex items-baseline justify-between gap-3 rounded-xs border px-3 py-2 text-left transition-colors ${
                finish === option.id
                  ? "border-[#d4af37] bg-[#1c1814] text-[#ffd700]"
                  : "border-[#3a3022] bg-[#13110f] text-[#c9bea9] hover:border-[#8f6e2b]"
              }`}
            >
              <span className="font-serif text-sm">{option.title}</span>
              <span className="font-mono text-[10px] text-[#9e9587]">{option.note}</span>
            </button>
          ))}
        </div>

        <label className={labelClass}>Images des plats</label>
        <div className="flex flex-wrap items-center gap-2">
          {[cover.frontPath, cover.backPath].map((path, index) => (
            <span
              key={`plat-${index}`}
              className="flex max-w-full items-center gap-2 rounded-xs border border-[#3a3022] bg-[#13110f] px-2.5 py-1.5 font-mono text-[10px] text-[#bda888]"
            >
              <ImageIcon size={12} />
              <span className="truncate">
                {path
                  ? path.split(/[\\/]/).pop()
                  : index === 0
                    ? "Plat I — à choisir"
                    : "Plat IV — à choisir"}
              </span>
            </span>
          ))}
          <button
            type="button"
            onClick={() => void handlePick()}
            disabled={picking}
            className="rounded-xs border border-[#997728]/50 bg-linear-to-b from-[#2e1d0f] to-[#170f07] px-3 py-1.5 font-serif text-[10px] tracking-widest text-[#eedcb8] uppercase transition-colors hover:border-[#ffd700] hover:text-[#ffd700] disabled:opacity-50"
          >
            {picking ? "Sélection…" : "[ Choisir un plat ]"}
          </button>
          <button
            type="button"
            onClick={() => onCoverChange({ frontPath: null, backPath: null })}
            className="rounded-xs border border-[#3a3022] px-3 py-1.5 font-mono text-[10px] tracking-widest text-[#9e9587] uppercase transition-colors hover:text-[#a83232]"
          >
            [ Vider ]
          </button>
        </div>

        {inspection && (
          <ul className="mt-3 space-y-1">
            {(
              [
                ["Plat I", inspection.front],
                ["Plat IV", inspection.back],
              ] as const
            ).map(([name, entry]) => (
              <li key={name} className="flex items-baseline justify-between gap-3 py-0.5">
                <span className="font-serif text-xs text-[#c9bea9]">{name}</span>
                <span
                  className={`font-mono text-[10px] ${
                    entry.status === "valid" ? "text-[#c5a059]" : "text-[#c8a06a]"
                  }`}
                >
                  {entry.widthPx > 0
                    ? `${entry.widthPx}×${entry.heightPx} px · ${entry.dpi} dpi (min. ${inspection.requiredDpi})`
                    : "aucun visuel déposé"}
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4">
          <label className={labelClass}>Texte de la tranche</label>
          <input
            defaultValue={cover.spineText}
            onBlur={(event) => onCoverChange({ spineText: event.target.value })}
            placeholder="Titre — Auteur"
            disabled={cover.pageCount < 80}
            className={`${inputBase} disabled:opacity-50`}
          />
          {cover.pageCount < 80 && (
            <p className="mt-1 font-serif text-[11px] italic text-[#a83232]">
              Moins de 80 pages : tout texte sur le dos est <strong>interdit par KDP</strong> —
              laissez la tranche vierge ou augmentez la pagination.
            </p>
          )}
        </div>

        <label className="mt-3 flex items-center gap-2 font-serif text-xs text-[#c9bea9]">
          <input
            type="checkbox"
            checked={cover.gradient}
            onChange={(event) => onCoverChange({ gradient: event.target.checked })}
            className="h-3.5 w-3.5 accent-[#d4af37]"
          />
          Dégradé de tranche entre les deux plats
        </label>
      </Section>

      <Section index={2} title="Métriques de la Forme Complète">
        <Row label="Format de coupe" value={trim ? trim.label : manuscriptConfig.trimSize} />
        <Row
          label="Formule du dos : pages × coefficient"
          value={`${cover.pageCount} × ${PAPER_COEFFICIENT_MM[cover.paperType].toFixed(4)} mm`}
        />
        <Row
          label="Largeur du dos (tranche)"
          value={
            <span className="text-[#ffd700]">
              {metrics.spineWidthMm.toFixed(2)} mm · {metrics.spineWidthIn.toFixed(3)} po
            </span>
          }
        />
        <Row
          label="Largeur totale dépliée"
          value={`${metrics.totalWidthMm.toFixed(2)} mm`}
        />
        <Row label="Hauteur totale" value={`${metrics.totalHeightMm.toFixed(2)} mm`} />
        <Row
          label="Fond perdu (bleed)"
          value={`${BLEED_MM.toFixed(1)} mm · norme KDP ${BLEED_KDP_MM.toFixed(3)} mm (0,125 po)`}
        />

        <div className="mt-3">
          <SpineGauge
            spineWidthMm={metrics.spineWidthMm}
            spineText={cover.spineText}
            textColor="#e2dbce"
            backgroundColor={cover.spineColorFront ?? "#1c140e"}
            backgroundGradientEnd={cover.gradient ? cover.spineColorBack : null}
            isEligible={cover.pageCount >= 80}
          />
        </div>
      </Section>

      <Section index={3} title="Composition du Plat IV">
        <label className={labelClass}>Prière d&rsquo;insérer (résumé accroche)</label>
        <textarea
          rows={5}
          defaultValue={blurb}
          onBlur={(event) => onCoverChange({ blurb: event.target.value })}
          placeholder="Le texte de la 4e de couverture : accroche, promesse de lecture, dépôt légal…"
          className={`${inputBase} resize-none leading-relaxed`}
        />

        {/* Zone réservée au code-barres ISBN KDP — contrôle d'empiètement */}
        <div className="mt-3 border border-[#3a3022]/70 bg-[#0f0c0a] p-3">
          <Row
            label="Zone code-barres ISBN"
            value={`${BARCODE_WIDTH_MM} × ${BARCODE_HEIGHT_MM} mm`}
          />
          <Row
            label="Marge de sécurité (bas du plat IV)"
            value={`${BARCODE_SAFETY_MARGIN_MM.toFixed(1)} mm`}
          />
          <Row
            label="Hauteur disponible pour le texte"
            value={`${fit.availableHeightMm.toFixed(1)} mm`}
          />
          <Row
            label="Hauteur estimée du texte saisi"
            value={`${fit.estimatedHeightMm.toFixed(1)} mm`}
          />
          <p
            className={`mt-2 flex items-start gap-2 font-serif text-[11px] ${
              fit.fits ? "text-[#c5a059]" : "text-[#a83232]"
            }`}
          >
            {fit.fits
              ? "Aucun texte dans la zone de sécurité du code-barres."
              : "Le texte empiète sur la zone de sécurité du code-barres : raccourcissez la prière d’insérer ou réduisez le corps."}
          </p>
        </div>

        <p className="mt-3 border-t border-dotted border-[#5a4f3f] pt-2 font-mono text-[10px] text-[#9e9587]">
          Plat IV : {metrics.totalWidthMm.toFixed(1)} mm déplié · pelliculage{" "}
          {finish === "mat" ? "mat velouté" : "brillant éclatant"} ·{" "}
          {cover.frontPath ? "visuel I déposé" : "visuel I manquant"} /{" "}
          {cover.backPath ? "visuel IV déposé" : "visuel IV manquant"}
        </p>
      </Section>

      {/* Export du gabarit (l'épreuve 2D/3D est sur le Feuillet VII) */}
      <button
        type="button"
        onClick={onRequestCoverExport}
        className="mb-2 w-full border border-[#997728]/70 bg-linear-to-b from-[#2e1d0f] to-[#170f07] py-3.5 font-serif text-xs tracking-[0.28em] text-[#eedcb8] uppercase shadow-xl transition-all duration-300 hover:border-[#ffd700] hover:text-[#ffd700] hover:shadow-[0_0_20px_rgba(212,175,55,0.25)] active:scale-[0.99]"
      >
        [ Générer le gabarit KDP certifié (PDF/PNG 300 DPI) &rsaquo; ]
      </button>
    </div>
  );
};