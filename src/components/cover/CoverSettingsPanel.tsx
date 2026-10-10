import React from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { FolderOpen } from "lucide-react";
import { SpineGauge } from "./SpineGauge";
import type {
  CoverGeometry,
  CoverPaperType,
  ImageInspection,
  ImageInspectionReport,
  SpineColorSuggestion,
} from "../../utils/coverApi";

/** Propriétés de la page 1 « Réglages & Sources » (plein format). */
export interface CoverSettingsPanelProps {
  trimSize: string;
  pageCount: number;
  onPageCountChange: (value: number) => void;
  paperType: CoverPaperType;
  onPaperTypeChange: (value: CoverPaperType) => void;
  frontPath: string | null;
  backPath: string | null;
  inspection: ImageInspectionReport | null;
  onPick: (target: "front" | "back") => void;
  spineText: string;
  onSpineTextChange: (value: string) => void;
  geometry: CoverGeometry | null;
  suggestion: SpineColorSuggestion | null;
  useGradient: boolean;
  onUseGradientChange: (value: boolean) => void;
}

const PAPER_LABELS: Record<CoverPaperType, string> = {
  white: "Blanc",
  cream: "Crème",
  color: "Couleur",
};

const PAPER_TYPES: CoverPaperType[] = ["white", "cream", "color"];

const DPI_BADGE: Record<
  ImageInspection["status"],
  { dot: string; label: string; className: string }
> = {
  valid: { dot: "🟢", label: "≥ 300 DPI", className: "text-emerald-700" },
  warning: { dot: "🟡", label: "250–299 DPI", className: "text-amber-700" },
  invalid: { dot: "🔴", label: "< 250 DPI", className: "text-red-700" },
};

/** Nom de fichier court d'un chemin. */
const baseName = (path: string): string => path.split(/[\\/]/).pop() ?? path;

/** Convertit un chemin local en URL `asset://` chargeable par la WebView. */
const assetUrl = (path: string): string => {
  try {
    return convertFileSrc(path);
  } catch {
    return path;
  }
};

/** Badge d'inspection d'une image (DPI + canal alpha). */
const InspectionBadge: React.FC<{ image: ImageInspection | null }> = ({ image }) => {
  if (!image) {
    return <span className="font-mono text-[10px] text-stone-400">non inspectée</span>;
  }
  const badge = DPI_BADGE[image.status];
  return (
    <span className="flex flex-wrap items-center gap-3 font-mono text-[10px]">
      <span className={`rounded-sm border border-current px-1.5 py-0.5 ${badge.className}`}>
        {badge.dot} {badge.label}
      </span>
      <span className="text-stone-500">
        {Math.round(image.dpi)} DPI · {image.widthPx}×{image.heightPx}px
      </span>
      {image.hasAlpha && (
        <span className="rounded-sm border border-sky-700 px-1.5 py-0.5 text-sky-700">
          🔵 Alpha aplati
        </span>
      )}
    </span>
  );
};

/** Carte spacieuse d'un plat (Recto / Verso). */
const ImageCard: React.FC<{
  label: string;
  path: string | null;
  image: ImageInspection | null;
  onPick: () => void;
}> = ({ label, path, image, onPick }) => (
  <div className="flex flex-col rounded-sm border border-stone-400/30 bg-stone-500/5 p-4">
    <div className="mb-3 flex items-center justify-between gap-3">
      <span className="font-mono text-[11px] uppercase tracking-widest text-stone-600">
        {label}
      </span>
      <button
        type="button"
        onClick={onPick}
        className="flex items-center gap-1 rounded-sm border border-brass/50 bg-linear-to-b from-copper to-[#8a5426] px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-amber-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_2px_4px_rgba(0,0,0,0.5)] transition-all hover:brightness-110 active:translate-y-px"
      >
        <FolderOpen size={13} /> Parcourir…
      </button>
    </div>
    {path ? (
      <div className="mb-3 flex items-center justify-center rounded-sm border border-stone-400/30 bg-parchment/60 p-2">
        <img
          src={assetUrl(path)}
          alt={label}
          className="max-h-36 w-full rounded-xs object-contain shadow-xs"
        />
      </div>
    ) : (
      <div className="mb-3 flex h-36 items-center justify-center rounded-sm border border-dashed border-stone-400/40 bg-parchment/60 px-3">
        <span className="font-mono text-[11px] italic text-stone-400">
          Déposez ou parcourez…
        </span>
      </div>
    )}
    <div className="mb-2 truncate font-mono text-[11px] text-stone-600" title={path ?? undefined}>
      {path ? baseName(path) : "Aucune image sélectionnée"}
    </div>
    <InspectionBadge image={image} />
  </div>
);

/**
 * Page 1 « Réglages & Sources » : images des plats, paramètres KDP et
 * typographie de tranche, sur toute la largeur disponible.
 */
