import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { PlugZap, X } from "lucide-react";

interface AudioSetupDialogProps {
  checking: boolean;
  onRetry: () => void;
  onClose: () => void;
}

export const AudioSetupDialog = ({ checking, onRetry, onClose }: AudioSetupDialogProps) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  const setupCommands = [
    "py -3.10 -m venv .venv-xtts",
    ".venv-xtts\\Scripts\\Activate.ps1",
    "python -m pip install torch torchaudio",
    "python -m pip install -r scripts/requirements-xtts.txt",
    "python scripts/xtts_wrapper.py",
  ].join("\n");

  return createPortal(
    <dialog ref={dialogRef} aria-labelledby="audio-setup-title" onCancel={(event) => { event.preventDefault(); onClose(); }} className="fixed inset-0 m-auto max-h-[88dvh] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto rounded-sm border border-[#6b5327] bg-[#191612] p-5 text-[#e2dbce] shadow-2xl backdrop:bg-black/75 sm:p-6">
      <header className="flex items-start justify-between gap-4 border-b border-[#4a3b2c] pb-4">
        <div>
          <p className="font-cinzel text-[10px] tracking-widest text-[#8f6e2b]">BANC V · STUDIO AUDIO</p>
          <h2 id="audio-setup-title" className="mt-1 font-cinzel text-base text-[#d4af37]">Assistant de mise en route XTTS v2</h2>
        </div>
        <button type="button" onClick={onClose} title="Fermer l’assistant" aria-label="Fermer l’assistant" className="p-1 text-[#a99a83] hover:text-[#d4af37]"><X size={18} /></button>
      </header>
      <p className="mt-4 rounded-sm border border-[#8f6e2b]/35 bg-[#241e17] px-3 py-2.5 font-serif text-xs leading-relaxed text-[#c5a059]">Le moteur vocal local est inactif. Veuillez lancer le wrapper TTS sur le port 8020 ou configurer ALDUS_TTS_URL.</p>
      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <section className="flex min-w-0 flex-col gap-3 border-l border-[#8f6e2b]/55 pl-4">
          <h3 className="font-cinzel text-xs text-[#d4af37]">1. Moteur déjà installé</h3>
          <p className="font-serif text-xs leading-relaxed text-[#a99a83]">Démarrez votre wrapper local compatible XTTS v2, F5-TTS ou équivalent sur le port 8020, puis vérifiez la connexion.</p>
          <button type="button" onClick={onRetry} disabled={checking} className="mt-auto flex w-fit items-center gap-2 rounded-sm border border-[#8f6e2b]/60 px-3 py-2 font-cinzel text-[10px] text-[#d4af37] hover:border-[#d4af37] hover:bg-[#302619] disabled:opacity-40"><PlugZap size={14} /> {checking ? "Vérification…" : "Vérifier la connexion"}</button>
        </section>
        <section className="flex min-w-0 flex-col gap-3 border-l border-[#8f6e2b]/55 pl-4">
          <h3 className="font-cinzel text-xs text-[#d4af37]">2. Préparer XTTS v2 localement</h3>
          <ol className="list-decimal space-y-2 pl-4 font-serif text-xs leading-relaxed text-[#a99a83]">
            <li>Utilisez Python 3.10 et créez un environnement isolé à la racine du projet.</li>
            <li>Installez FFmpeg et ajoutez <code>ffmpeg</code> au PATH (conversion MP3), puis PyTorch/torchaudio adaptés au CPU ou GPU.</li>
            <li>Acceptez la licence XTTS v2 et laissez le modèle télécharger ses poids au premier démarrage. Rien n’est ajouté au bundle Aldus.</li>
          </ol>
          <pre className="overflow-x-auto rounded-sm border border-[#3a3228] bg-[#11100e] p-3 font-mono text-[10px] leading-relaxed text-[#e0cfac]">{setupCommands}</pre>
          <p className="font-serif text-[10px] leading-relaxed text-[#8c8275]">Wrapper de référence : <code className="text-[#c5a059]">scripts/xtts_wrapper.py</code>. Configurez <code className="text-[#c5a059]">ALDUS_TTS_URL</code> avant de démarrer Aldus. Les profils de clonage sont facultatifs via <code className="text-[#c5a059]">ALDUS_TTS_VOICES</code>.</p>
          <button type="button" onClick={onRetry} disabled={checking} className="flex w-fit items-center gap-2 rounded-sm border border-[#8f6e2b]/60 px-3 py-2 font-cinzel text-[10px] text-[#d4af37] hover:border-[#d4af37] hover:bg-[#302619] disabled:opacity-40">{checking ? "Vérification…" : "Vérifier une fois lancé"}</button>
        </section>
      </div>
      <footer className="mt-5 flex justify-end border-t border-[#4a3b2c] pt-4">
        <button type="button" onClick={onClose} className="rounded-sm border border-[#4a3b2c] px-3 py-2 text-xs text-[#c9bea9] hover:border-[#8f6e2b]">Fermer</button>
      </footer>
    </dialog>,
    document.body,
  );
};