/**
 * **Usage Aldin** — examen typographique du manuscrit (Feuillet VII) et
 * corrections automatiques (Feuillet VIII).
 *
 * Règles appliquées (typographie française des imprimeurs vénitiens) :
 * 1. **Espaces insécables** avant les ponctuations hautes (`: ; ! ?`) et à
 *    l'intérieur des guillemets français (`« … »`).
 * 2. **Tirets cadratins** (`—`) pour les incises et les dialogues, à la place des
 *    traits d'union courts isolés.
 * 3. **Doubles espaces** et blancs en début de ligne.
 * 4. **Césures orphelines** : mot coupé resté en fin de ligne.
 * 5. **Veuves** : dernière ligne d'un paragraphe réduite à un mot.
 *
 * L'analyse est pure (aucun effet de bord) ; l'application des corrections
 * renvoie un texte neuf accompagné du nombre de substitutions.
 */

/** Espace insécable (U+00A0) et espace fine insécable (U+202F). */
export const NBSP = "\u00A0";
export const NNBSP = "\u202F";

/** Ponctuations hautes exigeant une espace insécable en français. */
const HIGH_PUNCTUATION = [":", ";", "!", "?"];

/** Échappe un caractère pour une utilisation dans une expression régulière. */
const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export type TypographyRuleId =
  | "nbsp-high-punctuation"
  | "nbsp-guillemets"
  | "em-dash"
  | "double-space"
  | "orphan-hyphen"
  | "widow-word";

export interface TypographyIssue {
  rule: TypographyRuleId;
  /** Libellé lisible de la règle. */
  label: string;
  /** Conseil de correction. */
  advice: string;
  /** Nombre d'occurrences détectées. */
  count: number;
  /** Extraits fautifs (au plus trois). */
  samples: string[];
  /** Correction automatique disponible. */
  fixable: boolean;
}

export interface TypographyReport {
  issues: TypographyIssue[];
  /** Somme des occurrences (toutes règles). */
  total: number;
  /** Nombre de mots (indicateur de densité). */
  words: number;
}

/** Extrait contextualisé d'une occurrence (les sauts de ligne sont visibles). */
const sampleOf = (text: string, index: number, length: number): string =>
  text.slice(Math.max(0, index - 12), index + length + 12).replace(/\n/g, "↵");
