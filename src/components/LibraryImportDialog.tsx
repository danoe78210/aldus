import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Download, X } from "lucide-react";
import type { Book, ScannedBook, Shelf } from "../types";

interface ImportRowProps {
  candidate: ScannedBook;
  shelves: Shelf[];
  busy: boolean;
  existingBook?: Book;
  onImport: (candidate: ScannedBook, values: Pick<Book, "title" | "tome" | "shelfId">) => void;
}

const fieldClass = "min-w-0 w-full rounded-sm border border-[#4a3b2c] bg-[#141210] px-2 py-2 text-sm text-[#f3f0ea] focus:border-[#d4af37] focus:outline-hidden";

const ImportRow = ({ candidate, shelves, busy, onImport, existingBook }: ImportRowProps) => {
  const [title, setTitle] = useState(existingBook?.title ?? candidate.title);
  const [tome, setTome] = useState(existingBook?.tome ?? "");
  const [shelfId, setShelfId] = useState(existingBook?.shelfId ?? shelves[0]?.id ?? "in_progress");

  return (
    <form onSubmit={(event) => {
      event.preventDefault();
      if (title.trim()) onImport(candidate, { title: title.trim(), tome: tome.trim() || undefined, shelfId });
    }} className="flex flex-col gap-3 border-b border-[#382f22] py-4 last:border-0">
      {existingBook && <p className="text-xs text-[#c5a059]">Formats à ajouter à « {existingBook.title} »</p>}
      <ul className="text-xs text-[#a99a83]">
        {candidate.files.map((file) => <li key={file.path} className="break-all">{file.path.split(/[\\/]/).pop()}</li>)}
        {candidate.coverPath && <li className="break-all">{candidate.coverPath.split(/[\\/]/).pop()}</li>}
      </ul>
      <div className="grid grid-cols-[minmax(0,1fr)_5rem] gap-3">
        <label className="text-xs text-[#c9bea9]">Titre
          <input required value={title} readOnly={!!existingBook} disabled={busy} onChange={(event) => setTitle(event.target.value)} className={`${fieldClass} mt-1`} />
        </label>
        <label className="text-xs text-[#c9bea9]">Tome
          <input value={tome} readOnly={!!existingBook} disabled={busy} onChange={(event) => setTome(event.target.value)} className={`${fieldClass} mt-1`} />
        </label>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <label className="min-w-0 flex-1 text-xs text-[#c9bea9]">Rayon de destination
          <select value={shelfId} disabled={busy || !!existingBook} onChange={(event) => setShelfId(event.target.value)} className={`${fieldClass} mt-1`}>
            {shelves.map((shelf) => <option key={shelf.id} value={shelf.id}>{shelf.label}</option>)}
          </select>
        </label>
        <button type="submit" disabled={busy || !title.trim()} className="flex items-center gap-2 rounded-sm border border-[#8f6e2b] px-3 py-2 text-xs text-[#d4af37] hover:bg-[#251f18] disabled:opacity-40"><Download size={14} /> Importer</button>
      </div>
    </form>
  );
};

interface LibraryImportDialogProps {
  candidates: ScannedBook[];
  shelves: Shelf[];
  busy: boolean;
  error: string | null;
  summary?: string | null;
  books?: Book[];
  onClose: () => void;
  onImport: ImportRowProps["onImport"];
}

export const LibraryImportDialog = ({ candidates, shelves, busy, error, summary, books = [], onClose, onImport }: LibraryImportDialogProps) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  return createPortal(
    <dialog ref={dialogRef} aria-labelledby="library-import-title" onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }} className="fixed inset-0 m-auto max-h-[85dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-sm border border-[#6b5327] bg-[#1a1714] p-5 text-[#f3f0ea] shadow-2xl backdrop:bg-black/75">
      <header className="flex items-center justify-between gap-3 border-b border-[#4a3b2c] pb-3">
        <h2 id="library-import-title" className="font-cinzel text-sm text-[#d4af37]">Intégrer les exports</h2>
        <button type="button" disabled={busy} onClick={onClose} aria-label="Fermer l’import" title="Fermer l’import" className="p-1 text-[#c9bea9] hover:text-[#d4af37] disabled:opacity-40"><X size={18} /></button>
      </header>
      {error && <p role="alert" className="mt-3 text-sm text-[#d28b75]">{error}</p>}
      {summary && <p role="status" className="mt-3 break-words text-sm text-[#c5a059]">{summary}</p>}
      {candidates.length === 0 && !summary && <p role="status" className="py-6 font-serif text-sm text-[#c9bea9]">Aucun nouvel export à importer.</p>}
      {candidates.map((candidate) => <ImportRow key={candidate.files[0].path} candidate={candidate} shelves={shelves} busy={busy} existingBook={books.find((book) => book.id === candidate.existingBookId)} onImport={onImport} />)}
    </dialog>,
    document.body,
  );
};