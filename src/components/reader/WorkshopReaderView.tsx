import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { createPortal } from "react-dom";
import { Bookmark, ChevronLeft, ChevronRight, ListTree, Settings2, X } from "lucide-react";
import type { Book, ReaderChapter } from "../../types";
import { libraryCoverUrl } from "../../utils/libraryApi";
import { readBookContent } from "../../utils/readerApi";
import { ReaderDrawer } from "./ReaderDrawer";
import { loadReaderSettings, READER_THEMES, saveReaderSettings } from "./readerSettings";
import type { ReaderSettings } from "./readerSettings";
import type { ReaderHandle, ReaderView } from "./readerTypes";
import { TextReader } from "./TextReader";
import { chromeClass, useSilenceMode } from "./useSilenceMode";
import { useReaderBookmarks } from "./useReaderBookmarks";

const PdfReader = lazy(() => import("./PdfReader").then((module) => ({ default: module.PdfReader })));

interface WorkshopReaderViewProps {
  book: Book;
  file: { path: string; format: "epub" | "pdf" | "docx" };
  onClose: () => void;
}

type Panel = "toc" | "bookmarks" | null;

const iconButton = "flex size-9 items-center justify-center rounded-full border border-amber-900/20 transition-colors hover:border-current";

export const WorkshopReaderView = ({ book, file, onClose }: WorkshopReaderViewProps) => {
  const isPdf = file.format === "pdf";
  const [settings, setSettings] = useState<ReaderSettings>(loadReaderSettings);
  const [chapters, setChapters] = useState<ReaderChapter[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [view, setView] = useState<ReaderView | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const readerRef = useRef<ReaderHandle>(null);
  const idle = useSilenceMode();
  const { bookmarks, error: bookmarkError, add, remove } = useReaderBookmarks(book.id, file.format);
  const theme = READER_THEMES.find((candidate) => candidate.id === settings.theme) ?? READER_THEMES[0];
  const chrome = chromeClass(idle);

  useEffect(() => {
    if (isPdf) return;
    let active = true;
    readBookContent(book.id, file.path).then((content) => {
      if (!active) return;
      if (content.chapters.length === 0) setLoadError("Ce livre ne contient aucun texte lisible.");
      else setChapters(content.chapters);
    }).catch((reason: unknown) => {
      if (active) setLoadError(reason instanceof Error ? reason.message : String(reason));
    });
    return () => { active = false; };
  }, [book.id, file.path, isPdf]);

  const update = (patch: Partial<ReaderSettings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveReaderSettings(next);
  };

  const toggleBookmark = () => {
    if (view?.markedId) {
      void remove(view.markedId);
      return;
    }
    const location = readerRef.current?.locate();
    if (location) void add(location);
  };

  const onKeyDown = useCallback((event: KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    const target = event.target;
    if (target instanceof HTMLElement && (target.closest("input, select, textarea") || target.closest("button") && event.key === " ")) return;
    if (["ArrowRight", "PageDown", " "].includes(event.key)) {
      event.preventDefault();
      readerRef.current?.next();
    } else if (["ArrowLeft", "PageUp"].includes(event.key)) {
      event.preventDefault();
      readerRef.current?.prev();
    }
  }, [onClose]);

  useEffect(() => {
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onKeyDown]);

  const marked = Boolean(view?.markedId);
  const togglePanel = (next: Exclude<Panel, null>) => setPanel((current) => (current === next ? null : next));

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Lecteur d'Atelier — ${book.title}`}
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: theme.background, color: theme.text, "--reader-accent": theme.accent } as CSSProperties}
    >
      <header className={`flex h-14 shrink-0 items-center justify-between gap-3 border-b border-amber-900/20 px-4 ${chrome}`}>
        <button type="button" aria-label="Retour au Registre" title="Retour au Registre (Échap)" onClick={onClose} className={iconButton}><X size={16} /></button>
        <p className="min-w-0 truncate text-center font-cinzel text-xs tracking-wide">{book.title}</p>
        <div className="flex items-center gap-2">
          {!isPdf && <button type="button" aria-label="Table des matières" aria-pressed={panel === "toc"} onClick={() => togglePanel("toc")} className={iconButton}><ListTree size={16} /></button>}
          <button type="button" aria-label="Signets dorés" aria-pressed={panel === "bookmarks"} onClick={() => togglePanel("bookmarks")} className={iconButton}><Bookmark size={16} /></button>
          <button type="button" aria-label="Réglages typographiques" aria-pressed={drawerOpen} onClick={() => setDrawerOpen((open) => !open)} className={iconButton}><Settings2 size={16} /></button>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1">
        {panel && (
          <nav aria-label={panel === "toc" ? "Table des matières" : "Signets dorés"} className={`w-72 max-w-[40%] shrink-0 overflow-y-auto border-r border-amber-900/20 p-4 text-sm ${chrome}`}>
            {panel === "toc" && chapters && (
              <ol className="flex flex-col gap-1">
                {chapters.map((chapter, index) => (
                  <li key={index}>
                    <button type="button" aria-current={view?.chapter === index ? "true" : undefined} onClick={() => readerRef.current?.goTo(index, 0)} className={`w-full rounded-sm px-2 py-1.5 text-left hover:bg-amber-900/10 ${view?.chapter === index ? "font-medium" : "opacity-80"}`}>{chapter.title}</button>
                  </li>
                ))}
              </ol>
            )}
            {panel === "bookmarks" && (bookmarks.length === 0
              ? <p className="text-xs opacity-70">Cliquez en haut de la page pour poser un signet doré.</p>
              : (
                <ul className="flex flex-col gap-3">
                  {[...bookmarks].sort((a, b) => b.createdAt - a.createdAt).map((bookmark) => (
                    <li key={bookmark.id} className="flex items-start gap-2 border-b border-amber-900/20 pb-2">
                      <button type="button" onClick={() => readerRef.current?.goTo(bookmark.chapter, bookmark.position)} className="min-w-0 flex-1 text-left">
                        <span className="block truncate font-medium">{bookmark.chapterTitle}</span>
                        {bookmark.excerpt && <span className="mt-0.5 line-clamp-2 text-xs italic opacity-70">{bookmark.excerpt}</span>}
                      </button>
                      <button type="button" aria-label={`Retirer le signet ${bookmark.chapterTitle}`} onClick={() => void remove(bookmark.id)} className="shrink-0 opacity-60 hover:opacity-100"><X size={14} /></button>
                    </li>
                  ))}
                </ul>
              ))}
          </nav>
        )}

        <main className="relative min-w-0 flex-1">
          <button
            type="button"
            aria-label={marked ? "Retirer le signet doré" : "Poser un signet doré"}
            aria-pressed={marked}
            disabled={!view}
            onClick={toggleBookmark}
            className="group absolute top-0 right-[10%] z-10 flex h-14 w-12 justify-center"
          >
            <span
              aria-hidden="true"
              className={`block h-12 w-5 bg-[#d4af37] shadow-md transition-opacity ${marked ? "opacity-100" : `opacity-0 group-hover:opacity-60 group-focus-visible:opacity-60`}`}
              style={{ clipPath: "polygon(0 0, 100% 0, 100% 100%, 50% 80%, 0 100%)" }}
            />
          </button>

          <div className="absolute inset-x-0 top-6 bottom-12 px-[6%]">
            {loadError || bookmarkError ? (
              <p role="alert" className="m-auto mt-16 text-center text-sm text-[#b5543f]">{loadError ?? bookmarkError}</p>
            ) : isPdf ? (
              <Suspense fallback={<p role="status" className="mt-16 text-center text-sm opacity-70">Ouverture du PDF…</p>}>
                <PdfReader ref={readerRef} src={libraryCoverUrl(file.path)} settings={settings} bookmarks={bookmarks} onView={setView} />
              </Suspense>
            ) : chapters ? (
              <TextReader ref={readerRef} chapters={chapters} settings={settings} bookmarks={bookmarks} onView={setView} />
            ) : (
              <p role="status" className="mt-16 text-center text-sm opacity-70">Ouverture du livre…</p>
            )}
          </div>

          <button type="button" aria-label="Page précédente" onClick={() => readerRef.current?.prev()} className={`absolute top-1/2 left-3 z-10 -translate-y-1/2 ${iconButton} ${chrome}`}><ChevronLeft size={18} /></button>
          <button type="button" aria-label="Page suivante" onClick={() => readerRef.current?.next()} className={`absolute top-1/2 right-3 z-10 -translate-y-1/2 ${iconButton} ${chrome}`}><ChevronRight size={18} /></button>
          {view && <p aria-live="polite" className={`absolute inset-x-0 bottom-3 text-center text-xs tabular-nums ${chrome}`}><span className="opacity-70">{view.label}</span></p>}
        </main>

        {drawerOpen && (
          <div className={chrome}>
            <ReaderDrawer settings={settings} isPdf={isPdf} onChange={update} />
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
};
