/**
 * **Moteur typographique aldin** — analyse pure et corrections du `Code
 * typographique` et du `Lexique des règles typographiques en usage à
 * l'Imprimerie nationale` (Feuillets VII & VIII).
 *
 * Le moteur ne touche jamais au fichier : `analyzeTypography` renvoie une liste
 * d'anomalies **positionnées** (offset, longueur, ligne) et deux applicateurs
 * (`applyAldineUsage` pour l'ordre majeur, `applyAnomaly` pour une occurrence
 * isolée) renvoient un texte neuf.
 */

/** Espace insécable (U+00A0) — insécable normale. */
export const NBSP = "\u00A0";
/** Espace fine insécable (U+202F) — ponctuations doubles hautes. */
export const NNBSP = "\u202F";
/** Tiret cadratin (dialogue), demi-cadratin (incise), ellipse, apostrophe courbe. */
export const EM_DASH = "\u2014";
export const EN_DASH = "\u2013";
export const ELLIPSIS = "\u2026";
export const APOSTROPHE = "\u2019";
export const LEFT_GUILLEMET = "\u00AB";
export const RIGHT_GUILLEMET = "\u00BB";
export const ENGLISH_OPEN = "\u201C";
export const ENGLISH_CLOSE = "\u201D";

/** Familles d'anomalies (cartouches du Feuillet VII). */
export type TypographyFamily = "punctuation" | "dialogue" | "letters" | "numbers" | "hygiene";

/** Gravité : `critical` (carmin), `advice` (or), `minor` (bistre). */
export type TypographySeverity = "critical" | "advice" | "minor";

export type TypographyRuleId =
  | "nbsp-double-punctuation"
  | "nbsp-colon"
  | "space-before-low-punctuation"
  | "ellipsis"
  | "space-before-ellipsis"
  | "straight-quotes"
  | "guillemet-space"
  | "dialogue-dash"
  | "incise-dash"
  | "apostrophe"
  | "ligature-oe"
  | "ligature-ae"
  | "accented-capital"
  | "thousand-separator"
  | "century-nbsp"
  | "civility-nbsp"
  | "double-space"
  | "trailing-space";

/** Corpus des règles aldines — source unique de vérité du moteur. */
export const TYPOGRAPHY_RULES: Record<TypographyRuleId, TypographyRule> = {
  "nbsp-double-punctuation": {
    id: "nbsp-double-punctuation",
    label: "Espace fine insécable avant ; ! ?",
    family: "punctuation",
    severity: "critical",
    fixable: true,
  },
  "nbsp-colon": {
    id: "nbsp-colon",
    label: "Espace insécable avant le deux-points",
    family: "punctuation",
    severity: "critical",
    fixable: true,
  },
  "space-before-low-punctuation": {
    id: "space-before-low-punctuation",
    label: "Espace parasite avant le point ou la virgule",
    family: "punctuation",
    severity: "critical",
    fixable: true,
  },
  ellipsis: {
    id: "ellipsis",
    label: "Points de suspension dactylographiques",
    family: "punctuation",
    severity: "advice",
    fixable: true,
  },
  "space-before-ellipsis": {
    id: "space-before-ellipsis",
    label: "Espace avant les points de suspension",
    family: "punctuation",
    severity: "advice",
    fixable: true,
  },
  "straight-quotes": {
    id: "straight-quotes",
    label: "Guillemets dactylographiques droits",
    family: "dialogue",
    severity: "critical",
    fixable: true,
  },
  "guillemet-space": {
    id: "guillemet-space",
    label: "Espace intérieure des guillemets français",
    family: "dialogue",
    severity: "critical",
    fixable: true,
  },
  "dialogue-dash": {
    id: "dialogue-dash",
    label: "Tiret de dialogue dactylographique",
    family: "dialogue",
    severity: "critical",
    fixable: true,
  },
  "incise-dash": {
    id: "incise-dash",
    label: "Tiret d'incise à encadrer (demi-cadratin)",
    family: "dialogue",
    severity: "advice",
    fixable: true,
  },
  apostrophe: {
    id: "apostrophe",
    label: "Apostrophe droite dactylographique",
    family: "letters",
    severity: "advice",
    fixable: true,
  },
  "ligature-oe": {
    id: "ligature-oe",
    label: "Ligature dissociée e dans l'o",
    family: "letters",
    severity: "advice",
    fixable: true,
  },
  "ligature-ae": {
    id: "ligature-ae",
    label: "Ligature dissociée e dans l'a",
    family: "letters",
    severity: "advice",
    fixable: true,
  },
  "accented-capital": {
    id: "accented-capital",
    label: "Majuscule privée de son accent",
    family: "letters",
    severity: "advice",
    fixable: true,
  },
  "thousand-separator": {
    id: "thousand-separator",
    label: "Tranche de mille mal séparée",
    family: "numbers",
    severity: "minor",
    fixable: true,
  },
  "century-nbsp": {
    id: "century-nbsp",
    label: "Siècle détaché de son numéral",
    family: "numbers",
    severity: "minor",
    fixable: true,
  },
  "civility-nbsp": {
    id: "civility-nbsp",
    label: "Abréviation ou civilité sans insécable",
    family: "numbers",
    severity: "minor",
    fixable: true,
  },
  "double-space": {
    id: "double-space",
    label: "Double espace / espace parasite",
    family: "hygiene",
    severity: "minor",
    fixable: true,
  },
  "trailing-space": {
    id: "trailing-space",
    label: "Espace en fin de ligne",
    family: "hygiene",
    severity: "minor",
    fixable: true,
  },
};

/** Toutes les règles (ordre d'affichage du filtre de basse-cour). */
export const ALL_RULES: TypographyRule[] = Object.values(TYPOGRAPHY_RULES);

/** Libellé humain d'une famille. */
export const FAMILY_LABEL: Record<TypographyFamily, string> = {
  punctuation: "Ponctuation & espaces",
  dialogue: "Dialogues & incises",
  letters: "Apostrophes & ligatures",
  numbers: "Nombres, siècles & civilités",
  hygiene: "Hygiène spatiale",
};

/** Couleur d'atelier d'une famille (cartouches du Feuillet VII). */
export const FAMILY_COLOR: Record<TypographyFamily, string> = {
  punctuation: "#a83232",
  dialogue: "#c5a059",
  letters: "#8f6e2b",
  numbers: "#a89f91",
  hygiene: "#786c59",
};

/** Couleur de gravité (surlignage du banc d'épreuve). */
export const SEVERITY_COLOR: Record<TypographySeverity, string> = {
  critical: "#a83232",
  advice: "#c5a059",
  minor: "#786c59",
};

export interface TypographyRule {
  id: TypographyRuleId;
  /** Libellé didactique de la règle transgressée. */
  label: string;
  family: TypographyFamily;
  severity: TypographySeverity;
  /** Correction automatique disponible (ordre majeur). */
  fixable: boolean;
}
/** Anomalie typographique positionnée dans le texte analysé. */
export interface TypographyAnomaly {
  id: string;
  rule: TypographyRuleId;
  /** Libellé de la règle transgressée (spécialisé par occurrence si utile). */
  label: string;
  /** Conseil de correction du correcteur. */
  advice: string;
  family: TypographyFamily;
  severity: TypographySeverity;
  /** Position et longueur dans le texte (décorations du banc d'épreuve). */
  offset: number;
  length: number;
  /** Numéro de ligne (1-indexé) pour les gloses marginales. */
  line: number;
  found: string;
  replacement: string;
  fixable: boolean;
}

export interface TypographyAnalysis {
  anomalies: TypographyAnomaly[];
  total: number;
  words: number;
  /** Indice de pureté (0–100) : conformité à l'usage aldin. */
  purity: number;
  byFamily: Record<TypographyFamily, number>;
  bySeverity: Record<TypographySeverity, number>;
}

/** Mots dont la ligature e-dans-l'o est obligatoire (liste d'usage). */
const OE_FUSIONS: Record<string, string> = {
  coeur: "cœur",
  coeurs: "cœurs",
  soeur: "sœur",
  soeurs: "sœurs",
  oeuvre: "œuvre",
  oeuvres: "œuvres",
  oeil: "œil",
  oeuf: "œuf",
  oeufs: "œufs",
  boeuf: "bœuf",
  boeufs: "bœufs",
  noeud: "nœud",
  noeuds: "nœuds",
  moeurs: "mœurs",
  voeu: "vœu",
  voeux: "vœux",
  foetus: "fœtus",
  manoeuvre: "manœuvre",
  manoeuvres: "manœuvres",
  oeillet: "œillet",
  oedeme: "œdème",
  oenologue: "œnologue",
};

/** Locations dont la ligature e-dans-l'a est obligatoire. */
const AE_FUSIONS: Record<string, string> = {
  "ex aequo": "ex æquo",
  caecum: "cæcum",
  taenia: "tænia",
  "curriculum vitae": "curriculum vitæ",
};

/** Majuscules accentuées (Académie française) — formes fautives usuelles. */
const CAPITAL_ACCENTS: Record<string, string> = {
  A: "À",
  Ca: "Ça",
  Ecole: "École",
  Ecrivain: "Écrivain",
  Eglise: "Église",
  Element: "Élément",
  Energie: "Énergie",
  Enorme: "Énorme",
  Episode: "Épisode",
  Epoque: "Époque",
  Equipe: "Équipe",
  Etat: "État",
  Etats: "États",
  Ete: "Été",
  Etrange: "Étrange",
  Etre: "Être",
  Etude: "Étude",
  Etudiant: "Étudiant",
  Evenement: "Événement",
  Evidence: "Évidence",
  Evolution: "Évolution",
  Ile: "Île",
  Iles: "Îles",
  Interet: "Intérêt",
};

/** Accents intérieurs fréquemment omis (verbes et participes). */
const INNER_ACCENTS: Record<string, string> = {
  etait: "était",
  etaient: "étaient",
  etre: "être",
  ete: "été",
  etes: "êtes",
  meme: "même",
  memes: "mêmes",
  deja: "déjà",
  tres: "très",
  apres: "après",
};

/** Conserve la casse initiale lors d'une substitution de mot. */
const matchCase = (source: string, target: string): string =>
  source[0] === source[0]?.toUpperCase()
    ? target[0].toUpperCase() + target.slice(1)
    : target;

/** Numéro de ligne d'un décalage (1-indexé). */
export const lineOf = (text: string, offset: number): number => {
  let line = 1;
  for (let index = 0; index < offset && index < text.length; index += 1) {
    if (text[index] === "\n") {
      line += 1;
    }
  }
  return line;
};

/** Contexte d'affichage d'une occurrence (« …extrait… »). */
export const excerptOf = (text: string, offset: number, length: number): string => {
  const found = text.slice(offset, offset + length);
  const visible = found.replace(/\n/g, "⏎").replace(/ /g, "␣").replace(/\t/g, "⇥");
  return visible.length > 0 ? visible : "(espace)";
};
/** Conseil de correction par défaut, par règle. */
const DEFAULT_ADVICE: Record<TypographyRuleId, string> = {
  "nbsp-double-punctuation": `Poser une espace fine insécable (${NNBSP}) avant le signe double.`,
  "nbsp-colon": `Poser une espace insécable (${NBSP}) avant le deux-points.`,
  "space-before-low-punctuation": "Coller le signe simple au mot qui précède.",
  ellipsis: `Remplacer les trois points par l'ellipse (${ELLIPSIS}).`,
  "space-before-ellipsis": `Coller l'ellipse (${ELLIPSIS}) au mot précédent.`,
  "straight-quotes":
    "Employer les guillemets français (premier rang) ou anglais courbes (imbriqués).",
  "guillemet-space": "Coller les espaces intérieures au guillemet.",
  "dialogue-dash": `Ouvrir la réplique par un cadratin (${EM_DASH}) suivi d'une insécable.`,
  "incise-dash": "Encadrer l'incise de demi-cadratins entourés d'espaces.",
  apostrophe: `Employer l'apostrophe typographique (${APOSTROPHE}).`,
  "ligature-oe": "Fusionner en ligature e-dans-l'o (œ).",
  "ligature-ae": "Fusionner en ligature e-dans-l'a (æ).",
  "accented-capital": "Rétablir l'accent, y compris sur la capitale.",
  "thousand-separator": "Séparer les tranches de mille par une espace insécable.",
  "century-nbsp": "Lier le numéral du siècle par une insécable.",
  "civility-nbsp": "Lier l'abréviation à ce qui suit par une insécable.",
  "double-space": "Réduire à une espace unique.",
  "trailing-space": "Supprimer les blancs de fin de ligne.",
};

