import React, { useEffect, useRef } from "react";
import { FolderOpen } from "lucide-react";
import type { LogEntry, LogLevel } from "../types";

interface LogPanelProps {
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

export const LogPanel: React.FC<LogPanelProps> = ({
  logs,
  saveState = 'idle',
  projectFilePath = null,
  onPickProjectFile,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = scrollRef.current;
    if (node) {
      node.scrollTop = node.scrollHeight;
    }
  }, [logs]);

  const fileLabel = projectFilePath
    ? projectFilePath.split(/[\\/]/).pop()
    : "Dossier du projet";

  return (
    <div className="w-full max-w-6xl">
      {/* Journal d'atelier — registre inférieur en ébène et laiton */}
      <div className="relative overflow-hidden rounded-xs border-t border-[#382f22] bg-[#12100e] shadow-[inset_0_2px_14px_rgba(0,0,0,0.9),0_6px_14px_rgba(0,0,0,0.5)]">
        {/* Vis de fixation aux quatre coins */}
        <span className="absolute left-2 top-2 h-1.5 w-1.5 rounded-full bg-brass/60 shadow-[inset_0_1px_1px_rgba(0,0,0,0.6)]" />
        <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-brass/60 shadow-[inset_0_1px_1px_rgba(0,0,0,0.6)]" />
        <span className="absolute bottom-2 left-2 h-1.5 w-1.5 rounded-full bg-brass/60 shadow-[inset_0_1px_1px_rgba(0,0,0,0.6)]" />
        <span className="absolute bottom-2 right-2 h-1.5 w-1.5 rounded-full bg-brass/60 shadow-[inset_0_1px_1px_rgba(0,0,0,0.6)]" />

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
            <span className="flex items-center gap-2 font-mono text-[10px] tracking-widest text-[#bda888]/70 uppercase">
              <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[#d4af37] shadow-[0_0_6px_rgba(212,175,55,0.4)]" />
              Enregistrement actif
            </span>
          </span>
        </div>

        <div
          ref={scrollRef}
          className="h-32 overflow-y-auto px-5 py-2 font-serif text-xs leading-relaxed text-[#bda888]"
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
    </div>
  );
};
