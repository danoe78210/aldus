import type { CastingRoleKind, PodcastLine, PronunciationEntry, ScriptRule } from "../../types";
import { DIALOGUE_ROLE, NARRATOR_ROLE } from "./useVoiceCasting";

export const DEFAULT_RULES: ScriptRule[] = [
  { id: "strip-incises", enabled: false },
  { id: "breath-pauses", enabled: false },
  { id: "proper-nouns", enabled: false, substitutions: [] },
];

const DIALOGUE_START = /^(?:[—–]\s*|-\s+)/u;
const QUOTED = /«[\s\xA0]*([^»]+?)[\s\xA0]*»/gu;
const HAS_WORD = /[\p{L}\p{N}]/u;
const LEADING_PUNCTUATION = /^[\s,;:.]+/u;

const lineOf = (kind: CastingRoleKind, text: string, source: number): PodcastLine => ({
  kind, text, source, role: kind === "narrator" ? NARRATOR_ROLE : DIALOGUE_ROLE,
});

/** Découpe un chapitre en répliques : tirets et guillemets français = dialogue, le reste = narrateur. */
export const splitIntoLines = (text: string): PodcastLine[] => {
  const lines: PodcastLine[] = [];
  const push = (kind: CastingRoleKind, value: string) => {
    if (HAS_WORD.test(value)) lines.push(lineOf(kind, value.trim(), lines.length));
  };
  text.split(/\n+/).map((paragraph) => paragraph.trim()).filter(Boolean).forEach((paragraph) => {
    if (DIALOGUE_START.test(paragraph)) return push("unattributed-dialogue", paragraph.replace(DIALOGUE_START, ""));
    let last = 0;
    for (const match of paragraph.matchAll(QUOTED)) {
      push("narrator", paragraph.slice(last, match.index).replace(LEADING_PUNCTUATION, ""));
      push("unattributed-dialogue", match[1]);
      last = match.index + match[0].length;
    }
    push("narrator", paragraph.slice(last).replace(LEADING_PUNCTUATION, ""));
  });
  return lines;
};

const VERBS = String.raw`(?:dit|demanda|répondit|murmura|s['’]écria|s['’]exclama|souffla|lança|ajouta|reprit|répliqua|chuchota|cria|soupira|fit|répéta|annonça|déclara|gronda|siffla|avoua|observa|rétorqua|insista|hurla|grogna|balbutia|bredouilla|interrogea|questionna|s['’]étonna|plaisanta|conclut|poursuivit|continua|protesta|expliqua|affirma|assura|proposa|suggéra|commenta|lâcha|ordonna|rugit|trancha|nota|remarqua)`;
const INCISE = String.raw`${VERBS}-(?:t-)?(?:il|elle|on|ils|elles|je|tu|nous|vous)(?!\p{L})[^,.!?…—–]{0,60}`;
// shortcut: seules les incises à pronom sujet (« dit-il ») sont reconnues, pas « dit Marie ».
const INCISE_RULES: [RegExp, string][] = [
  [new RegExp(String.raw`,\s*${INCISE},\s*`, "giu"), ", "],
  [new RegExp(String.raw`\s*[—–]\s*${INCISE}\s*[—–]\s*`, "giu"), " "],
  [new RegExp(String.raw`,\s*${INCISE}([.!?…]|$)`, "giu"), "$1"],
  [new RegExp(String.raw`([!?…])\s*${INCISE}(\.|$)`, "giu"), "$1"],
  [new RegExp(String.raw`\s*[—–]\s*${INCISE}$`, "giu"), "."],
];
const INCISE_ONLY = new RegExp(String.raw`^${INCISE}[.!?…]?$`, "iu");

const stripIncises = (text: string): string =>
  INCISE_RULES.reduce((value, [pattern, replacement]) => value.replace(pattern, replacement), text).trim();

const breathe = (text: string): string => text
  .replace(/\s*(?:…|\.{2,})+\.*/gu, "…")
  .replace(/…(?=\p{L})/gu, "… ")
  .replace(/\s*[—–]\s*$/u, "…")
  .replace(/\s+[—–]\s+/gu, ", ")
  .replace(/,\s*,/gu, ",")
  .trim();

const escapeRegExp = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`);

const pronounce = (text: string, entries: PronunciationEntry[]): string => entries
  .filter((entry) => entry.name.trim() && entry.spoken.trim())
  .reduce((value, entry) => value.replace(
    new RegExp(String.raw`(?<![\p{L}\p{N}_])${escapeRegExp(entry.name.trim())}(?![\p{L}\p{N}_])`, "gu"),
    () => entry.spoken.trim(),
  ), text);

/** Applique les règles activées, dans un ordre fixe : incises, respirations, noms propres. */
export const applyRules = (lines: PodcastLine[], rules: ScriptRule[]): PodcastLine[] => {
  const enabled = (id: ScriptRule["id"]) => rules.find((rule) => rule.id === id && rule.enabled);
  const names = enabled("proper-nouns")?.substitutions ?? [];
  const result: PodcastLine[] = [];
  lines.forEach((line, position) => {
    let text = line.text;
    if (enabled("strip-incises")) {
      if (line.kind === "narrator" && lines[position - 1]?.kind === "unattributed-dialogue" && INCISE_ONLY.test(text)) return;
      if (line.kind !== "narrator") text = stripIncises(text);
    }
    if (enabled("breath-pauses")) text = breathe(text);
    text = pronounce(text, names);
    if (HAS_WORD.test(text)) result.push({ ...line, text });
  });
  return result;
};

/** Noms propres probables : mots capitalisés en milieu de phrase, répétés au moins deux fois. */
export const detectProperNouns = (text: string, known: PronunciationEntry[]): string[] => {
  const counts = new Map<string, number>();
  for (const match of text.matchAll(/(?<=[\p{Ll},;][ \xA0])\p{Lu}[\p{L}'’-]{2,}/gu)) counts.set(match[0], (counts.get(match[0]) ?? 0) + 1);
  return [...counts]
    .filter(([name, count]) => count >= 2 && !known.some((entry) => entry.name === name))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name]) => name);
};
