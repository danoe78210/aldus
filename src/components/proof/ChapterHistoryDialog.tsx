import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { SnapshotEntry } from "../../types";
import { listChapterHistory } from "../../utils/projectApi";

interface Props {
  workspace: string;
  chapter: string;
  onRestore: (filename: string) => Promise<void>;
  onClose: () => void;
}

export const ChapterHistoryDialog = ({ workspace, chapter, onRestore, onClose }: Props) => {
  const dialog = useRef<HTMLDialogElement>(null);
  const [snapshots, setSnapshots] = useState<SnapshotEntry[] | null>(null);
  const [selected, setSelected] = useState<SnapshotEntry | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formatDate = (date: string) => new Date(date).toLocaleString("fr-FR");

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    let active = true;
    void listChapterHistory(workspace, chapter).then(
      (entries) => { if (active) setSnapshots(entries); },
      (cause: unknown) => { if (active) setError(String(cause)); },
    );
    return () => { active = false; element?.close(); };
  }, [workspace, chapter]);

  const restore = async () => {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      await onRestore(selected.filename);
      onClose();
    } catch (cause) {
      setError(String(cause));
    } finally {
      setBusy(false);
    }
  };

  const buttonClass = "rounded-sm border border-[#4a3b2c] px-3 py-2 text-xs text-[#c9bea9] hover:border-[#d4af37] disabled:opacity-40";
  return createPortal(
    <dialog ref={dialog} aria-labelledby="chapter-history-title"
      onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}
      className="fixed inset-0 m-auto max-h-[80dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-sm border border-[#8f6e2b] bg-[#13110f] p-5 text-[#e2dbce] shadow-2xl backdrop:bg-black/75">
      <h2 id="chapter-history-title" className="mb-3 font-serif text-lg text-[#d4af37]">Historique des versions</h2>
      <p className="mb-3 break-words text-sm">{chapter}</p>
      {error && <p role="alert" className="mb-3 text-sm text-[#c25454]">{error}</p>}
      {selected ? (
        <p className="mb-4 text-sm">
          Restaurer la version du {formatDate(selected.createdAt)} remplacera le texte actuel, y compris les corrections non validées.
          Une copie du texte enregistré sera conservée. Continuer ?
        </p>
      ) : (
        <div className="mb-4 space-y-2">
          {!snapshots && !error && <p role="status">Chargement…</p>}
          {snapshots?.length === 0 && <p>Aucune version enregistrée. Un instantané est créé avant chaque modification sauvegardée.</p>}
          {snapshots?.map((snapshot) => (
            <button key={snapshot.filename} type="button" onClick={() => setSelected(snapshot)}
              className={`${buttonClass} block w-full text-left`}>
              {formatDate(snapshot.createdAt)} · {snapshot.sizeBytes.toLocaleString("fr-FR")} octets
            </button>
          ))}
        </div>
      )}
      <footer className="flex flex-wrap justify-end gap-2 border-t border-[#3a3022] pt-3">
        <button type="button" disabled={busy} onClick={() => selected ? setSelected(null) : onClose()} className={buttonClass}>
          {selected ? "Annuler" : "Fermer"}
        </button>
        {selected && <button type="button" disabled={busy} onClick={() => void restore()} className={buttonClass}>
          {busy ? "Restauration…" : "Restaurer cette version"}
        </button>}
      </footer>
    </dialog>, document.body,
  );
};
