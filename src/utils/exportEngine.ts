import { SPINE_SAFETY_ZONE_MM, sheetsOf } from "../data/imposition";
import { BARCODE_HEIGHT_MM, BARCODE_WIDTH_MM } from "../data/coverMetrics";
import type { ChapterPlacement } from "../data/imposition";

/**
 * **Moteur de presse** — formes d'édition, bilan d'intégrité KDP et colophon
 * (Feuillets IX & X). Module pur : il ne déclenche aucun effet de bord, il
 * décrit et évalue ; `App.tsx` branche les moteurs réels (Typst, epub-builder).
 */

/** Formes d'édition proposées à la presse. */
export type ExportFormId = "pdf-x" | "epub32" | "cover-300" | "docx-x";

export interface ExportForm {
  id: ExportFormId;
  label: string;
  /** Moteur d'atelier employé. */
  engine: string;
  tooltip?: string;
  /** Points de conformité de la forme. */
  bullets: string[];
  /** Identifiant du moteur d'export existant (`runExport`). */
  handler: string;
}

export const EXPORT_FORMS: ExportForm[] = [
  {
    id: "pdf-x",
    label: "PDF Imprimeur (Haute Définition)",
    engine: "Typst embarqué → PDF prêt-à-imprimer",
    tooltip: "Préparé pour l'impression KDP / IngramSpark. Acceptation à vérifier auprès de l'imprimeur ; aucune certification PDF/X ni garantie de rejet zéro.",
    bullets: [
      "Composition vectorielle et polices incorporées par Typst.",
      "Conformité PDF/X et colorimétrie non certifiées par un prévol automatisé.",
      "Gouttière recalculée sur les pages du document composé.",
    ],
    handler: "PDF prêt-à-imprimer",
  },
  {
    id: "epub32",
    label: "EPUB (Standard)",
    engine: "epub-builder → EPUB 3 reflowable",
    tooltip: "EPUB reflowable sans validation EPUBCheck intégrée. La conformité et l'acceptation par la plateforme restent à vérifier.",
    bullets: [
      "Contenu reflowable avec feuille de style typographique noble.",
      "Sommaire de navigation ; images intérieures et notes non prises en charge.",
      "Couverture incorporée au manifeste.",
    ],
    handler: "Ebook (.epub)",
  },
  {
    id: "cover-300",
    label: "Jaquette Dépliée Haute Définition (300 DPI)",
    engine: "Typst → gabarit de couverture KDP",
    bullets: [
      `Tranche calculée au centième de millimètre, fonds perdus compris.`,
      `Zone de code-barres ISBN réservée (${BARCODE_WIDTH_MM} × ${BARCODE_HEIGHT_MM} mm).`,
      "Plats I et IV en résolution d'impression.",
    ],
    handler: "Couverture (jaquette KDP)",
  },
  {
    id: "docx-x",
    label: "Manuscrit Révisé & Typographié (DOCX)",
    engine: "Export bureautique consolidé pour relecture éditoriale",
    bullets: [
      "Chapitres fusionnés avec application des règles typographiques aldines.",
      "Styles éditoriaux conservés (titres, corps, notes de bas de page).",
      "Idéal pour transmission à un comité de lecture ou un correcteur tiers.",
    ],
    handler: "Manuscrit révisé (Word .docx)",
  },
];

export interface PressChecklistItem {
  id: string;
  label: string;
  /** Constat chiffré, affiché sous le libellé. */
  detail: string;
  ok: boolean;
}

export interface PressChecklistInput {
  /** Pagination déclarée (module Couverture). */
  pageCount: number;
  /** Texte de tranche composé. */
  spineText: string;
  /** Largeur de dos calculée (mm). */
  spineWidthMm: number;
  /** Chapitres mal calés (belle page manquée). */
  misplaced: ChapterPlacement[];
  /** Irrégularités typographiques relevées sur les mentions composées. */
  typographyIssues: number;
}

/**
 * **Bilan d'intégrité KDP** : quatre attestations calculées sur l'état réel du
 * projet (aucune valeur simulée).
 */
export const pressChecklist = ({
  pageCount,
  spineText,
  spineWidthMm,
  misplaced,
  typographyIssues,
}: PressChecklistInput): PressChecklistItem[] => {
  const multipleOfFour = pageCount % 4 === 0;
  const spineSafe = spineWidthMm >= 2 * SPINE_SAFETY_ZONE_MM;
  const spineCompliant = pageCount >= 80 || spineText.trim() === "";
  return [
    {
      id: "typography",
      label: "Règles typographiques aldines",
      detail:
        typographyIssues === 0
          ? "Mentions composées sans insécable orpheline."
          : `${typographyIssues} irrégularité(s) sur les mentions composées.`,
      ok: typographyIssues === 0,
    },
    {
      id: "imposition",
      label: "Imposition des cahiers",
      detail: multipleOfFour
        ? `${pageCount} pages — multiple de 4, cahiers complets.`
        : `${pageCount} pages — la pagination doit être multiple de 4.`,
      ok: multipleOfFour,
    },
    {
      id: "spine",
      label: "Conformité du dos",
      detail: spineSafe && spineCompliant
        ? `Dos de ${spineWidthMm.toFixed(2)} mm — zones de sécurité respectées.`
        : !spineSafe
          ? `Dos de ${spineWidthMm.toFixed(2)} mm — inférieur aux deux zones de ${SPINE_SAFETY_ZONE_MM} mm.`
          : "Moins de 80 pages : le dos doit rester vierge (contrainte KDP).",
      ok: spineSafe && spineCompliant,
    },
    {
      id: "belles-pages",
      label: "Belles pages (ouvertures impaires)",
      detail:
        misplaced.length === 0
          ? "Chaque chapitre ouvre sur une page impaire."
          : `${misplaced.length} chapitre(s) ouvrant sur un feuillet pair.`,
      ok: misplaced.length === 0,
    },
  ];
};

export interface ColophonInput {
  author: string;
  /** Date du jour (ex. « 10 octobre 2026 »). */
  date: string;
  /** Libellé du format de coupe (ex. « 6 × 9 po »). */
  trimLabel: string;
  pages: number;
}

/** **Colophon d'achevé d'imprimer** composé dynamiquement. */
export const buildColophon = ({ author, date, trimLabel, pages }: ColophonInput): string =>
  `Achevé de composer en l'Officine d'Aldus pour le compte de ${author || "l'auteur"}, ` +
  `à la date du ${date}. Gabarit ${trimLabel} · ${sheetsOf(pages)} feuillets sous fer.`;

/** Étapes cadencées du pressage (durée totale ≈ 3,5 s). */
export const PRESS_STAGES: { label: string; untilMs: number }[] = [
  { label: "Encrage des formes au noir d'os…", untilMs: 1200 },
  { label: "Serrage du marbre sous la platine…", untilMs: 2400 },
  { label: "Massicotage & reliure du volume…", untilMs: 3500 },
];

export const PRESS_TOTAL_MS = PRESS_STAGES[PRESS_STAGES.length - 1].untilMs;

/** Étape de pressage correspondant à un temps écoulé (indice, `-1` si achevé). */
export const pressStageAt = (elapsedMs: number): number =>
  PRESS_STAGES.findIndex((stage) => elapsedMs < stage.untilMs);

/** Date du jour en toutes lettres (français). */
export const todayInFrench = (now: Date = new Date()): string =>
  now.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });