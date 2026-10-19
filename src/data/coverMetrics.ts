import type { CoverPaperType } from "../types";
import { PAPER_COEFFICIENT_MM } from "./imposition";

/**
 * Miroir frontend des métriques de reliure du backend — source de vérité :
 * `src-tauri/src/cover/geometry.rs` (`BLEED_MM`, `BARCODE_*`, coefficients
 * papier). Sert à l'affichage **temps réel** du Feuillet V (réglages) ; le
 * calcul faisant foi pour la génération reste celui du moteur Rust.
 */
export const BLEED_MM = 3.2;
/** Norme KDP du fond perdu : 0,125 po = 3,175 mm (le générateur arrondit à 3,2 mm). */
export const BLEED_KDP_MM = 3.175;
export const BARCODE_WIDTH_MM = 50.8;
export const BARCODE_HEIGHT_MM = 30.5;
export const BARCODE_SAFETY_MARGIN_MM = 6.4;
/** Épaisseur d'un plat cartonné pelliculé (mm) — pour le volume 3D. */
export const COVER_BOARD_MM = 0.6;

export interface CoverMetrics {
  pagesUsed: number;
  /** Largeur du dos : `Pages × coefficient papier`. */
  spineWidthMm: number;
  /** Largeur du document déplié : `2 × fond perdu + 2 × plat + dos`. */
  totalWidthMm: number;
  /** Hauteur du document déplié : `hauteur du plat + 2 × fond perdu`. */
  totalHeightMm: number;
  /** Largeur de tranche en pouces (pour les gabarits KDP en pouces). */
  spineWidthIn: number;
  /** Zone réservée au code-barres ISBN (mm). */
  barcode: { widthMm: number; heightMm: number; safetyMarginMm: number };
}

/**
 * Métriques de la **forme complète** (planche dépliée) pour un format de coupe,
 * une pagination déclarée et un papier.
 */
export const coverMetrics = (
  trimWidthMm: number,
  trimHeightMm: number,
  pages: number,
  paper: CoverPaperType,
): CoverMetrics => {
  const pagesUsed = Math.ceil(Math.max(0, pages) / 2) * 2;
  const spineWidthMm = pagesUsed * PAPER_COEFFICIENT_MM[paper];
  return {
    pagesUsed,
    spineWidthMm,
    totalWidthMm: 2 * BLEED_MM + 2 * trimWidthMm + spineWidthMm,
    totalHeightMm: trimHeightMm + 2 * BLEED_MM,
    spineWidthIn: spineWidthMm / 25.4,
    barcode: {
      widthMm: BARCODE_WIDTH_MM,
      heightMm: BARCODE_HEIGHT_MM,
      safetyMarginMm: BARCODE_SAFETY_MARGIN_MM,
    },
  };
};

/**
 * Convertit un format de coupe (pouces ou millimètres) en millimètres.
 * `unit` provient de `data/trimSizes.ts` (`TrimUnit`).
 */
export const trimToMm = (value: number, unit: "in" | "mm"): number =>
  unit === "in" ? value * 25.4 : value;

export interface BlurbFit {
  /** Hauteur disponible pour la prière d'insérer au-dessus du code-barres (mm). */
  availableHeightMm: number;
  /** Hauteur estimée du texte saisi (mm) à 11 pt / interligne 1,15, 2 colonnes. */
  estimatedHeightMm: number;
  /** `true` si le texte reste hors de la zone de sécurité du code-barres. */
  fits: boolean;
}

/**
 * Contrôle d'absence de texte dans la zone de sécurité du code-barres :
 * la prière d'insérer ne doit pas empiéter sur le rectangle réservé (50,8 ×
 * 30,5 mm) augmenté de sa marge de sécurité (6,4 mm).
 * Estimation : ~1,9 mm par ligne de 11 pt, ~58 caractères par ligne sur 2 colonnes
 * à la largeur d'un plat 6 × 9.
 */
export const blurbFit = (
  blurb: string,
  trimWidthMm: number,
  trimHeightMm: number,
): BlurbFit => {
  const reservedHeight =
    BARCODE_HEIGHT_MM + BARCODE_SAFETY_MARGIN_MM + 2 * BLEED_MM;
  const availableHeightMm = Math.max(0, trimHeightMm - reservedHeight);
  const charsPerLine = Math.max(
    12,
    Math.round((2 * trimWidthMm * 0.72) / 2.05), // 2 colonnes, ~2,05 mm/caractère
  );
  const lines = blurb
    .split("\n")
    .reduce((total, line) => total + Math.max(1, Math.ceil(line.length / charsPerLine)), 0);
  const estimatedHeightMm = blurb.trim() === "" ? 0 : lines * 1.9;
  return {
    availableHeightMm,
    estimatedHeightMm,
    fits: estimatedHeightMm <= availableHeightMm,
  };
};