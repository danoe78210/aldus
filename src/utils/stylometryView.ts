import type { StylometryIssue, StylometryReport, StylometryRule } from "./stylometryApi";

/** Le masquage ne change pas le texte : seule sa contribution d'alertes est réduite. */
export const sessionRisk = (report: StylometryReport, activeIssues: StylometryIssue[], rules: StylometryRule[]): number => {
  if (activeIssues.length === report.issues.length) return report.aiRiskPercent;
  const weights = new Map(rules.map((rule) => [rule.id, rule.kind.kind === "detection" ? Math.max(0, rule.kind.penaltyWeight) : 0]));
  const weightOf = (issues: StylometryIssue[]) => issues.reduce((sum, issue) => sum + (weights.get(issue.ruleId) ?? 0), 0);
  const total = weightOf(report.issues);
  const fraction = total > 0 ? weightOf(activeIssues) / total : 0;
  return Math.round((report.backgroundRisk + report.alertRisk * fraction) * 10) / 10;
};

/** Teinte et verdict du cercle de risque selon la gravité. */
export const riskTone = (risk: number): { color: string; label: string } =>
  risk <= 25
    ? { color: "#d4af37", label: "Plume souveraine" }
    : risk <= 50
      ? { color: "#d99b32", label: "Régularités mineures" }
      : { color: "#c24b2a", label: "Risque d'interception IA élevé" };

export interface HighlightSegment {
  text: string;
  issueId: string | null;
}

/**
 * Découpe le texte en segments surlignés (offsets en points de code Unicode).
 * Un passage imbriqué dans un autre (tic dans une phrase signalée) revient à
 * l'alerte la plus courte ; l'alerte englobante reste surlignée autour.
 */
export const highlightSegments = (text: string, issues: StylometryIssue[]): HighlightSegment[] => {
  const characters = Array.from(text);
  const spans = issues
    .map((issue) => ({ id: issue.id, start: Math.max(0, issue.startOffset), end: Math.min(issue.endOffset, characters.length) }))
    .filter((span) => span.end > span.start);
  const bounds = [...new Set([0, characters.length, ...spans.flatMap((span) => [span.start, span.end])])].sort((left, right) => left - right);
  const segments: HighlightSegment[] = [];
  for (let index = 0; index + 1 < bounds.length; index += 1) {
    const [start, end] = [bounds[index], bounds[index + 1]];
    const owner = spans
      .filter((span) => span.start <= start && span.end >= end)
      .reduce<(typeof spans)[number] | null>((best, span) => (!best || span.end - span.start < best.end - best.start ? span : best), null);
    const issueId = owner?.id ?? null;
    const piece = characters.slice(start, end).join("");
    const last = segments[segments.length - 1];
    if (last && last.issueId === issueId) last.text += piece;
    else segments.push({ text: piece, issueId });
  }
  return segments;
};

export interface ManuscriptBlock {
  kind: "title" | "subtitle" | "paragraph";
  /** Bornes visibles en points de code Unicode (dièses Markdown exclus). */
  start: number;
  end: number;
}

/** Découpe le manuscrit en titres Markdown (`#`, `##`…) et paragraphes séparés par une ligne vide. */
export const manuscriptBlocks = (text: string): ManuscriptBlock[] => {
  const blocks: ManuscriptBlock[] = [];
  let paragraph: ManuscriptBlock | null = null;
  let offset = 0;
  for (const line of text.split("\n")) {
    const length = Array.from(line).length;
    const heading = /^(#{1,6})[ \t]+/.exec(line);
    if (!line.trim() || heading) {
      paragraph = null;
      if (heading) blocks.push({ kind: heading[1].length === 1 ? "title" : "subtitle", start: offset + heading[0].length, end: offset + length });
    } else if (paragraph) {
      paragraph.end = offset + length;
    } else {
      paragraph = { kind: "paragraph", start: offset, end: offset + length };
      blocks.push(paragraph);
    }
    offset += length + 1;
  }
  return blocks;
};