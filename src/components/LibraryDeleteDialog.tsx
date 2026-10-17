import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Trash2, X } from "lucide-react";

interface LibraryDeleteDialogProps {
  title: string;
  busy: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

export const LibraryDeleteDialog = ({ title, busy, error, onCancel, onConfirm }: LibraryDeleteDialogProps) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    cancelRef.current?.focus();
    return () => dialog?.close();
  }, []);

  return createPortal(
    <dialog ref={dialogRef} role="alertdialog" aria-labelledby="library-delete-title" aria-describedby="library-delete-description" onCancel={(event) => { event.preventDefault(); if (!busy) onCancel(); }} className="fixed inset-0 m-auto max-h-[85dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-sm border border-[#725342] bg-[#1a1714] p-5 text-[#e2dbce] shadow-2xl backdrop:bg-black/75">
      <header className="flex items-center justify-between gap-3 border-b border-[#4a3b2c] pb-3">
        <h2 id="library-delete-title" className="font-cinzel text-sm text-[#c5a059]">Supprimer l’ouvrage</h2>
        <button type="button" onClick={onCancel} disabled={busy} title="Annuler la suppression" aria-label="Annuler la suppression" className="p-1 text-[#a99a83] hover:text-[#d4af37] disabled:opacity-40"><X size={18} /></button>
      </header>
      <div id="library-delete-description" className="space-y-3 py-4 font-serif text-sm">
        <p className="break-words">Retirer « {title} » de la bibliothèque et effacer définitivement ses fichiers DOCX, EPUB, PDF et ses couvertures du dossier d’export ?</p>
        <p className="text-[#a99a83]">Cette action est irréversible. Les sources de l’atelier et les couvertures externes ou partagées seront conservées.</p>
      </div>
      {error && <p role="alert" className="mb-4 break-words text-xs text-[#d28b75]">{error}</p>}
      <footer className="flex flex-wrap justify-end gap-3 border-t border-[#4a3b2c] pt-4">
        <button ref={cancelRef} type="button" onClick={onCancel} disabled={busy} className="rounded-sm border border-[#4a3b2c] px-3 py-2 text-xs text-[#c9bea9] hover:border-[#8f6e2b] disabled:opacity-40">Annuler</button>
        <button type="button" onClick={onConfirm} disabled={busy} className="flex items-center gap-2 rounded-sm border border-[#784538] bg-[#321b18] px-3 py-2 text-xs text-[#d7a18d] hover:bg-[#45231e] disabled:opacity-40"><Trash2 size={14} /> {busy ? "Suppression en cours…" : "Effacer définitivement"}</button>
      </footer>
    </dialog>,
    document.body,
  );
};