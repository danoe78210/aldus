import { useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { PDFDocumentProxy } from "pdfjs-dist";
import type { ReaderProps } from "./readerTypes";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const PAGE_GAP = 24;
const EXCERPT_CHARS = 160;
const FALLBACK_WIDTH = 800;

interface PdfReaderProps extends ReaderProps {
  src: string | undefined;
}

/** Pages visibles : seule en simple page ; en vis-à-vis, la première page est isolée puis 2-3, 4-5… */
const visiblePages = (first: number, total: number, double: boolean): number[] => {
  if (!double) return [first];
  const start = first === 0 ? 0 : first % 2 === 1 ? first : first - 1;
  return (start === 0 ? [0] : [start, start + 1]).filter((index) => index < total);
};

const PdfPageCanvas = ({ doc, index, columns, containerWidth, zoom }: { doc: PDFDocumentProxy; index: number; columns: number; containerWidth: number; zoom: number }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let cancelled = false;
    let task: pdfjsLib.RenderTask | null = null;
    void (async () => {
      const page = await doc.getPage(index + 1);
      const canvas = canvasRef.current;
      const context = canvas?.getContext("2d");
      if (cancelled || !canvas || !context) return;
      const base = page.getViewport({ scale: 1 });
      const fit = Math.max(1, containerWidth - PAGE_GAP * (columns - 1)) / columns / base.width;
      const ratio = window.devicePixelRatio || 1;
      const viewport = page.getViewport({ scale: fit * zoom * ratio });
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      canvas.style.width = `${Math.floor(viewport.width / ratio)}px`;
      canvas.style.height = `${Math.floor(viewport.height / ratio)}px`;
      task = page.render({ canvas, canvasContext: context, viewport });
      await task.promise;
    })().catch((reason: unknown) => {
      if (reason instanceof Error && reason.name === "RenderingCancelledException") return;
      console.error(`Lecteur d'Atelier : rendu de la page ${index + 1} impossible.`, reason);
    });
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [columns, containerWidth, doc, index, zoom]);
  return <canvas ref={canvasRef} aria-label={`Page ${index + 1}`} className="max-w-none bg-white shadow-[0_6px_24px_rgba(0,0,0,0.35)]" />;
};

export const PdfReader = ({ src, settings, bookmarks, onView, ref }: PdfReaderProps) => {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [first, setFirst] = useState(0);
  const [width, setWidth] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const excerpt = useRef("");
  const double = settings.pdfView === "double";
  const total = doc?.numPages ?? 0;
  const pages = doc ? visiblePages(first, total, double) : [];

  useEffect(() => {
    let active = true;
    let task: ReturnType<typeof pdfjsLib.getDocument> | null = null;
    void (async () => {
      if (!src) throw new Error("Le Lecteur d'Atelier nécessite l'application Aldus de bureau.");
      const response = await fetch(src);
      if (!response.ok) throw new Error(`Lecture du PDF impossible (${response.status}).`);
      const data = new Uint8Array(await response.arrayBuffer());
      if (!active) return;
      task = pdfjsLib.getDocument({ data });
      const loaded = await task.promise;
      if (active) setDoc(loaded);
    })().catch((reason: unknown) => {
      console.error("Lecteur d'Atelier : PDF illisible.", reason);
      if (active) setError(reason instanceof Error ? reason.message : "PDF illisible.");
    });
    return () => {
      active = false;
      void task?.destroy();
    };
  }, [src]);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setWidth(element.clientWidth));
    observer.observe(element);
    return () => observer.disconnect();
  }, [doc]);

  const lead = pages[0];
  useEffect(() => {
    if (!doc || lead === undefined) return;
    let active = true;
    excerpt.current = "";
    doc.getPage(lead + 1)
      .then((page) => page.getTextContent())
      .then((content) => {
        if (!active) return;
        excerpt.current = content.items.map((item) => ("str" in item ? item.str : "")).join(" ").replace(/\s+/g, " ").trim().slice(0, EXCERPT_CHARS);
      })
      .catch((reason: unknown) => console.warn("Lecteur d'Atelier : extrait PDF indisponible.", reason));
    return () => { active = false; };
  }, [doc, lead]);

  const visibleKey = pages.join(",");
  useEffect(() => {
    if (!doc || lead === undefined) return;
    const shown = visibleKey.split(",").map(Number);
    const marked = bookmarks.find((bookmark) => shown.includes(bookmark.chapter));
    onView({ chapter: lead, label: `${shown.map((index) => index + 1).join("–")} / ${doc.numPages}`, markedId: marked?.id ?? null });
  }, [bookmarks, doc, lead, onView, visibleKey]);

  const move = useCallback((direction: 1 | -1) => {
    if (!doc) return;
    const start = visiblePages(first, doc.numPages, double)[0];
    const step = double ? (direction === 1 ? (start === 0 ? 1 : 2) : (start <= 1 ? start : 2)) : 1;
    setFirst(Math.min(doc.numPages - 1, Math.max(0, start + direction * step)));
    scrollRef.current?.scrollTo?.({ top: 0 });
  }, [doc, double, first]);

  useImperativeHandle(ref, () => ({
    next: () => move(1),
    prev: () => move(-1),
    goTo: (page) => setFirst(Math.min(Math.max(0, total - 1), Math.max(0, page))),
    locate: () => lead === undefined ? null : { chapter: lead, chapterTitle: `Page ${lead + 1}`, position: 0, excerpt: excerpt.current },
  }));

  if (error) return <p role="alert" className="m-auto text-center text-sm text-[#b5543f]">{error}</p>;
  if (!doc) return <p role="status" className="m-auto text-center text-sm opacity-70">Ouverture du PDF…</p>;

  return (
    <div ref={scrollRef} data-testid="pdf-scroll" className="h-full w-full overflow-auto">
      <div className="mx-auto flex min-h-full w-max min-w-full items-center justify-center p-6" style={{ gap: PAGE_GAP }}>
        {pages.map((index) => (
          <PdfPageCanvas key={index} doc={doc} index={index} columns={pages.length} containerWidth={(width || FALLBACK_WIDTH) - 48} zoom={settings.pdfZoom} />
        ))}
      </div>
    </div>
  );
};