/** Analyse typographique complète d'un texte (Usage Aldin). */
export const analyzeTypography = (text: string): TypographyReport => {
  const issues: TypographyIssue[] = [];

  // 1. Espaces insécables devant les ponctuations hautes.
  const highPunct: string[] = [];
  HIGH_PUNCTUATION.forEach((mark) => {
    const pattern = new RegExp(`\\S[ \\u202F]${escapeRegExp(mark)}`, "g");
    for (const match of text.matchAll(pattern)) {
      highPunct.push(sampleOf(text, match.index ?? 0, match[0].length));
    }
  });
  if (highPunct.length > 0) {
    issues.push({
      rule: "nbsp-high-punctuation",
      label: "Espaces insécables avant : ; ! ?",
      advice: `Remplacer l'espace par une insécable (${NBSP}).`,
      count: highPunct.length,
      samples: highPunct.slice(0, 3),
      fixable: true,
    });
  }

  // 2. Guillemets français : insécable après « et avant ».
  const guillemets = [...text.matchAll(/«[ \t]/g), ...text.matchAll(/[ \t]»/g)];
  if (guillemets.length > 0) {
    issues.push({
      rule: "nbsp-guillemets",
      label: "Insécables des guillemets français",
      advice: "Coller l'espace intérieure aux guillemets (« texte »).",
      count: guillemets.length,
      samples: guillemets
        .slice(0, 3)
        .map((match) => sampleOf(text, match.index ?? 0, match[0].length)),
      fixable: true,
    });
  }

  // 3. Traits d'union courts tenant lieu de tirets cadratins (incises ` - `).
  const shortDashes = [...text.matchAll(/[^\s-] - [^\s-]/g)];
  if (shortDashes.length > 0) {
    issues.push({
      rule: "em-dash",
      label: "Tirets cadratins des incises",
      advice: "Remplacer ` - ` par un cadratin entouré d'espaces fines ( — ).",
      count: shortDashes.length,
      samples: shortDashes
        .slice(0, 3)
        .map((match) => sampleOf(text, match.index ?? 0, match[0].length)),
      fixable: true,
    });
  }

  // 4. Doubles espaces et blancs en tête de ligne (sans double comptage :
  //    une plage précédée d'un blanc appartient déjà au blanc de tête).
  const doubleSpaces = [
    ...text.matchAll(/(?<!\s) {2,}/g),
    ...text.matchAll(/\n[ \t]+/g),
  ];
  if (doubleSpaces.length > 0) {
    issues.push({
      rule: "double-space",
      label: "Doubles espaces & blancs de tête",
      advice: "Réduire à une espace unique.",
      count: doubleSpaces.length,
      samples: [],
      fixable: true,
    });
  }

  // 5. Césures orphelines : trait d'union final de ligne.
  const orphanHyphens = [...text.matchAll(/\w-\n/g)];
  if (orphanHyphens.length > 0) {
    issues.push({
      rule: "orphan-hyphen",
      label: "Césures orphelines",
      advice: "Recoller le mot coupé ou supprimer la césure.",
      count: orphanHyphens.length,
      samples: orphanHyphens
        .slice(0, 3)
        .map((match) => sampleOf(text, match.index ?? 0, match[0].length)),
      fixable: false,
    });
  }

  // 6. Lignes veuves : paragraphe dont la dernière ligne ne contient qu'un mot.
  let widows = 0;
  text.split(/\n{2,}/).forEach((paragraph) => {
    const lines = paragraph.split("\n").filter((line) => line.trim() !== "");
    const last = lines[lines.length - 1];
    if (lines.length > 1 && last && last.trim().split(/\s+/).length === 1) {
      widows += 1;
    }
  });
  if (widows > 0) {
    issues.push({
      rule: "widow-word",
      label: "Lignes veuves (mot seul)",
      advice: "Réécrire l'amorce pour éviter une dernière ligne d'un seul mot.",
      count: widows,
      samples: [],
      fixable: false,
    });
  }

  // Un « mot » = jeton contenant au moins une lettre ou un chiffre (la
  // ponctuation isolée n'est pas comptée).
  const words =
    text.trim() === ""
      ? 0
      : text
          .trim()
          .split(/\s+/)
          .filter((token) => /[\p{L}\p{N}]/u.test(token)).length;
  return {
    issues,
    total: issues.reduce((sum, issue) => sum + issue.count, 0),
    words,
  };
};
export interface TypographyFixResult {
  text: string;
  /** Nombre de substitutions appliquées. */
  applied: number;
}

/**
 * Applique l'**Usage Aldin** : insécables des ponctuations hautes et des
 * guillemets, cadratins des incises, suppression des doubles espaces.
 * Les corrigés qui exigent une décision d'auteur (césures, veuves) ne sont pas
 * touchés — ils restent signalés par {@link analyzeTypography}.
 */
export const applyAldineUsage = (text: string): TypographyFixResult => {
  let applied = 0;
  let next = text;

  // Doubles espaces → espace unique ; blancs de tête de ligne supprimés.
  next = next.replace(/ {2,}/g, () => {
    applied += 1;
    return " ";
  });
  next = next.replace(/\n[ \t]+/g, () => {
    applied += 1;
    return "\n";
  });

  // Incises : ` - ` → espace fine + cadratin + espace fine.
  next = next.replace(/(\S) - (\S)/g, (_match, before: string, after: string) => {
    applied += 1;
    return `${before}${NNBSP}\u2014${NNBSP}${after}`;
  });

  // Ponctuations hautes : espace → insécable.
  HIGH_PUNCTUATION.forEach((mark) => {
    next = next.replace(
      new RegExp(`(\\S)[ \\u202F]${escapeRegExp(mark)}`, "g"),
      (_match, before: string) => {
        applied += 1;
        return `${before}${NBSP}${mark}`;
      },
    );
  });

  // Guillemets français : insécable intérieure.
  next = next.replace(/«[ \t]/g, () => {
    applied += 1;
    return `«${NBSP}`;
  });
  next = next.replace(/[ \t]»/g, () => {
    applied += 1;
    return `${NBSP}»`;
  });

  return { text: next, applied };
};