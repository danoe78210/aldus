import { createElement, Fragment, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { ReaderBlock, ReaderChapter, ReaderRun } from "../../types";
import { READER_FONTS } from "./readerSettings";
import type { ReaderProps } from "./readerTypes";

/** Espace entre deux pages dans le flux de colonnes CSS. */
const PAGE_GAP = 56;
const EXCERPT_CHARS = 160;
const WHEEL_THROTTLE_MS = 450;

interface TextReaderProps extends ReaderProps {
  chapters: ReaderChapter[];
}

const plainText = (block: ReaderBlock | undefined): string => block?.runs.map((run) => run.text).join("") ?? "";

const Runs = ({ runs }: { runs: ReaderRun[] }) => (
  <>
    {runs.map((run, index) => {
      let node = <Fragment>{run.text}</Fragment>;
      if (run.italic) node = <em>{node}</em>;
      if (run.bold) node = <strong>{node}</strong>;
      return <Fragment key={index}>{node}</Fragment>;
    })}
  </>
);

const HEADING_SIZES = ["1.7em", "1.4em", "1.2em", "1.05em", "1em", "1em"];

const Block = ({ block, index, previous, dropCap }: { block: ReaderBlock; index: number; previous?: ReaderBlock; dropCap: boolean }) => {
  if (block.kind === "rule") {
    return <div data-block={index} role="separator" className="my-[1.4em] text-center tracking-[0.6em] [break-inside:avoid]" style={{ color: "var(--reader-accent)" }}>⁂</div>;
  }
  if (block.kind === "heading") {
    const level = Math.min(6, Math.max(1, block.level));
    return createElement(
      `h${level}`,
      {
        "data-block": index,
        className: "text-center font-medium [break-after:avoid] [break-inside:avoid]",
        style: { fontSize: HEADING_SIZES[level - 1], lineHeight: 1.3, margin: index === 0 ? "0 0 1.2em" : "1.6em 0 1em", letterSpacing: "0.03em" },
      },
      <Runs runs={block.runs} />,
    );
  }
  if (block.kind === "quote") {
    return <blockquote data-block={index} className="my-[0.9em] pl-[1.4em] italic opacity-90" style={{ borderLeft: "2px solid var(--reader-accent)" }}><Runs runs={block.runs} /></blockquote>;
  }
  const indent = block.kind === "paragraph" && previous !== undefined && previous.kind !== "heading" && previous.kind !== "rule";
  return (
    <p
      data-block={index}
      className={dropCap ? "first-letter:float-left first-letter:pr-[0.12em] first-letter:text-[3.3em] first-letter:leading-[0.8] first-letter:text-(--reader-accent)" : undefined}
      style={{ margin: 0, textAlign: "justify", textIndent: indent ? "1.5em" : 0, hyphens: "auto", WebkitHyphens: "auto" } as CSSProperties}
    >
      <Runs runs={block.runs} />
    </p>
  );
};

const dropCapIndex = (blocks: ReaderBlock[]): number => {
  const first = blocks.findIndex((block) => block.kind !== "heading");
  return first >= 0 && blocks[first].kind === "paragraph" && /^\p{L}/u.test(plainText(blocks[first])) ? first : -1;
};

export const TextReader = ({ chapters, settings, bookmarks, onView, ref }: TextReaderProps) => {
  const [chapter, setChapter] = useState(0);
  const viewportRef = useRef<HTMLDivElement>(null);
  const flowRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef(0);
  const anchor = useRef<number | "end">(0);
  const lastWheel = useRef(0);
  const current = chapters[chapter];
  const paged = settings.flow === "paged";
  const dropCap = dropCapIndex(current.blocks);
  const family = READER_FONTS.find((font) => font.id === settings.font)?.family;

  const pageTotal = useCallback((): number => {
    const viewport = viewportRef.current;
    const flow = flowRef.current;
    if (!viewport || !flow) return 1;
    return Math.max(1, Math.round((flow.scrollWidth + PAGE_GAP) / (viewport.clientWidth + PAGE_GAP)));
  }, []);

  const visibleRange = useCallback((): { start: number; end: number } => {
    const viewport = viewportRef.current;
    const flow = flowRef.current;
    if (!viewport || !flow) return { start: 0, end: 0 };
    const view = viewport.getBoundingClientRect();
    let start = -1;
    let end = 0;
    flow.querySelectorAll<HTMLElement>("[data-block]").forEach((element, index) => {
      const visible = Array.from(element.getClientRects()).some((rect) => paged
        ? rect.right > view.left + 1 && rect.left < view.right - 1
        : rect.bottom > view.top + 1 && rect.top < view.bottom - 1);
      if (!visible) return;
      if (start < 0) start = index;
      end = index;
    });
    return { start: Math.max(0, start), end: Math.max(start, end) };
  }, [paged]);

  const report = useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const { start, end } = visibleRange();
    anchor.current = start;
    const length = Math.max(1, current.blocks.length);
    const marked = bookmarks.find((bookmark) => {
      const index = Math.round(bookmark.position * length);
      return bookmark.chapter === chapter && index >= start && index <= end;
    });
    const scrollable = viewport.scrollHeight - viewport.clientHeight;
    const label = paged
      ? `${pageRef.current + 1} / ${pageTotal()}`
      : `${scrollable > 0 ? Math.round((viewport.scrollTop / scrollable) * 100) : 100} %`;
    onView({ chapter, label, markedId: marked?.id ?? null });
  }, [bookmarks, chapter, current.blocks.length, onView, pageTotal, paged, visibleRange]);

  const showPage = useCallback((page: number) => {
    const viewport = viewportRef.current;
    const flow = flowRef.current;
    if (!viewport || !flow) return;
    pageRef.current = page;
    flow.style.transform = `translateX(${-page * (viewport.clientWidth + PAGE_GAP)}px)`;
    report();
  }, [report]);

  const applyAnchor = useCallback(() => {
    const viewport = viewportRef.current;
    const flow = flowRef.current;
    if (!viewport || !flow) return;
    const target = anchor.current;
    const element = target === "end" ? null : flow.querySelectorAll<HTMLElement>("[data-block]")[target];
    const rect = element?.getClientRects()[0];
    if (paged) {
      const step = viewport.clientWidth + PAGE_GAP;
      const total = pageTotal();
      const flowLeft = flow.getBoundingClientRect().left;
      showPage(target === "end" ? total - 1 : rect ? Math.min(total - 1, Math.max(0, Math.floor((rect.left - flowLeft + 1) / step))) : 0);
      return;
    }
    if (target === "end") viewport.scrollTop = viewport.scrollHeight;
    else if (rect) viewport.scrollTop += rect.top - viewport.getBoundingClientRect().top;
    else viewport.scrollTop = 0;
    report();
  }, [pageTotal, paged, report, showPage]);

  const goChapter = useCallback((target: number, edge: number | "end") => {
    if (target < 0 || target >= chapters.length) return;
    anchor.current = edge;
    setChapter(target);
  }, [chapters.length]);

  useLayoutEffect(() => {
    applyAnchor();
    // shortcut: la mise en page n'est recalculée que sur chapitre, typographie et mode ; le signet en cours est simplement ré-évalué.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapter, settings.flow, settings.font, settings.fontSize, settings.lineHeight, settings.width]);

  useEffect(() => {
    report();
  }, [report]);

  useEffect(() => {
    const viewport = viewportRef.current;
    const relayout = () => applyAnchor();
    void document.fonts?.ready.then(relayout);
    if (!viewport || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(relayout);
    observer.observe(viewport);
    return () => observer.disconnect();
  }, [applyAnchor, settings.flow]);

  const next = () => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    if (paged) {
      if (pageRef.current < pageTotal() - 1) showPage(pageRef.current + 1);
      else goChapter(chapter + 1, 0);
    } else if (viewport.scrollTop + viewport.clientHeight >= viewport.scrollHeight - 2) {
      goChapter(chapter + 1, 0);
    } else {
      viewport.scrollTop += viewport.clientHeight * 0.9;
    }
  };
  const prev = () => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    if (paged) {
      if (pageRef.current > 0) showPage(pageRef.current - 1);
      else goChapter(chapter - 1, "end");
    } else if (viewport.scrollTop <= 1) {
      goChapter(chapter - 1, "end");
    } else {
      viewport.scrollTop -= viewport.clientHeight * 0.9;
    }
  };

  useImperativeHandle(ref, () => ({
    next,
    prev,
    goTo: (target, position) => {
      const length = chapters[target]?.blocks.length ?? 0;
      if (length === 0) return;
      anchor.current = Math.min(length - 1, Math.round(position * length));
      if (target === chapter) applyAnchor();
      else setChapter(target);
    },
    locate: () => {
      const { start } = visibleRange();
      return {
        chapter,
        chapterTitle: current.title,
        position: start / Math.max(1, current.blocks.length),
        excerpt: plainText(current.blocks[start]).slice(0, EXCERPT_CHARS),
      };
    },
  }));

  const contentStyle: CSSProperties = {
    fontFamily: family,
    fontSize: settings.fontSize,
    lineHeight: settings.lineHeight,
    ...(paged
      ? { position: "absolute", inset: 0, columnWidth: settings.width === "full" ? "34rem" : "42rem", columnGap: PAGE_GAP, columnFill: "auto" }
      : { position: "relative", paddingBottom: "4rem" }),
  };

  return (
    <div className="mx-auto flex h-full min-h-0 w-full flex-col" style={{ maxWidth: settings.width === "full" ? "100%" : "42rem" }}>
      <div
        key={settings.flow}
        ref={viewportRef}
        data-testid="reader-viewport"
        className={`relative min-h-0 flex-1 ${paged ? "overflow-hidden" : "overflow-y-auto"}`}
        onScroll={paged ? undefined : report}
        onWheel={paged ? (event) => {
          const now = Date.now();
          if (Math.abs(event.deltaY) < 8 || now - lastWheel.current < WHEEL_THROTTLE_MS) return;
          lastWheel.current = now;
          if (event.deltaY > 0) next(); else prev();
        } : undefined}
      >
        <div ref={flowRef} lang="fr" style={contentStyle}>
          {current.blocks.map((block, index) => (
            <Block key={`${chapter}-${index}`} block={block} index={index} previous={current.blocks[index - 1]} dropCap={index === dropCap} />
          ))}
        </div>
      </div>
    </div>
  );
};
