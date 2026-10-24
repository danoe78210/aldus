import { useState } from "react";
import { ArrowLeft, AudioLines, BookOpen, Trash2 } from "lucide-react";
import type { Book, SalonTarget, Shelf } from "../types";
import { libraryCoverUrl, openLibraryResource } from "../utils/libraryApi";
import { LibraryDeleteDialog } from "./LibraryDeleteDialog";
import { WorkshopReaderView } from "./reader/WorkshopReaderView";

interface LibraryBookDetailProps {
  book: Book;
  initialFormat?: "epub" | "pdf" | "docx" | "audio";
  shelves: Shelf[];
  busy: boolean;
  onBack: () => void;
  onMove: (bookId: string, shelfId: string) => void;
  onDelete: (bookId: string) => Promise<boolean>;
  operationError?: string | null;
  /** Confie la lecture au Salon de lecture ; sans lui, le lecteur s'ouvre ici. */
  onRead?: (target: SalonTarget) => void;
}

export const LibraryBookDetail = ({ book, initialFormat, shelves, busy, onBack, onMove, onDelete, operationError, onRead }: LibraryBookDetailProps) => {
  const [error, setError] = useState<string | null>(null);
  const [failedCover, setFailedCover] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [reading, setReading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const standardFiles = (["epub", "pdf", "docx"] as const).flatMap((format) => (book.files ?? [])
    .filter((file) => file.format === format)
    .sort((first, second) => (book.fileStatistics?.[second.path]?.lastModified ?? 0) - (book.fileStatistics?.[first.path]?.lastModified ?? 0))
    .slice(0, 1));
  const files = book.audio?.chapters[0] ? [...standardFiles, { path: book.audio.chapters[0].path, format: "audio" as const }] : standardFiles;
  const [selectedPath, setSelectedPath] = useState<string | null>(() => files.find((file) => file.format === initialFormat)?.path ?? null);
  const selectedFile = files.find((file) => file.path === selectedPath) ?? files.find((file) => file.format === "epub") ?? files[0];
  const statistics = selectedFile ? book.fileStatistics?.[selectedFile.path] : undefined;
  const legacyStatistics = !statistics && selectedFile?.format !== "docx";
  const pageCount = statistics ? statistics.pageCount : legacyStatistics ? book.pageCount : undefined;
  const lastModified = statistics ? statistics.lastModified : legacyStatistics ? book.lastModified : undefined;
  const coverUrl = book.coverPath ? libraryCoverUrl(book.coverPath) : undefined;
  const modifiedDate = lastModified != null ? new Date(lastModified) : null;
  const validDate = modifiedDate && !Number.isNaN(modifiedDate.getTime()) ? modifiedDate : null;
  const open = async () => {
    if (opening || !selectedFile) return;
    if (selectedFile.format !== "audio") {
      setError(null);
      if (onRead) onRead({ bookId: book.id, file: { path: selectedFile.path, format: selectedFile.format } });
      else setReading(true);
      return;
    }
    setOpening(true);
    try {
      setError(null);
      await openLibraryResource(book.id, selectedFile.path);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setOpening(false);
    }
  };

  return (
    <section aria-labelledby="library-register-title" className="flex min-w-0 flex-col gap-5">
      <button type="button" onClick={onBack} disabled={busy} className="flex w-fit items-center gap-2 py-1 font-cinzel text-xs text-[#c5a059] hover:text-[#d4af37] disabled:opacity-40"><ArrowLeft size={16} /> Retour aux rayons</button>
      <h2 id="library-register-title" className="font-cinzel text-sm text-[#d4af37]">Le Registre du Livre</h2>
      <div className="flex flex-wrap items-start gap-6">
        <div className="aspect-[2/3] w-40 max-w-full shrink-0 overflow-hidden rounded-sm border border-[#6b5327] bg-[#181614] shadow-lg">
          {coverUrl && failedCover !== coverUrl ? (
            <img src={coverUrl} alt={`Couverture de ${book.title}`} onError={() => setFailedCover(coverUrl)} className="h-full w-full object-contain" />
          ) : (
            <div role="img" aria-label={`Couverture vierge de ${book.title}`} className="flex h-full flex-col items-center justify-center gap-5 border-l-[6px] border-[#382f22] px-4 text-center text-[#b89355]">
              <BookOpen size={28} strokeWidth={1} />
              <span className="max-w-full break-words font-cinzel text-sm">{book.title}</span>
              {book.tome && <span className="font-serif text-xs">Tome {book.tome}</span>}
            </div>
          )}
        </div>
        <div className="flex min-w-0 flex-[1_1_180px] flex-col gap-4">
          <div>
            <h3 className="break-words font-cinzel text-base text-[#f3f0ea]">{book.title}</h3>
            {book.tome && <p className="mt-1 font-serif text-sm text-[#c9bea9]">Tome {book.tome}</p>}
          </div>
          <label className="text-sm text-[#c9bea9]">Emplacement actuel
            <select value={book.shelfId} disabled={busy} onChange={(event) => onMove(book.id, event.target.value)} className="mt-2 w-full min-w-0 rounded-sm border border-[#4a3b2c] bg-[#141210] px-2 py-2 text-base text-[#f3f0ea]">
              {shelves.map((shelf) => <option key={shelf.id} value={shelf.id}>{shelf.label}</option>)}
            </select>
          </label>
          {files.length > 0 && (
            <div role="group" aria-label="Formats disponibles" className="flex flex-wrap gap-2">
              {files.map((file) => (
                <button key={file.path} type="button" aria-pressed={selectedFile?.path === file.path} disabled={busy || opening} title={file.path} onClick={() => { setSelectedPath(file.path); setError(null); }} className={`rounded-sm border px-2.5 py-1 font-cinzel text-xs transition-colors disabled:opacity-40 ${selectedFile?.path === file.path ? "border-[#d4af37] bg-[#302619] text-[#d4af37]" : "border-[#4a3b2c] text-[#a99a83] hover:border-[#8f6e2b] hover:text-[#d4af37]"}`}>
                  {file.format.toUpperCase()}
                </button>
              ))}
            </div>
          )}
          <div className="flex flex-col items-start gap-3 border-t border-[#382f22] pt-4">
            <button type="button" disabled={busy || opening || !selectedFile} onClick={() => void open()} className="flex max-w-full items-center gap-2 rounded-sm border border-[#8f6e2b] bg-[#211c15] px-3 py-2 text-left font-cinzel text-sm text-[#d4af37] hover:bg-[#302619] disabled:opacity-40"><BookOpen size={16} className="shrink-0" /> Ouvrir le livre</button>
          </div>
          {book.audio && <p className="flex items-center gap-2 border-t border-[#382f22] pt-4 font-serif text-sm text-[#a99a83]"><AudioLines size={15} className="shrink-0 text-[#d4af37]" /> Édition audio · {book.audio.chapters.length} piste(s) — à retrouver dans le Studio Audio.</p>}
          <section aria-label="Statistiques de l’ouvrage" className="border-t border-[#382f22] pt-4">
            <dl className="space-y-3 font-serif text-sm text-[#8c8275]">
              <div className="flex flex-wrap justify-between gap-x-3 gap-y-1"><dt>Nbre de pages :</dt><dd>{pageCount ?? "Non disponible"}</dd></div>
              {selectedFile?.format === "docx" && <div className="flex flex-wrap justify-between gap-x-3 gap-y-1"><dt>Nbre de mots :</dt><dd>{statistics?.wordCount?.toLocaleString("fr-FR") ?? "\u2014"}</dd></div>}
              <div className="flex flex-wrap justify-between gap-x-3 gap-y-1"><dt>Date de dernière modification :</dt><dd>{validDate ? <time dateTime={validDate.toISOString()}>{validDate.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</time> : "Non disponible"}</dd></div>
            </dl>
          </section>
          <div className="border-t border-[#382f22] pt-4">
            <button type="button" disabled={busy || opening} onClick={() => setConfirmDelete(true)} className="flex items-center gap-2 py-1 font-serif text-xs text-[#b17b64] hover:text-[#d7a18d] disabled:opacity-40"><Trash2 size={14} /> Supprimer l’ouvrage</button>
          </div>
        </div>
      </div>
      {error && <p role="alert" className="text-xs text-[#d28b75]">{error}</p>}
      {operationError && !confirmDelete && <p role="alert" className="text-xs text-[#d28b75]">{operationError}</p>}
      {confirmDelete && <LibraryDeleteDialog title={book.title} busy={busy} error={operationError} onCancel={() => setConfirmDelete(false)} onConfirm={() => { void onDelete(book.id); }} />}
      {reading && selectedFile && selectedFile.format !== "audio" && <WorkshopReaderView book={book} file={{ path: selectedFile.path, format: selectedFile.format }} onClose={() => setReading(false)} />}
    </section>
  );
};