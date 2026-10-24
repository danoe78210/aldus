import { AudioLines } from "lucide-react";
import type { AudioConfig } from "../../types";

interface SidecarConsoleProps {
  ready: boolean;
  checking: boolean;
  initPercent: number | null;
  engineMode: AudioConfig["engine_mode"];
  cpmlAccepted: boolean;
  error: string | null;
  onRetry: () => void;
  onOpenSetup: () => void;
}

const buttonClass = "shrink-0 border-b border-[#8f6e2b]/60 font-cinzel text-[10px] text-[#d4af37] hover:text-[#f3d995]";

export const SidecarConsole = ({ ready, checking, initPercent, engineMode, cpmlAccepted, error, onRetry, onOpenSetup }: SidecarConsoleProps) => {
  const status = checking ? `Initialisation du moteur (${initPercent ?? 0} %)…` : ready ? "Moteur prêt" : "Moteur inactif";
  return (
    <section aria-label="Console du moteur vocal" className="flex flex-col gap-3 rounded-sm border border-[#3a3228] bg-[#15120f] p-4">
      <h3 className="flex items-center gap-2 font-cinzel text-sm text-[#d4af37]"><AudioLines size={15} /> Moteur XTTS v2</h3>
      <p role="status" className="flex items-center gap-2 font-serif text-sm text-[#c9bea9]">
        <span aria-hidden="true" className={`size-2 rounded-full ${ready ? "bg-[#7fae6b]" : checking ? "animate-pulse bg-[#d4af37]" : "bg-[#b5543f]"}`} />
        {status}
      </p>
      <p className="font-serif text-xs text-[#8c8275]">{engineMode === "integrated" ? "Moteur intégré à Aldus" : "Moteur local externe · 127.0.0.1:8020"}</p>
      {error && (
        <aside role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-sm border border-[#8f6e2b]/40 bg-[#241e17] px-3 py-2.5 font-serif text-sm leading-relaxed text-[#c5a059]">
          <span>{error}</span>
          {engineMode === "integrated" && cpmlAccepted
            ? <button type="button" onClick={onRetry} className={buttonClass}>Réessayer</button>
            : <button type="button" onClick={onOpenSetup} className={buttonClass}>Ouvrir l’assistant</button>}
        </aside>
      )}
    </section>
  );
};
