import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { PlugZap, X } from "lucide-react";
import type { AudioConfig } from "../types";

interface AudioSetupDialogProps {
  checking: boolean;
  engineMode: AudioConfig["engine_mode"];
  onRetry: () => void;
  onAcceptAndStart: () => void;
  onClose: () => void;
}

export const AudioSetupDialog = ({ checking, engineMode, onRetry, onAcceptAndStart, onClose }: AudioSetupDialogProps) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [termsAccepted, setTermsAccepted] = useState(false);
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
        <button type="button" onClick={onClose} title="Annuler l’assistant" aria-label="Annuler l’assistant" className="p-1 text-[#a99a83] hover:text-[#d4af37]"><X size={18} /></button>
      </header>
      <p className="mt-4 rounded-sm border border-[#8f6e2b]/35 bg-[#241e17] px-3 py-2.5 font-serif text-xs leading-relaxed text-[#c5a059]">Le premier démarrage du moteur intégré télécharge les poids XTTS v2 dans le dossier local Aldus. Aucun fichier n’est écrit dans le dossier d’installation.</p>
      <div className="mt-5 grid gap-5 md:grid-cols-2">
        {engineMode === "integrated" && <section className="flex min-w-0 flex-col gap-3 border-l border-[#8f6e2b]/55 pl-4">
          <h3 className="font-cinzel text-xs text-[#d4af37]">Licence du modèle XTTS v2</h3>
          <p className="font-serif text-xs leading-relaxed text-[#a99a83]">Le modèle est distribué sous la Coqui Public Model License. Un usage commercial nécessite une licence commerciale Coqui; l’usage non commercial reste soumis aux conditions CPML.</p>
          <a href="https://coqui.ai/cpml" target="_blank" rel="noreferrer" className="w-fit border-b border-[#8f6e2b]/60 font-cinzel text-[10px] text-[#d4af37] hover:text-[#f3d995]">Lire la licence CPML</a>
          <label className="flex items-start gap-2 font-serif text-xs leading-relaxed text-[#c9bea9]">
            <input type="checkbox" checked={termsAccepted} onChange={(event) => setTermsAccepted(event.target.checked)} className="mt-0.5 accent-[#d4af37]" />
            <span>J’ai lu les conditions et confirme être autorisé à utiliser ce modèle.</span>
          </label>
          <button type="button" onClick={onAcceptAndStart} disabled={!termsAccepted || checking} className="mt-auto flex w-fit items-center gap-2 rounded-sm border border-[#8f6e2b]/60 px-3 py-2 font-cinzel text-[10px] text-[#d4af37] hover:border-[#d4af37] hover:bg-[#302619] disabled:opacity-40"><PlugZap size={14} /> {checking ? "Démarrage XTTS…" : "ACCEPTER ET DÉMARRER"}</button>
        </section>}
        {engineMode === "external" && <section className="flex min-w-0 flex-col gap-3 border-l border-[#8f6e2b]/55 pl-4">
          <h3 className="font-cinzel text-xs text-[#d4af37]">Moteur local externe</h3>
          <p className="font-serif text-xs leading-relaxed text-[#a99a83]">Pour un wrapper de développement déjà démarré sur le port 8020, vérifiez sa disponibilité sans lancer le moteur intégré.</p>
          <p className="font-serif text-[10px] leading-relaxed text-[#8c8275]">Wrapper de référence : <code className="text-[#c5a059]">scripts/xtts_wrapper.py</code>.</p>
          <pre className="overflow-x-auto rounded-sm border border-[#3a3228] bg-[#11100e] p-3 font-mono text-[10px] leading-relaxed text-[#e0cfac]">{setupCommands}</pre>
          <button type="button" onClick={onRetry} disabled={checking} className="mt-auto flex w-fit items-center gap-2 rounded-sm border border-[#8f6e2b]/60 px-3 py-2 font-cinzel text-[10px] text-[#d4af37] hover:border-[#d4af37] hover:bg-[#302619] disabled:opacity-40">{checking ? "Vérification…" : "Vérifier le moteur externe"}</button>
        </section>}
      </div>
      <footer className="mt-5 flex justify-end border-t border-[#4a3b2c] pt-4">
        <button type="button" onClick={onClose} className="rounded-sm border border-[#4a3b2c] px-3 py-2 text-xs text-[#c9bea9] hover:border-[#8f6e2b]">Annuler</button>
      </footer>
    </dialog>,
    document.body,
  );
};