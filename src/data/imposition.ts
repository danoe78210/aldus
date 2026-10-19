import type { CoverPaperType, StructureItem } from "../types";

/**
 * Miroir frontend des constantes d'impression du **backend** — source de vérité
 * unique : `src-tauri/src/kdp.rs` (bornes de pagination) et
 * `src-tauri/src/cover/geometry.rs` (coefficients papier). Toute évolution doit
 * être répercutée des deux côtés.
 */
export const KDP_MIN_PAGES = 24;
export const KDP_MAX_PAGES = 828;
/** Zone de sécurité KDP autour de la tranche : 1,6 mm ≈ 0,0625 po. */
export const SPINE_SAFETY_ZONE_MM = 1.6;

/** Épaisseur du bloc papier par page (mm) — identique à `PaperType` (Rust). */
export const PAPER_COEFFICIENT_MM: Record<CoverPaperType, number> = {
  white: 0.0572,
  cream: 0.0635,
  color: 0.0596,
};

/** Libellé d'atelier du papier KDP. */
export const PAPER_LABEL: Record<CoverPaperType, string> = {
  white: "Blanc",
  cream: "Crème",
  color: "Couleur",
};

/** Cahiers d'imprimerie usuels (multiples de 4). */
export const CAHIER_SIZES = [16, 20, 24] as const;
export type CahierSize = (typeof CAHIER_SIZES)[number];

/** Numéral romain majuscule (I, II, III, IV, …) — lignes de registre. */
export const romanNumeral = (value: number): string => {
  if (!Number.isFinite(value) || value <= 0) {
    return "—";
  }
  const table: [number, string][] = [
    [1000, "M"],
    [900, "CM"],
    [500, "D"],
    [400, "CD"],
    [100, "C"],
    [90, "XC"],
    [50, "L"],
    [40, "XL"],
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ];
  let rest = Math.floor(value);
  let out = "";
  for (const [unit, glyph] of table) {
    while (rest >= unit) {
      out += glyph;
      rest -= unit;
    }
  }
  return out;
};


/** Épaisseur du dos (mm) : **Pages × coefficient papier**. */
export const spineThicknessMm = (pages: number, paper: CoverPaperType): number =>
  Math.max(0, pages) * PAPER_COEFFICIENT_MM[paper];

/** Feuillets (recto + verso) d'un nombre de pages. */
export const sheetsOf = (pages: number): number => Math.ceil(Math.max(0, pages) / 2);

export interface CahierPlan {
  size: CahierSize;
  /** Nombre de cahiers pleins. */
  count: number;
  /** Pages restantes (cahier partiel). */
  remainder: number;
}

/** Répartition de la pagination en cahiers : cahiers pleins + cahier partiel. */
export const planCahiers = (
  totalPages: number,
  sizes: readonly CahierSize[] = CAHIER_SIZES,
): CahierPlan[] =>
  sizes.map((size) => {
    const count = Math.floor(Math.max(0, totalPages) / size);
    return { size, count, remainder: Math.max(0, totalPages) - count * size };
  });

export interface ChapterPlacement {
  id: string;
  title: string;
  /** Première page du chapitre (1-indexée). */
  startPage: number;
  /** `true` si le chapitre ouvre sur une **belle page** (recto, page impaire). */
  recto: boolean;
}

/**
 * Placement estimé des chapitres : pages liminaires (`KDP_MIN_PAGES`) puis
 * répartition uniforme de la pagination restante. Convention KDP : la **belle
 * page** (recto) est la page **impaire**.
 */
export const placeChapters = (
  items: StructureItem[],
  totalPages: number,
): ChapterPlacement[] => {
  const chapters = items.filter((item) => item.type === "chapter");
  if (chapters.length === 0) {
    return [];
  }
  const body = Math.max(0, Math.min(KDP_MAX_PAGES, totalPages) - KDP_MIN_PAGES);
  const perChapter = Math.max(1, Math.floor(body / chapters.length));
  return chapters.map((chapter, index) => {
    const startPage = KDP_MIN_PAGES + index * perChapter + 1;
    return {
      id: chapter.id,
      title:
        chapter.displayName?.trim() ||
        chapter.sourceFileName?.trim() ||
        `Chapitre ${index + 1}`,
      startPage,
      recto: startPage % 2 === 1,
    };
  });
};

/** Chapitres débutant sur un feuillet **pair** (page de gauche) — anomalie KDP. */
export const misplacedChapters = (
  placements: ChapterPlacement[],
): ChapterPlacement[] => placements.filter((placement) => !placement.recto);
