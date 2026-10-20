import type { StylometryIssue } from "./stylometryApi";

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
