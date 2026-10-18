import React, { useEffect, useState } from "react";
import { FolderOpen, Plus, ScanSearch, Trash2, X } from "lucide-react";
import type { AudioGenerationProgress, Book, LibraryConfig, ScannedBook, Shelf, ShelfId } from "../types";
import { addLibraryBook, createCustomShelf, deleteCustomShelf, deleteLibraryAudioTrack, deleteLibraryBook, generateLibraryAudio, getLibraryConfig, moveLibraryBook, scanExportFolder, updateCustomShelf } from "../utils/libraryApi";
import { Bookshelf } from "./Bookshelf";
import { LibraryImportDialog } from "./LibraryImportDialog";
import { LibraryBookDetail } from "./LibraryBookDetail";

const colors = ["#3d1c1c", "#26352d", "#27313d", "#49351e", "#35283a"];

interface LibraryViewProps {
  exportDirectory?: string | null;
  sourceDirectory?: string | null;
  currentBookTitle?: string;
  currentCoverPath?: string | null;
  onPickExportDirectory?: () => void;
}

export const LibraryView: React.FC<LibraryViewProps> = ({ exportDirectory, sourceDirectory, currentBookTitle, currentCoverPath, onPickExportDirectory }) => {
  const [config, setConfig] = useState<LibraryConfig | null>(null);
  const [candidates, setCandidates] = useState<ScannedBook[] | null>(null);
  const [selectedBook, setSelectedBook] = useState<{ id: string; format?: "epub" | "pdf" | "docx" | "audio" } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"main" | "custom">("main");
  const [shelfName, setShelfName] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Shelf | null>(null);
  const [importSummary, setImportSummary] = useState<string | null>(null);

  useEffect(() => {
    getLibraryConfig().then(setConfig).catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : "Chargement de la bibliothèque impossible.");
    });
  }, []);

  if (!config) {
    return <div className="flex h-full items-center justify-center font-serif text-sm text-[#c9bea9]">{error ?? "Chargement de la bibliothèque…"}</div>;
  }

  const update = async (operation: () => Promise<LibraryConfig>): Promise<boolean> => {
    if (busy) return false;
    setBusy(true);
    try {
      setError(null);
      setConfig(await operation());
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const visibleShelves = config.shelves.filter((shelf) => shelf.isVisible);
  const displayedShelves = visibleShelves.filter((shelf) => activeTab === "custom" ? shelf.isCustom : !shelf.isCustom);
  const moveBook = (bookId: string, shelfId: ShelfId) => {
    void update(() => moveLibraryBook(bookId, shelfId));
  };
  const inspectBook = (bookId: string, format?: "epub" | "pdf" | "docx" | "audio") => {
    void update(getLibraryConfig).then((success) => {
      if (success) setSelectedBook({ id: bookId, format });
    });
  };
  const generateAudio = async (
    bookId: string,
    voiceId: string,
    chapterIndex: number,
    onProgress: (progress: AudioGenerationProgress) => void,
  ): Promise<boolean> => {
    if (busy) return false;
    if (!exportDirectory) {
      setError("Choisissez un dossier d’export avant de générer l’audio.");
      return false;
    }
    setBusy(true);
    setError(null);
    try {
      setConfig(await generateLibraryAudio(bookId, exportDirectory, voiceId, chapterIndex, onProgress));
      setImportSummary(`La piste du chapitre ${chapterIndex} a été ajoutée à l’édition audio.`);
      return true;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      return false;
    } finally {
      setBusy(false);
    }
  };
  const deleteAudioTrack = async (bookId: string, chapterIndex: number): Promise<boolean> => {
    if (!exportDirectory) {
      setError("Choisissez le dossier d’export avant de supprimer la piste audio.");
      return false;
    }
    const success = await update(() => deleteLibraryAudioTrack(bookId, chapterIndex, exportDirectory));
    if (success) setImportSummary(`La piste audio du chapitre ${chapterIndex} a été supprimée.`);
    return success;
  };
  const removeShelf = (shelf: Shelf) => {
    void update(() => deleteCustomShelf(shelf.id)).then((success) => {
      if (success) setPendingDelete(null);
    });
  };

  const scan = async () => {
    if (busy) return;
    if (!exportDirectory) {
      setError("Choisissez un dossier d'export avant de lancer le scan.");
      return;
    }
    setBusy(true);
    setError(null);
    setImportSummary(null);
    try {
      setCandidates(await scanExportFolder(exportDirectory));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };

  const importBook = (candidate: ScannedBook, values: Pick<Book, "title" | "tome" | "shelfId">) => {
    const normalizeTitle = (value: string) => value.replace(/_/g, " ").trim().toLocaleLowerCase("fr");
    const matchesProject = !!currentBookTitle && normalizeTitle(candidate.title) === normalizeTitle(currentBookTitle);
    const fallbackCover = matchesProject ? currentCoverPath : undefined;
    const book: Book = {
      id: crypto.randomUUID(),
      chapterCount: 0,
      chapterCountAvailable: false,
      ...values,
      colorHex: colors[config.books.length % colors.length],
      files: candidate.files,
      coverPath: candidate.coverPath ?? fallbackCover ?? undefined,
      sourceDirectory: matchesProject ? sourceDirectory ?? undefined : undefined,
    };
    void update(async () => {
      const updated = await addLibraryBook(book);
      const saved = updated.books.find((item) => item.files?.some((file) => candidate.files.some((incoming) => incoming.path === file.path)));
      if (saved) {
        const formats = (["epub", "pdf", "docx"] as const).filter((format) => saved.files?.some((file) => file.format === format)).map((format) => format.toUpperCase());
        setImportSummary(`« ${saved.title} » : ${formats.join(" + ")}${formats.length > 1 ? " unifiés dans une seule fiche." : " importé."}`);
      }
      return updated;
    }).then((success) => {
      if (success) {
        setCandidates((current) => current?.filter((item) => item !== candidate) ?? null);
      }
    });
  };

  const selectedBookDetails = selectedBook ? config.books.find((book) => book.id === selectedBook.id) : undefined;
  if (selectedBookDetails) {
    return (
      <div className="flex h-full w-full flex-col gap-4 overflow-y-auto px-4 py-5 text-left sm:px-8">
        <LibraryBookDetail key={selectedBookDetails.id} book={selectedBookDetails} initialFormat={selectedBook?.format} exportDirectory={exportDirectory} shelves={visibleShelves} busy={busy} operationError={error} onMove={moveBook} onGenerateAudio={generateAudio} onDeleteAudioTrack={deleteAudioTrack} onDelete={async (bookId) => {
          const success = await update(() => deleteLibraryBook(bookId, exportDirectory ?? ""));
          if (success) {
            setSelectedBook(null);
            setActiveTab("main");
            setImportSummary("Ouvrage retiré de la bibliothèque et fichiers d’export supprimés.");
          }
          return success;
        }} onBack={() => {
          setActiveTab(visibleShelves.find((shelf) => shelf.id === selectedBookDetails.shelfId)?.isCustom ? "custom" : "main");
          setSelectedBook(null);
        }} />
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col gap-4 overflow-y-auto px-4 py-5 text-left sm:px-8">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-[#382f22] pb-3">
        <div>
          <p className="font-cinzel text-[10px] uppercase tracking-[0.2em] text-[#8f6e2b]">Banc IV</p>
          <h1 className="font-cinzel text-lg uppercase tracking-wider text-[#d4af37]">Bibliothèque</h1>
        </div>
        <div className="flex max-w-full flex-wrap items-center gap-2">
          <button type="button" disabled={busy} onClick={() => void scan()} className="flex min-w-0 items-center gap-2 rounded-sm border border-[#8f6e2b] bg-[#211c15] px-3 py-2 text-left font-cinzel text-[10px] text-[#d4af37] hover:bg-[#302619] disabled:opacity-40">
            <ScanSearch size={16} className="shrink-0" /> Scanner le dossier d’export
          </button>
          {onPickExportDirectory && <button type="button" onClick={onPickExportDirectory} disabled={busy} title={exportDirectory ?? "Choisir le dossier d’export"} aria-label="Choisir le dossier d’export" className="p-2 text-[#c5a059] hover:text-[#d4af37]"><FolderOpen size={16} /></button>}
        </div>
        <div role="tablist" aria-label="Rayons de la bibliothèque" className="flex w-full flex-wrap gap-x-5 gap-y-1">
          {([
            ["main", "Rayons Principaux"],
            ["custom", "Rayons Personnalisés"],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              id={`library-tab-${id}`}
              type="button"
              role="tab"
              aria-selected={activeTab === id}
              aria-controls="library-shelves"
              onClick={() => { setActiveTab(id); setPendingDelete(null); }}
              onKeyDown={(event) => {
                if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
                  event.preventDefault();
                  const next = event.key === "Home" ? "main" : event.key === "End" ? "custom" : id === "main" ? "custom" : "main";
                  setActiveTab(next);
                  setPendingDelete(null);
                  document.getElementById(`library-tab-${next}`)?.focus();
                }
              }}
              tabIndex={activeTab === id ? 0 : -1}
              className={`border-b-2 py-2 font-cinzel text-[11px] transition-colors ${activeTab === id ? "border-[#d4af37] text-[#d4af37]" : "border-transparent text-[#a58a60] hover:text-[#d4af37]"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      {error && <p role="alert" className="text-xs text-[#d28b75]">{error}</p>}

      <div id="library-shelves" role="tabpanel" aria-labelledby={`library-tab-${activeTab}`} aria-busy={busy} className="flex flex-col gap-7 pb-5">
        {candidates === null && importSummary && <p role="status" className="text-xs text-[#c5a059]">{importSummary}</p>}
        {activeTab === "custom" && (
          <form onSubmit={(event) => {
            event.preventDefault();
            if (!shelfName.trim()) return;
            void update(() => createCustomShelf(shelfName)).then((success) => {
              if (success) setShelfName("");
            });
          }} className="flex flex-wrap items-center gap-3">
            <label htmlFor="library-shelf-name" className="sr-only">Nom du nouveau rayon</label>
            <input id="library-shelf-name" required value={shelfName} onChange={(event) => setShelfName(event.target.value)} placeholder="Nom du rayon" className="min-w-0 w-48 max-w-full border-b border-[#4a3b2c] bg-transparent py-2 font-serif text-sm text-[#f3f0ea] placeholder:text-[#786c59] focus:border-[#d4af37] focus:outline-hidden" />
            <button type="submit" disabled={busy || !shelfName.trim()} className="flex items-center gap-2 border border-[#6b5327] px-3 py-2 font-cinzel text-[10px] text-[#d4af37] hover:bg-[#251f18] disabled:opacity-40">
              <Plus size={14} className="shrink-0" /> Ajouter un nouveau rayon
            </button>
          </form>
        )}
        {pendingDelete && (
          <div role="alert" className="flex flex-wrap items-center gap-3 border-y border-[#6b5327] py-3 text-xs text-[#e2dbce]">
            <p className="min-w-0 flex-1 break-words">Supprimer « {pendingDelete.label} » ? Ses livres seront replacés dans En cours.</p>
            <button type="button" disabled={busy} onClick={() => removeShelf(pendingDelete)} className="flex items-center gap-1 text-[#d28b75]"><Trash2 size={14} /> Supprimer</button>
            <button type="button" disabled={busy} onClick={() => setPendingDelete(null)} title="Annuler la suppression" aria-label="Annuler la suppression" className="p-1"><X size={16} /></button>
          </div>
        )}
        {displayedShelves.map((shelf) => (
          <Bookshelf
            key={shelf.id}
            shelf={shelf}
            books={config.books.filter((book) => book.shelfId === shelf.id)}
            shelves={visibleShelves}
            disabled={busy}
            onInspect={inspectBook}
            onRename={(item, label) => {
              void update(() => updateCustomShelf({ ...item, label }));
            }}
            onDelete={(item) => {
              if (config.books.some((book) => book.shelfId === item.id)) setPendingDelete(item);
              else removeShelf(item);
            }}
            onMoveBook={moveBook}
          />
        ))}
      </div>
      {candidates !== null && <LibraryImportDialog candidates={candidates} shelves={visibleShelves} books={config.books} busy={busy} error={error} summary={importSummary} onImport={importBook} onClose={() => setCandidates(null)} />}
    </div>
  );
};