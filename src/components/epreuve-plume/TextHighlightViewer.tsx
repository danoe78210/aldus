import React, { useEffect, useMemo, useRef } from "react";
import type { StylometryIssue } from "../../utils/stylometryApi";
import { highlightSegments } from "../../utils/stylometryView";

interface TextHighlightViewerProps {
  text: string;
  /** Alertes localisées (offsets en points de code Unicode). */
  issues: StylometryIssue[];
  hoveredId: string | null;
  onSelect: (id: string) => void;
}

export const TextHighlightViewer: React.FC<TextHighlightViewerProps> = ({ text, issues, hoveredId, onSelect }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const segments = useMemo(() => highlightSegments(text, issues), [text, issues]);

  useEffect(() => {
    if (!hoveredId) return;
    const marks = containerRef.current?.querySelectorAll<HTMLElement>("mark[data-issue-id]") ?? [];
    Array.from(marks).find((mark) => mark.dataset.issueId === hoveredId)?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
  }, [hoveredId]);

  return (
    <div
      ref={containerRef}
      aria-label="Feuillet annoté"
      className="min-h-0 flex-1 overflow-y-auto border border-[#2c251b] bg-[#100e0c] px-4 py-3 font-serif text-sm leading-relaxed whitespace-pre-wrap text-[#e2dbce]"
    >
      {segments.map((segment, index) =>
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
            className={`cursor-pointer border-b border-[#c24b2a] text-inherit transition-colors duration-200 focus:outline-none focus-visible:ring-1 focus-visible:ring-[#d4af37] ${
              segment.issueId === hoveredId ? "bg-[#c24b2a]/50 shadow-[0_0_0_1px_#d4af37]" : "bg-[#c24b2a]/20 hover:bg-[#c24b2a]/35"
            }`}
          >
            {segment.text}
          </mark>
        ),
      )}
    </div>
  );
};
