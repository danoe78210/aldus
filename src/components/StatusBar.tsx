import React, { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, FolderOpen } from "lucide-react";
import type { LogEntry, LogLevel } from "../types";

interface StatusBarProps {
  logs: LogEntry[];
  /** État de sauvegarde automatique du projet. */
  saveState?: 'idle' | 'saving' | 'saved';
  /** Chemin du fichier de projet (null si non défini). */
  projectFilePath?: string | null;
  /** Choisit l'emplacement du fichier de projet. */
  onPickProjectFile?: () => void;
}

const levelStyles: Record<LogLevel, string> = {
  info: "text-[#bda888]",
  success: "text-[#c5a059]",
  warning: "text-[#c8a06a]",
  error: "text-[#a83232]",
};

const levelPrefix: Record<LogLevel, string> = {
  info: "\u203A",
  success: "\u2713",
  warning: "!",
  error: "\u2717",
};

/**
 * **Registre inférieur** — journal d'atelier technique, bandeau continu (ébène &
 * laiton) sous le livre.
 *
 * Au repos, la barre se réduit à **une seule ligne discrète** (~32 px) affichant
 * le statut courant et le **dernier log**. Le volet déroulant (bouton
 * « Journal ») révèle l'historique complet **en surimpression**, sans écraser
 * l'établi ni le double-feuillet.
 */
export const StatusBar: React.FC<StatusBarProps> = ({
  logs,
  saveState = 'idle',
  projectFilePath = null,
  onPickProjectFile,
}) => {
  const [open, setOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Le volet ouvert suit le fil du journal (dernier message visible).
  useEffect(() => {
    const node = scrollRef.current;
    if (node) {
      node.scrollTop = node.scrollHeight;
    }
  }, [logs, open]);

  const lastLog = logs.length > 0 ? logs[logs.length - 1] : null;
  const fileLabel = projectFilePath
    ? projectFilePath.split(/[\\/]/).pop()
    : "Dossier du projet";

  return (
    <div className="relative mx-auto w-full max-w-6xl">
      {/* Volet déroulant — historique complet, en surimpression au-dessus de la barre */}
      {open && (
        <div className="absolute bottom-full left-0 right-0 z-40 mb-1 overflow-hidden rounded-xs border border-[#382f22] bg-[#12100e] shadow-[0_-10px_30px_rgba(0,0,0,0.7)]">
          <div className="flex items-center justify-between gap-3 border-b border-[#382f22] px-5 py-2">
            <span className="font-serif text-[11px] tracking-[0.3em] text-[#d4af37] uppercase">
              Journal des op&eacute;rations
            </span>
            <span className="flex items-center gap-4">
              {/* Sceau de laiton poli : projet consigné */}
              {saveState === "saved" && (
                <span className="flex items-center gap-2 font-mono text-[10px] tracking-widest text-[#c5a059] uppercase">
                  <span className="inline-block h-2 w-2 rounded-full bg-[#d4af37] shadow-[0_0_6px_rgba(212,175,55,0.4)]" />
                  Consign&eacute;
                </span>
              )}
              {/* Emplacement du fichier de projet */}
              <button
                type="button"
                onClick={onPickProjectFile}
                title={
                  projectFilePath ?? "Choisir l'emplacement du fichier de projet"
                }
                className="flex items-center gap-1 font-mono text-[10px] tracking-widest text-[#bda888] uppercase transition-colors hover:text-[#d4af37]"
              >
                <FolderOpen size={12} />
                {fileLabel}
              </button>
            </span>
          </div>

          <div
            ref={scrollRef}
            className="h-40 overflow-y-auto px-5 py-2 font-serif text-xs leading-relaxed text-[#bda888]"
          >
            {logs.length === 0 ? (
              <p className="text-[#bda888]/50 italic">Aucune op&eacute;ration enregistr&eacute;e.</p>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="flex gap-3">
                  <span className="shrink-0 font-mono text-[11px] text-[#786c59]">
                    [{log.time}]
                  </span>
                  <span className={levelStyles[log.level]}>
                    {levelPrefix[log.level]} {log.message}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
{/* Barre au repos — une seule ligne discrète (~32 px) */}
      <div className="flex h-8 items-center gap-3 px-5">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          title="Déployer / replier le journal d'atelier"
          className="flex shrink-0 items-center gap-1.5 font-serif text-[10px] tracking-[0.28em] text-[#d4af37] uppercase transition-colors hover:text-[#ffd700]"
        >
          {open ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
          Journal
        </button>

        <span aria-hidden className="h-3 w-px bg-[#382f22]" />

        {/* Statut courant : dernier log consigné (tronqué à la ligne) */}
        <span className="flex min-w-0 flex-1 items-center gap-2 font-serif text-[11px] text-[#bda888]">
          {lastLog ? (
            <>
              <span className="shrink-0 font-mono text-[10px] text-[#786c59]">
                [{lastLog.time}]
              </span>
              <span className={`truncate ${levelStyles[lastLog.level]}`}>
                {levelPrefix[lastLog.level]} {lastLog.message}
              </span>
            </>
          ) : (
            <span className="italic text-[#bda888]/50">
              Aucune op&eacute;ration enregistr&eacute;e.
            </span>
          )}
        </span>

        {/* Témoin de sauvegarde — sceau (consigné) ou pulsation (en cours) */}
        {saveState === "saved" && (
          <span className="flex shrink-0 items-center gap-2 font-mono text-[10px] tracking-widest text-[#c5a059] uppercase">
            <span className="inline-block h-2 w-2 rounded-full bg-[#d4af37] shadow-[0_0_6px_rgba(212,175,55,0.4)]" />
            Consign&eacute;
          </span>
        )}
        {saveState === "saving" && (
          <span className="flex shrink-0 items-center gap-2 font-mono text-[10px] tracking-widest text-[#bda888]/70 uppercase">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[#d4af37] shadow-[0_0_6px_rgba(212,175,55,0.4)]" />
            Enregistrement…
          </span>
        )}

        {/* Emplacement du fichier de projet */}
        <button
          type="button"
          onClick={onPickProjectFile}
          title={projectFilePath ?? "Choisir l'emplacement du fichier de projet"}
          className="flex shrink-0 items-center gap-1 font-mono text-[10px] tracking-widest text-[#bda888] uppercase transition-colors hover:text-[#d4af37]"
        >
          <FolderOpen size={12} />
          {fileLabel}
        </button>
      </div>
    </div>
  );
};