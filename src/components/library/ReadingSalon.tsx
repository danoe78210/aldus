import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import Markdown from "react-markdown";
import { ChevronLeft, ChevronRight, ListTree, Moon, Sun } from "lucide-react";
import { loadSalonBookmark, loadSalonTheme, saveSalonBookmark, saveSalonTheme } from "./salonSession";
import type { SalonTheme } from "./salonSession";
import { BookSpread, COLUMN_GAP, PAGE_RATIO } from "./BookSpread";
import type { SpreadHandle } from "./BookSpread";
import { footnotesToSuperscripts } from "./salonMarkdown";
import type { SalonChapter } from "./salonMarkdown";
import "./readingSalon.css";

interface ReadingSalonProps {
  bookId: string;
  title: string;
  chapters: SalonChapter[];
}

const LAST_SPREAD = Number.MAX_SAFE_INTEGER;
const SLIDER_SCALE = 1000;
const THUMB_SIZE = 10;
const TYPING_TARGETS = "input:not([type='range']), textarea, select";
const controlClass = "flex items-center gap-1.5 rounded-sm border border-[#6b5327] bg-[#13110f]/80 px-2.5 py-1.5 font-cinzel text-[10px] tracking-wider text-[#d4af37] uppercase transition-colors hover:border-[#d4af37] hover:bg-[#211c15]";
const prefersReducedMotion = (): boolean => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
/** La plus grande page de rapport `PAGE_RATIO` tenant deux fois dans l'aire du livre (même calcul que la bibliothèque en mode `stretch`). */
const fitPage = (areaWidth: number, areaHeight: number) => {
  const height = Math.min(areaWidth / 2 * PAGE_RATIO, areaHeight);
  return { width: height / PAGE_RATIO, height };
};
/** Abscisse du centre du curseur natif pour une part `ratio` du rail (le curseur ne déborde pas du rail). */
const thumbLeft = (ratio: number): string => `calc(${ratio * 100}% + ${(0.5 - ratio) * THUMB_SIZE}px)`;

