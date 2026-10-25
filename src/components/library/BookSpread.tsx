import { useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef } from "react";
import type { ReactNode, RefObject, Ref } from "react";
import { createPortal } from "react-dom";
import { PageFlip } from "page-flip";
import type { PageFlipSettings } from "page-flip";

export const COLUMN_GAP = 64;
/** Rapport hauteur / largeur d'une page. */
export const PAGE_RATIO = 1.4;

const SETTINGS: PageFlipSettings = {
  size: "stretch",
  width: 1000,
  height: 1000 * PAGE_RATIO,
  minWidth: 100,
  maxWidth: 2000,
  minHeight: 100,
  maxHeight: 4000,
  usePortrait: false,
  showCover: false,
  autoSize: false,
  drawShadow: true,
  maxShadowOpacity: 0.5,
  flippingTime: 550,
};

export interface SpreadHandle {
  flipNext: () => void;
  flipPrev: () => void;
}

interface BookSpreadProps {
  ref?: Ref<SpreadHandle>;
  /** Nombre de pages du chapitre (toujours pair : la dernière double page est complète). */
  pageCount: number;
  /** Double page affichée. */
  spread: number;
  /** Pas d'une page dans le flux : largeur de colonne + gouttière. */
  step: number;
  width: number;
  height: number;
  body: ReactNode;
  bookTitle: string;
  chapterTitle: string;
  onTurn: (spread: number) => void;
}

/** `destroy()` laisse tourner la boucle d'animation de la bibliothèque : on neutralise son rendu pour qu'elle ne touche plus aux pages. */
const retire = (instance: PageFlip) => {
  instance.destroy();
  Object.assign(instance.getRender(), { render: () => undefined });
};

/** Exécute un réglage de la bibliothèque sans qu'elle remonte d'événement `flip`, après avoir terminé le tour de page en cours. */
const silently = (quiet: RefObject<boolean>, instance: PageFlip | null, action: (instance: PageFlip) => void) => {
  if (!instance) return;
  quiet.current = true;
  try {
    instance.getRender().finishAnimation();
    action(instance);
  } finally {
    quiet.current = false;
  }
};

/** Le livre : StPageFlip anime des pages vides, dans lesquelles chaque page expose sa colonne du flux du chapitre. */
export const BookSpread = ({ ref, pageCount, spread, step, width, height, body, bookTitle, chapterTitle, onTurn }: BookSpreadProps) => {
  const stageRef = useRef<HTMLDivElement>(null);
  const flipRef = useRef<PageFlip | null>(null);
  const quiet = useRef(false);
  const turnRef = useRef(onTurn);
  const pages = useMemo(() => Array.from({ length: pageCount }, () => {
    const element = document.createElement("div");
    element.className = "reading-salon-page";
    return element;
  }), [pageCount]);

  useEffect(() => { turnRef.current = onTurn; });

  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage || pages.length === 0) return;
    if (flipRef.current) {
      silently(quiet, flipRef.current, (instance) => instance.updateFromHtml(pages));
      return;
    }
    const host = document.createElement("div");
    host.style.cssText = "width: 100%; height: 100%";
    stage.appendChild(host);
    const instance = new PageFlip(host, SETTINGS);
    instance.loadFromHTML(pages);
    instance.on("flip", (event) => { if (!quiet.current) turnRef.current(Math.floor(Number(event.data) / 2)); });
    flipRef.current = instance;
  }, [pages]);

  useLayoutEffect(() => {
    if (flipRef.current && flipRef.current.getCurrentPageIndex() !== spread * 2) {
      silently(quiet, flipRef.current, (instance) => instance.turnToPage(spread * 2));
      stageRef.current?.animate?.({ opacity: [0, 1] }, { duration: 240 });
    }
  }, [spread, pages]);

  useLayoutEffect(() => { silently(quiet, flipRef.current, (instance) => instance.update()); }, [width, height]);

  useEffect(() => () => {
    const instance = flipRef.current;
    flipRef.current = null;
    if (instance) retire(instance);
  }, []);

  useImperativeHandle(ref, () => ({
    flipNext: () => flipRef.current?.flipNext(),
    flipPrev: () => flipRef.current?.flipPrev(),
  }), []);

  return (
    <>
      <div ref={stageRef} className="salon-stage" />
      {pages.map((element, index) => {
        const side = index % 2 === 0 ? "verso" : "recto";
        return createPortal(
          <div className="salon-sheet" data-side={side} data-page={index} aria-hidden={index !== spread * 2 || undefined}>
            <p className="salon-head" data-side={side}>{side === "verso" ? bookTitle : chapterTitle}</p>
            {Math.abs(Math.floor(index / 2) - spread) <= 1 && (
              <div className="salon-clip">
                <article lang="fr" aria-label={chapterTitle} className="salon-flow" style={{ columnGap: COLUMN_GAP, transform: `translateX(${-index * step}px)` }}>{body}</article>
              </div>
            )}
            <p className="salon-folio" data-side={side} aria-label={side === "verso" ? "Folio gauche" : "Folio droit"}>{index + 1}</p>
          </div>,
          element,
          String(index),
        );
      })}
    </>
  );
};