/** Intervalle [début, fin) déjà occupé par une anomalie (anti-chevauchement). */
const overlaps = (ranges: [number, number][], offset: number, length: number): boolean =>
  ranges.some(([start, end]) => offset < end && offset + length > start);

/**
 * **Examen aldin** : relève toutes les anomalies typographiques du texte.
 * `enabled` restreint l'examen aux règles cochées dans la basse-cour (§IX.2).
 */
export const analyzeTypography = (
  text: string,
  enabled?: readonly TypographyRuleId[],
): TypographyAnalysis => {
  const active = new Set<TypographyRuleId>(enabled ?? ALL_RULES.map((rule) => rule.id));
  const anomalies: TypographyAnomaly[] = [];
  const ranges: [number, number][] = [];

  const push = (
    rule: TypographyRuleId,
    offset: number,
    length: number,
    replacement: string,
    label?: string,
    advice?: string,
  ) => {
    if (!active.has(rule) || length <= 0 || overlaps(ranges, offset, length)) {
      return;
    }
    const meta = TYPOGRAPHY_RULES[rule];
    anomalies.push({
      id: `${rule}:${offset}`,
      rule,
      label: label ?? meta.label,
      advice: advice ?? DEFAULT_ADVICE[rule],
      family: meta.family,
      severity: meta.severity,
      offset,
      length,
      line: lineOf(text, offset),
      found: text.slice(offset, offset + length),
      replacement,
      fixable: meta.fixable,
    });
    ranges.push([offset, offset + length]);
  };

  // A. Ponctuation haute & espaces insécables -------------------------------
  for (const match of text.matchAll(/[ \t\u202F]+:/g)) {
    push("nbsp-colon", match.index ?? 0, match[0].length, `${NBSP}:`);
  }
  for (const match of text.matchAll(/(?<=[\p{L}\p{N}]):/gu)) {
    push("nbsp-colon", match.index ?? 0, 1, `${NBSP}:`);
  }
  for (const match of text.matchAll(/[ \t\u00A0]+([;!?])/g)) {
    push("nbsp-double-punctuation", match.index ?? 0, match[0].length, `${NNBSP}${match[1]}`);
  }
  for (const match of text.matchAll(/(?<=[\p{L}\p{N}])([;!?])/gu)) {
    push("nbsp-double-punctuation", match.index ?? 0, 1, `${NNBSP}${match[1]}`);
  }
  for (const match of text.matchAll(/[ \t]+([.,])(?!\.)/g)) {
    push("space-before-low-punctuation", match.index ?? 0, match[0].length, match[1]);
  }
  for (const match of text.matchAll(/[ \t]*\.{3}/g)) {
    push("ellipsis", match.index ?? 0, match[0].length, ELLIPSIS);
  }
  for (const match of text.matchAll(/[ \t]+…/g)) {
    push("space-before-ellipsis", match.index ?? 0, match[0].length, ELLIPSIS);
  }

  // B. Guillemets & dialogues ---------------------------------------------
  const frenchSpans = [...text.matchAll(/«[^»]*»/g)].map(
    (match) => [match.index ?? 0, (match.index ?? 0) + match[0].length] as [number, number],
  );
  let straightDepth = 0;
  for (const match of text.matchAll(/"([^"\n]*)"/g)) {
    const start = match.index ?? 0;
    const nested = frenchSpans.some(([from, to]) => start > from && start < to);
    if (nested) {
      push(
        "straight-quotes",
        start,
        match[0].length,
        `${ENGLISH_OPEN}${match[1]}${ENGLISH_CLOSE}`,
        "Guillemets anglais courbes (citation imbriquée)",
      );
    } else {
      push(
        "straight-quotes",
        start,
        match[0].length,
        `${LEFT_GUILLEMET}${NNBSP}${match[1]}${NNBSP}${RIGHT_GUILLEMET}`,
        "Guillemets français dactylographiés",
      );
    }
    straightDepth += 1;
  }
  void straightDepth;
  for (const match of text.matchAll(/«[ \t]/g)) {
    push("guillemet-space", match.index ?? 0, match[0].length, `${LEFT_GUILLEMET}${NNBSP}`);
  }
  for (const match of text.matchAll(/[ \t]»/g)) {
    push("guillemet-space", match.index ?? 0, match[0].length, `${NNBSP}${RIGHT_GUILLEMET}`);
  }
  for (const match of text.matchAll(/^[-–]\s+/gm)) {
    push("dialogue-dash", match.index ?? 0, match[0].length, `${EM_DASH}${NBSP}`);
  }
  for (const match of text.matchAll(/\S - \S/g)) {
    const before = match[0][0];
    const after = match[0][match[0].length - 1];
    push(
      "incise-dash",
      match.index ?? 0,
      match[0].length,
      `${before}${NBSP}${EN_DASH}${NBSP}${after}`,
    );
  }
