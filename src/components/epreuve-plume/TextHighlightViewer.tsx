import React, { useEffect, useMemo, useRef } from "react";
import type { StylometryIssue } from "../../utils/stylometryApi";
import { highlightSegments, manuscriptBlocks, type HighlightSegment } from "../../utils/stylometryView";

interface TextHighlightViewerProps {
  text: string;
  /** Alertes localisées (offsets en points de code Unicode). */
  issues: StylometryIssue[];
  hoveredId: string | null;
  onSelect: (id: string) => void;
}

const BLOCK_CLASS = {
  title: "mt-2 mb-5 text-center font-serif text-xl font-semibold tracking-wide text-[#d4af37]",
  subtitle: "mt-6 mb-4 text-center text-[15px] italic text-[#c5bfb2]",
  paragraph: "indent-6 text-justify [text-justify:inter-word] hyphens-auto whitespace-pre-line",
} as const;

export const TextHighlightViewer: React.FC<TextHighlightViewerProps> = ({ text, issues, hoveredId, onSelect }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const blocks = useMemo(() => {
    const characters = Array.from(text);
    const placed: Array<HighlightSegment & { start: number; end: number }> = [];
    let cursor = 0;
    for (const segment of highlightSegments(text, issues)) {
      const end = cursor + Array.from(segment.text).length;
      placed.push({ ...segment, start: cursor, end });
      cursor = end;
    }
    return manuscriptBlocks(text).map((block) => ({
      kind: block.kind,
      segments: placed
        .filter((segment) => segment.end > block.start && segment.start < block.end)
        .map((segment) => ({
          issueId: segment.issueId,
          text: characters.slice(Math.max(segment.start, block.start), Math.min(segment.end, block.end)).join(""),
        })),
    }));
  }, [text, issues]);

  useEffect(() => {
    if (!hoveredId) return;
    const marks = containerRef.current?.querySelectorAll<HTMLElement>("mark[data-issue-id]") ?? [];
    Array.from(marks).find((mark) => mark.dataset.issueId === hoveredId)?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
  }, [hoveredId]);

  const renderSegment = (segment: HighlightSegment, index: number) =>
    segment.issueId === null ? (
      <React.Fragment key={index}>{segment.text}</React.Fragment>
    ) : (
      <mark
        key={index}
        data-issue-id={segment.issueId}
        role="button"
        tabIndex={0}
        onClick={() => onSelect(segment.issueId as string)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onSelect(segment.issueId as string);
          }
        }}
        className={`cursor-pointer rounded-[2px] border-b-2 border-[#c24b2a] text-inherit transition-colors duration-200 focus:outline-none focus-visible:bg-[#c24b2a]/45 ${
          segment.issueId === hoveredId ? "bg-[#c24b2a]/45" : "bg-[#c24b2a]/25 hover:bg-[#c24b2a]/45"
        }`}
      >
        {segment.text}
      </mark>
    );

  return (
    <div
      ref={containerRef}
      lang="fr"
      aria-label="Feuillet annoté"
      className="min-h-0 flex-1 space-y-1.5 overflow-y-auto border border-[#d4af37]/20 bg-[#121110] px-7 py-5 text-left font-reading text-base leading-[1.75] font-normal text-[#f0ece1]"
    >
      {blocks.map((block, index) => {
        const Tag = block.kind === "title" ? "h2" : block.kind === "subtitle" ? "h3" : "p";
        return (
          <Tag key={index} className={BLOCK_CLASS[block.kind]}>
            {block.segments.map(renderSegment)}
          </Tag>
        );
      })}
    </div>
  );
};
