import React from "react";

/** Propriétés de la jauge de tranche inline (`SpineGauge`). */
export interface SpineGaugeProps {
  /** Épaisseur de tranche calculée (mm). */
  spineWidthMm: number;
  /** Texte du dos. */
  spineText: string;
  /** Couleur du texte du dos (`#rrggbb`). */
  textColor: string;
  /** Couleur de fond de la tranche (`#rrggbb`). */
  backgroundColor: string;
  /** Couleur de fin de dégradé (si dégradé activé), sinon `null`. */
  backgroundGradientEnd?: string | null;
  /** `false` si `pages < 80` (texte de tranche interdit par KDP). */
  isEligible: boolean;
}

/** Hauteur fixe de la réglette (px). */
const GAUGE_HEIGHT = 40;
/** Échelle d'agrandissement horizontal (px par mm). */
const PX_PER_MM = 16;
/** Largeur bornée de la réglette (px). */
const MIN_WIDTH = 72;
const MAX_WIDTH = 320;
/** Marge de sécurité de pliure sur les mors (mm). */
const SAFETY_MM = 1.6;
/** Taille de police du texte de dos (px). */
const FONT_SIZE = 12;
/** Largeur moyenne estimée d'un glyphe + tracking (px). */
const CHAR_PX = FONT_SIZE * 0.52 + FONT_SIZE * 0.08;

/** Police éditoriale à empattements nets (lisibilité sur dos étroit). */
const SPINE_FONT = "\"Libertinus Serif\", Georgia, \"Times New Roman\", serif";

/**
 * Réglette de prévisualisation **agrandie** (coupe horizontale) affichée sous le
 * champ de saisie du dos : largeur utile en mm + repères de sécurité de pliure
 * (`1,6 mm`) + centrage optique du texte + alerte de débordement.
 */
export const SpineGauge: React.FC<SpineGaugeProps> = ({
  spineWidthMm,
  spineText,
  textColor,
  backgroundColor,
  backgroundGradientEnd,
  isEligible,
}) => {
  const width = Math.min(
    MAX_WIDTH,
    Math.max(MIN_WIDTH, Math.round(spineWidthMm * PX_PER_MM)),
  );
  const pxPerMm = spineWidthMm > 0 ? width / spineWidthMm : PX_PER_MM;
  const safetyPx = SAFETY_MM * pxPerMm;
  const usable = Math.max(width - 2 * safetyPx, 0);

  const estimated = spineText.trim().length * CHAR_PX;
  const overflow = isEligible && spineText.trim() !== "" && estimated > usable;

  const background = backgroundGradientEnd
    ? `linear-gradient(90deg, ${backgroundColor}, ${backgroundGradientEnd})`
    : backgroundColor;

  return (
    <div className="mt-1">
      <div className="mb-1 flex items-center justify-between font-mono text-[10px] tracking-wide text-stone-500">
        <span>Jauge de tranche</span>
        <span>{spineWidthMm.toFixed(2)} mm</span>
      </div>

      <div className="flex justify-center">
        <div
          data-testid="spine-gauge"
          className="relative flex items-center justify-center overflow-hidden rounded-sm border border-stone-400/50 shadow-[inset_0_1px_3px_rgba(0,0,0,0.25)]"
          style={{ height: GAUGE_HEIGHT, width, background }}
          title={`Tranche : ${spineWidthMm.toFixed(2)} mm · marges de sécurité ${SAFETY_MM} mm`}
        >
          {isEligible && (
            <>
              <span
                data-testid="spine-gauge-safety-left"
                className="absolute inset-y-0 left-0 border-r border-dashed border-cyan-300/80"
                style={{ width: safetyPx }}
              />
              <span
                data-testid="spine-gauge-safety-right"
                className="absolute inset-y-0 right-0 border-l border-dashed border-cyan-300/80"
                style={{ width: safetyPx }}
              />
            </>
          )}

          {isEligible ? (
            spineText.trim() !== "" && (
              <span
                data-testid="spine-gauge-text"
                className="relative z-10 max-w-full truncate px-1"
                style={{
                  color: textColor,
                  fontFamily: SPINE_FONT,
                  fontSize: FONT_SIZE,
                  letterSpacing: "0.08em",
                  textShadow: "0 1px 1px rgba(0,0,0,0.45)",
                }}
              >
                {spineText}
              </span>
            )
          ) : (
            <span
              data-testid="spine-gauge-ineligible"
              className="relative z-10 font-mono text-[10px] uppercase tracking-widest text-stone-300"
            >
              — tranche &lt; 80 pages —
            </span>
          )}
        </div>
      </div>

      {overflow && (
        <p
          data-testid="spine-gauge-warning"
          className="mt-1 text-[10px] italic text-[#a83232]"
        >
          Risque de débordement du texte sur les mors.
        </p>
      )}
    </div>
  );
};