export const CoverSettingsPanel: React.FC<CoverSettingsPanelProps> = ({
  trimSize,
  pageCount,
  onPageCountChange,
  paperType,
  onPaperTypeChange,
  frontPath,
  backPath,
  inspection,
  onPick,
  spineText,
  onSpineTextChange,
  geometry,
  suggestion,
  useGradient,
  onUseGradientChange,
}) => {
  const spineEligible = geometry?.spine.textEligible ?? pageCount >= 80;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <h2 className="mb-5 border-b border-stone-400/40 pb-3 text-center font-serif text-2xl uppercase tracking-[0.25em] text-stone-700">
          Couverture
        </h2>

        <section className="mb-6">
          <h3 className="mb-3 font-mono text-[10px] uppercase tracking-widest text-copper">
            Images des plats
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            <ImageCard
              label="Plat 1 · Recto"
              path={frontPath}
              image={inspection?.front ?? null}
              onPick={() => onPick("front")}
            />
            <ImageCard
              label="Plat 4 · Verso"
              path={backPath}
              image={inspection?.back ?? null}
              onPick={() => onPick("back")}
            />
          </div>
        </section>

        <section className="mb-6">
          <h3 className="mb-3 font-mono text-[10px] uppercase tracking-widest text-copper">
            Format &amp; Tranche
          </h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-sm border border-stone-400/30 bg-stone-500/5 p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="font-mono text-[11px] text-stone-500">Format de coupe</span>
                <span className="font-serif text-sm text-stone-700">{trimSize}</span>
              </div>
              <div className="mb-3 flex items-center justify-between gap-3">
                <span className="font-mono text-[11px] text-stone-500">Type de papier</span>
                <div className="flex gap-1">
                  {PAPER_TYPES.map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => onPaperTypeChange(type)}
                      className={`rounded-sm border px-2 py-1 font-mono text-[10px] uppercase tracking-widest transition-colors ${
                        paperType === type
                          ? "border-brass/60 bg-copper text-amber-50"
                          : "border-stone-400/40 bg-stone-500/5 text-stone-600 hover:bg-stone-500/10"
                      }`}
                    >
                      {PAPER_LABELS[type]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <label htmlFor="cover-pages" className="font-mono text-[11px] text-stone-500">
                  Pagination (pages)
                </label>
                <input
                  id="cover-pages"
                  type="number"
                  min={1}
                  value={pageCount}
                  onChange={(event) =>
                    onPageCountChange(Math.max(1, Number(event.target.value) || 1))
                  }
                  className="w-24 border-b border-copper/50 bg-transparent text-right font-serif text-sm text-stone-700 focus:outline-none"
                />
              </div>
            </div>

            <div className="rounded-sm border border-stone-400/30 bg-stone-500/5 p-4">
              <h4 className="mb-3 font-mono text-[11px] text-stone-500">
                Typographie de tranche
              </h4>
              {spineEligible ? (
                <>
                  <input
                    type="text"
                    value={spineText}
                    onChange={(event) => onSpineTextChange(event.target.value)}
                    placeholder="Titre — Auteur"
                    className="mb-3 w-full border-b border-copper/50 bg-transparent font-serif text-sm text-stone-700 placeholder:italic placeholder:text-stone-400 focus:outline-none"
                  />
                  {suggestion && (
                    <div className="flex flex-wrap items-center gap-3 font-mono text-[10px] text-stone-600">
                      <span className="flex items-center gap-1">
                        <span
                          className="inline-block h-3 w-3 rounded-sm border border-stone-400/50"
                          style={{ background: suggestion.colorFront }}
                        />
                        {suggestion.colorFront}
                      </span>
                      <span className="flex items-center gap-1">
                        <span
                          className="inline-block h-3 w-3 rounded-sm border border-stone-400/50"
                          style={{ background: suggestion.colorBack }}
                        />
                        {suggestion.colorBack}
                      </span>
                      <label className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={useGradient}
                          onChange={(event) => onUseGradientChange(event.target.checked)}
                        />
                        Dégradé
                      </label>
                    </div>
                  )}
                </>
              ) : (
                <p className="rounded-sm border border-amber-600/40 bg-amber-100/40 px-2 py-2 text-[11px] italic text-amber-900">
                  KDP : le texte sur la tranche n&rsquo;est autorisé qu&rsquo;à partir de{" "}
                  <strong>80 pages</strong> (pagination actuelle : {pageCount} pages).
                </p>
              )}

              {/* Jauge de tranche inline (§6.2) — largeur utile + repères 1,6 mm. */}
              <SpineGauge
                spineWidthMm={geometry?.spine.widthMm ?? 0}
                spineText={spineText}
                textColor="#ffffff"
                backgroundColor={suggestion?.colorFront ?? "#1c140e"}
                backgroundGradientEnd={useGradient ? suggestion?.colorBack ?? null : null}
                isEligible={spineEligible}
              />
            </div>
          </div>
        </section>

        <section className="mb-4">
          <h3 className="mb-3 font-mono text-[10px] uppercase tracking-widest text-copper">
            Géométrie calculée
          </h3>
          {geometry ? (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 font-mono text-[11px] text-stone-600 md:grid-cols-4">
              <div>
                <dt>Épaisseur de tranche</dt>
                <dd className="text-stone-800">{geometry.spine.widthMm.toFixed(2)} mm</dd>
              </div>
              <div>
                <dt>Pages retenues</dt>
                <dd className="text-stone-800">{geometry.spine.pagesUsed}</dd>
              </div>
              <div>
                <dt>Largeur totale</dt>
                <dd className="text-stone-800">{geometry.totalWidthMm.toFixed(2)} mm</dd>
              </div>
              <div>
                <dt>Hauteur totale</dt>
                <dd className="text-stone-800">{geometry.totalHeightMm.toFixed(2)} mm</dd>
              </div>
            </dl>
          ) : (
            <p className="font-mono text-[11px] text-stone-400">
              Géométrie indisponible (application non empaquetée).
            </p>
          )}
        </section>
      </div>
    </div>
  );
};
