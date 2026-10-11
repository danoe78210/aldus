/**
 * **Gabarit du banc d'épreuve (Feuillet VIII)** — découpe du chapitre en
 * feuillets de gabarit fixe (vélin chaud, corps 16 px aéré) et outils de
 * pagination partagés entre le pupitre de lecture (page gauche du livre) et
 * les conseils de l'Imprimeur (page droite).
 */

import type { TypographyAnomaly } from "./typographyEngine";

/** Lignes composées par feuillet d'épreuve (gabarit 7 × 10 po, corps aéré). */
export const LINES_PER_PAGE = 12;

/** Ligne d'un chapitre, avec son décalage absolu dans le texte brut. */
export interface ProofLine {
  number: number;
  text: string;
  offset: number;
}

/** Découpe le texte en lignes numérotées (décalage absolu conservé). */
export const splitLines = (text: string): ProofLine[] => {
  const lines: ProofLine[] = [];
  let offset = 0;
  text.split("\n").forEach((value, index) => {
    lines.push({ number: index + 1, text: value, offset });
    offset += value.length + 1;
  });
  return lines;
};

/** Découpe une liste en pages de `size` éléments (`[[]]` si vide). */
export const paginate = <T>(items: readonly T[], size: number): T[][] => {
  const pages: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    pages.push(items.slice(index, index + size).map((item) => item));
  }
  return pages.length > 0 ? pages : [[]];
};

/** Rend les espaces typographiques visibles dans les conseils (« ⍽ » / « ⸗ »). */
export const showSpaces = (value: string): string =>
  value.replace(/\u00A0/g, "⍽").replace(/\u202F/g, "⸗");

/** Folio (page de composition) exclusivement dérivé du texte et de l'état de lecture. */
export interface ProofFolio {
  /** Lignes du chapitre entier. */
  lines: ProofLine[];
  /** Feuillets (sans filtre). */
  pages: ProofLine[][];
  /** Feuillets effectivement lisibles (filtre « feuillets à anomalies » appliqué). */
  visiblePages: ProofLine[][];
  /** Numéro de feuillet borné dans l'intervalle valide. */
  safePage: number;
  /** Lignes du feuillet courant. */
  currentLines: ProofLine[];
}

/**
 * Construit le folio courant : pagination du chapitre, filtre optionnel
 * « feuillets à anomalies », et numéro de page borné. Le résultat est
 * partagé par les deux pages du diptyque (lecture à gauche, conseils à droite).
 */
export const buildProofFolio = (
  text: string,
  page: number,
  onlyAnomalies: boolean,
  anomalies?: readonly TypographyAnomaly[],
): ProofFolio => {
  const lines = splitLines(text);
  const pages = paginate(lines, LINES_PER_PAGE);
  const filtered = onlyAnomalies
    ? pages.filter((block) =>
        block.some((line) => anomalies?.some((anomaly) => anomaly.line === line.number)),
      )
    : pages;
  const visiblePages = filtered.length > 0 ? filtered : [[]];
  const safePage = Math.min(page, Math.max(1, visiblePages.length));
  return {
    lines,
    pages,
    visiblePages,
    safePage,
    currentLines: visiblePages[safePage - 1] ?? [],
  };
};

/** Anomalies portées par le feuillet courant (conseils de l'Imprimeur). */
export const anomaliesOfFolio = (
  anomalies: readonly TypographyAnomaly[],
  currentLines: readonly ProofLine[],
): TypographyAnomaly[] =>
  anomalies.filter((anomaly) => currentLines.some((line) => anomaly.line === line.number));