// C. Apostrophe courbe ----------------------------------------------------
  for (const match of text.matchAll(/'/g)) {
    push("apostrophe", match.index ?? 0, 1, APOSTROPHE);
  }

  // E. Ligatures littéraires -------------------------------------------------
  for (const match of text.matchAll(/\b[\p{L}]+\b/gu)) {
    const word = match[0];
    const lower = word.toLowerCase();
    if (OE_FUSIONS[lower]) {
      push("ligature-oe", match.index ?? 0, word.length, matchCase(word, OE_FUSIONS[lower]));
    } else if (AE_FUSIONS[lower]) {
      push("ligature-ae", match.index ?? 0, word.length, matchCase(word, AE_FUSIONS[lower]));
    }
  }
  for (const [from, to] of Object.entries(AE_FUSIONS)) {
    if (!from.includes(" ")) {
      continue;
    }
    for (const match of text.matchAll(new RegExp(from.replace(/ /g, "\\s+"), "gi"))) {
      push("ligature-ae", match.index ?? 0, match[0].length, matchCase(match[0], to));
    }
  }

  // F. Majuscules accentuées & accents omis ---------------------------------
  for (const match of text.matchAll(/\b[\p{Lu}][\p{L}']*\b/gu)) {
    const word = match[0];
    if (CAPITAL_ACCENTS[word]) {
      push("accented-capital", match.index ?? 0, word.length, CAPITAL_ACCENTS[word]);
    }
  }
  for (const match of text.matchAll(/\b[\p{Ll}]{3,}\b/gu)) {
    const word = match[0];
    if (INNER_ACCENTS[word]) {
      push(
        "accented-capital",
        match.index ?? 0,
        word.length,
        INNER_ACCENTS[word],
        `Accent intérieur omis : « ${word} »`,
      );
    }
  }

  // D. Nombres, siècles & civilités -----------------------------------------
  for (const match of text.matchAll(/\b\d{1,3}(?:[.\u202F,]\d{3})+\b/g)) {
    push(
      "thousand-separator",
      match.index ?? 0,
      match[0].length,
      match[0].replace(/[.,\u202F]/g, NBSP),
    );
  }
  for (const match of text.matchAll(/\b([ivxlcdm]+e?)\s+si[èe]cles?\b/gi)) {
    const plural = /s$/i.test(match[0]) ? "siècles" : "siècle";
    push("century-nbsp", match.index ?? 0, match[0].length, `${match[1]}${NBSP}${plural}`);
  }
  for (const match of text.matchAll(/\b(M|Mme|Mlle|Mgr|Dr)\.\s+/g)) {
    push("civility-nbsp", match.index ?? 0, match[0].length, `${match[1]}.${NBSP}`);
  }
  for (const match of text.matchAll(/\b(M|Mme|Mlle|Mgr|Dr)\s+/g)) {
    push("civility-nbsp", match.index ?? 0, match[0].length, `${match[1]}${NBSP}`);
  }
  for (const match of text.matchAll(/\b(p|t|vol|chap)\.\s+/g)) {
    push("civility-nbsp", match.index ?? 0, match[0].length, `${match[1]}.${NBSP}`);
  }
  for (const match of text.matchAll(/\bn°\s*/g)) {
    push("civility-nbsp", match.index ?? 0, match[0].length, `n°${NBSP}`);
  }

  // G. Hygiène spatiale (les blancs de fin de ligne sont relevés en premier
  //    pour primer sur la réduction des plages multiples).
  for (const match of text.matchAll(/[ \t]+$/gm)) {
    push("trailing-space", match.index ?? 0, match[0].length, "");
  }
  for (const match of text.matchAll(/(?<!\n)[ \t]{2,}/g)) {
    push("double-space", match.index ?? 0, match[0].length, " ");
  }

  // Agrégation & indice de pureté -------------------------------------------
  anomalies.sort((left, right) => left.offset - right.offset);
  const words =
    text.trim() === ""
      ? 0
      : text
          .trim()
          .split(/\s+/)
          .filter((token) => /[\p{L}\p{N}]/u.test(token)).length;
  const byFamily: Record<TypographyFamily, number> = {
    punctuation: 0,
    dialogue: 0,
    letters: 0,
    numbers: 0,
    hygiene: 0,
  };
  const bySeverity: Record<TypographySeverity, number> = { critical: 0, advice: 0, minor: 0 };
  anomalies.forEach((anomaly) => {
    byFamily[anomaly.family] += 1;
    bySeverity[anomaly.severity] += 1;
  });
  const purity =
    words === 0
      ? 100
      : Math.max(0, Math.min(100, 100 - Math.round((anomalies.length / words) * 1000)));

  return { anomalies, total: anomalies.length, words, purity, byFamily, bySeverity };
};

export interface TypographyFixResult {
  text: string;
  /** Nombre de substitutions appliquées. */
  applied: number;
}

/**
 * **Ordre majeur de l'atelier** : applique toutes les corrections disponibles sur
 * le texte (ou sur la liste d'anomalies fournie). Les substitutions sont posées
 * de la fin vers le début afin que les décalages restent valides ; les
 * chevauchements sont résolus au profit de l'anomalie la plus tardive.
 */
export const applyAldineUsage = (
  text: string,
  anomalies?: readonly TypographyAnomaly[],
): TypographyFixResult => {
  const list = (anomalies ?? analyzeTypography(text).anomalies)
    .filter((anomaly) => anomaly.fixable)
    .slice()
    .sort((left, right) => right.offset - left.offset);
  let next = text;
  let applied = 0;
  let lastStart = Number.POSITIVE_INFINITY;
  for (const anomaly of list) {
    const end = anomaly.offset + anomaly.length;
    if (end > lastStart) {
      continue; // intervalle déjà recouvert par une correction posée
    }
    next = next.slice(0, anomaly.offset) + anomaly.replacement + next.slice(end);
    applied += 1;
    lastStart = anomaly.offset;
  }
  return { text: next, applied };
};

/** Corrige **une seule occurrence** (clic sur une glose du banc d'épreuve). */
export const applyAnomaly = (text: string, anomaly: TypographyAnomaly): string =>
  text.slice(0, anomaly.offset) + anomaly.replacement + text.slice(anomaly.offset + anomaly.length);