/** Le pupitre de relecture : un livre ouvert en double page, dont le Markdown d'un chapitre coule d'une page à l'autre. */
export const ReadingSalon = ({ bookId, title, chapters }: ReadingSalonProps) => {
  const last = chapters.length - 1;
  const [position, setPosition] = useState<{ chapter: number; spread: number; ratio?: number }>(() => {
    const saved = loadSalonBookmark(bookId);
    return { chapter: Math.max(0, Math.min(saved.chapter, last)), spread: saved.spread };
  });
  const [area, setArea] = useState<{ width: number; height: number } | null>(null);
  const [layout, setLayout] = useState<{ chapter: number; pageWidth: number; spreads: number; step: number } | null>(null);
  const [theme, setTheme] = useState<SalonTheme>(loadSalonTheme);
  const [tocOpen, setTocOpen] = useState(false);
  const [sliderEngaged, setSliderEngaged] = useState(false);
  const bookRef = useRef<HTMLDivElement>(null);
  const bookHandle = useRef<SpreadHandle>(null);
  const flowRef = useRef<HTMLElement>(null);

  const { chapter } = position;
  const current = chapters[chapter];
  const page = area ? fitPage(area.width, area.height) : null;
  const measured = layout?.chapter === chapter && layout.pageWidth === page?.width ? layout : null;
  const spreads = measured?.spreads ?? 1;
  const wanted = position.ratio === undefined ? position.spread : Math.round(position.ratio * spreads) - 1;
  const spread = measured ? Math.min(Math.max(wanted, 0), spreads - 1) : 0;
  const folio = measured ? spread * 2 + 1 : 1;
  const progress = Math.round(((chapter + (spread + 1) / spreads) / chapters.length) * 100);
  const sliderMax = chapters.length * SLIDER_SCALE;
  const sliderValue = Math.round((chapter + (spread + 1) / spreads) * SLIDER_SCALE);
  const sliderText = `Chapitre ${chapter + 1} · Page ${folio}`;
  const atStart = chapter === 0 && spread === 0;
  const atEnd = chapter === last && spread === spreads - 1;

  const body = useMemo(() => <Markdown>{footnotesToSuperscripts(current?.markdown ?? "")}</Markdown>, [current?.markdown]);

  useLayoutEffect(() => {
    const book = bookRef.current;
    if (!book) return;
    const measure = () => setArea((previous) => previous?.width === book.clientWidth && previous.height === book.clientHeight ? previous : { width: book.clientWidth, height: book.clientHeight });
    measure();
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    observer?.observe(book);
    return () => observer?.disconnect();
  }, []);

  const pageWidth = page?.width;
  useLayoutEffect(() => {
    const flow = flowRef.current;
    const frame = flow?.parentElement;
    if (!flow || !frame || pageWidth === undefined) return;
    const measure = () => {
      const step = frame.clientWidth + COLUMN_GAP;
      const spreadCount = Math.max(1, Math.ceil(Math.ceil((flow.scrollWidth + COLUMN_GAP) / step) / 2));
      setLayout((previous) => previous?.chapter === chapter && previous.pageWidth === pageWidth && previous.spreads === spreadCount && previous.step === step ? previous : { chapter, pageWidth, spreads: spreadCount, step });
    };
    measure();
    void document.fonts?.ready.then(measure);
  }, [chapter, body, pageWidth]);

  useEffect(() => {
    if (measured) saveSalonBookmark(bookId, { chapter, spread });
  }, [bookId, chapter, spread, measured]);

  const turned = useCallback((turnedSpread: number) => {
    setPosition((previous) => previous.chapter === chapter && previous.ratio === undefined && previous.spread === turnedSpread ? previous : { chapter, spread: turnedSpread });
  }, [chapter]);

  const next = useCallback(() => {
    if (spread < spreads - 1) {
      if (prefersReducedMotion()) setPosition({ chapter, spread: spread + 1 });
      else bookHandle.current?.flipNext();
    } else if (chapter < last) {
      setPosition({ chapter: chapter + 1, spread: 0 });
    }
  }, [chapter, spread, spreads, last]);

  const previous = useCallback(() => {
    if (spread > 0) {
      if (prefersReducedMotion()) setPosition({ chapter, spread: spread - 1 });
      else bookHandle.current?.flipPrev();
    } else if (chapter > 0) {
      setPosition({ chapter: chapter - 1, spread: LAST_SPREAD });
    }
  }, [chapter, spread]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.target instanceof HTMLElement && event.target.matches(TYPING_TARGETS)) return;
      if (event.key === "ArrowRight" || event.key === "PageDown") next();
      else if (event.key === "ArrowLeft" || event.key === "PageUp") previous();
      else if (event.key === "Escape" && tocOpen) setTocOpen(false);
      else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [next, previous, tocOpen]);

  const seek = (value: number) => {
    const reached = value / SLIDER_SCALE;
    const target = Math.min(last, Math.max(0, Math.ceil(reached) - 1));
    setPosition({ chapter: target, spread: 0, ratio: Math.min(1, Math.max(0, reached - target)) });
  };

  const chooseTheme = () => {
    const other: SalonTheme = theme === "atelier" ? "velin" : "atelier";
    setTheme(other);
    saveSalonTheme(other);
  };

  return (
    <section lang="fr" aria-label={`Salon de lecture — ${title}`} className="salon" data-theme={theme}>
      <div ref={bookRef} className="salon-book" style={page ? { "--page-w": `${page.width}px`, "--page-h": `${page.height}px` } as CSSProperties : undefined}>
        {page && (
          <>
            <div aria-hidden="true" className="salon-underlay" />
            <div aria-hidden="true" className="salon-measure">
              <article ref={flowRef} lang="fr" className="salon-flow" style={{ columnGap: COLUMN_GAP }}>{body}</article>
            </div>
            <BookSpread
              ref={bookHandle}
              pageCount={(layout?.spreads ?? 0) * 2}
              spread={spread}
              step={layout?.step ?? 0}
              width={page.width}
              height={page.height}
              body={body}
              bookTitle={title}
              chapterTitle={current?.title ?? ""}
              onTurn={turned}
            />
            <div aria-hidden="true" className="salon-gutter" />
          </>
        )}
      </div>

      <button type="button" data-side="prev" aria-label="Page précédente" disabled={atStart} onClick={previous} className="salon-chevron"><ChevronLeft size={36} strokeWidth={1.25} /></button>
      <button type="button" data-side="next" aria-label="Page suivante" disabled={atEnd} onClick={next} className="salon-chevron"><ChevronRight size={36} strokeWidth={1.25} /></button>

      <div className="absolute bottom-9 left-1/2 w-[min(32rem,45%)] -translate-x-1/2">
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-1/2">
          {chapters.map((_, index) => <span key={index} className="salon-tick" style={{ left: thumbLeft(index / chapters.length) }} />)}
        </div>
        {sliderEngaged && <p role="tooltip" className="salon-tooltip" style={{ left: thumbLeft(sliderValue / sliderMax) }}>{sliderText}</p>}
        <input
          type="range"
          aria-label="Avancement dans l’ouvrage"
          aria-valuetext={sliderText}
          className="salon-slider"
          min={0}
          max={sliderMax}
          value={sliderValue}
          style={{ "--fill": `${(sliderValue / sliderMax) * 100}%` } as CSSProperties}
          onChange={(event) => seek(Number(event.target.value))}
          onFocus={() => setSliderEngaged(true)}
          onBlur={() => setSliderEngaged(false)}
          onPointerEnter={() => setSliderEngaged(true)}
          onPointerLeave={(event) => { if (document.activeElement !== event.currentTarget) setSliderEngaged(false); }}
        />
      </div>

      <p role="status" aria-label="Progression" className="absolute bottom-3 left-1/2 -translate-x-1/2 font-serif text-xs tracking-wider text-[#8c8275]">
        Chapitre {chapter + 1} sur {chapters.length} · {progress} %
      </p>

      <div className="absolute top-3 left-4 flex gap-2">
        <button type="button" aria-expanded={tocOpen} onClick={() => setTocOpen((open) => !open)} className={controlClass}><ListTree size={13} /> Table des matières</button>
      </div>
      <div className="absolute top-3 right-4 flex gap-2">
        <button type="button" aria-label={theme === "atelier" ? "Passer au Vélin Naturel" : "Passer à l’Atelier Sombre"} onClick={chooseTheme} className={controlClass}>
          {theme === "atelier" ? <Sun size={13} /> : <Moon size={13} />} {theme === "atelier" ? "Vélin Naturel" : "Atelier Sombre"}
        </button>
      </div>

      {tocOpen && (
        <aside aria-label="Tiroir de tranche" className="absolute inset-y-0 left-0 z-10 flex w-72 max-w-full flex-col gap-3 overflow-y-auto border-r border-[#6b5327] bg-[#13110f] p-5 shadow-[8px_0_24px_rgb(0_0_0/50%)]">
          <h2 className="mt-8 font-cinzel text-xs tracking-wider text-[#d4af37] uppercase">Table des matières</h2>
          <ol className="flex flex-col gap-1">
            {chapters.map((entry, index) => (
              <li key={index}>
                <button type="button" aria-current={index === chapter ? "true" : undefined} onClick={() => { setPosition({ chapter: index, spread: 0 }); setTocOpen(false); }} className={`w-full rounded-sm border-l-2 px-3 py-1.5 text-left font-serif text-sm transition-colors ${index === chapter ? "border-[#d4af37] bg-[#211c15] text-[#f3f0ea]" : "border-transparent text-[#c9bea9] hover:bg-[#1a1612]"}`}>{entry.title}</button>
              </li>
            ))}
          </ol>
        </aside>
      )}
    </section>
  );
};
