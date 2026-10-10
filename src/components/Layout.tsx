import React, { type ReactNode } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { ProgressBar } from "./ProgressBar";
import { LogPanel } from "./LogPanel";
import { MenuFlipBook } from "./MenuFlipBook";
import { useStudio } from "./StudioContext";
import type { LogEntry } from "../types";

/** Convertit un chemin local en URL `asset://` (repli : chemin brut hors Tauri). */
const coverUrl = (path: string): string => {
  try {
    return convertFileSrc(path);
  } catch {
    return path;
  }
};

/** Texture de cuir par défaut (repli sans image de couverture). */
const LEATHER_COVER =
  "linear-gradient(135deg, #6b4423 0%, #4a2c15 55%, #2e1a0c 100%)";

interface LayoutProps {
  /** Contenu de la page de gauche (navigation & identité). */
  leftContent: ReactNode;
  /** Pages du livre virtuel de droite (une vue par menu). */
  bookPages: ReactNode[];
  /** Index de la page active (piloté par le ruban de navigation). */
  activeIndex: number;
  /** Avancement global de 0 à 100. */
  progress: number;
  /** Libellé de l'opération en cours. */
  progressLabel: string;
  /** Indique qu'un traitement lourd est actif. */
  running: boolean;
  /** Historique des opérations journalisées. */
  logs: LogEntry[];
  /** État de sauvegarde automatique du projet. */
  saveState: 'idle' | 'saving' | 'saved';
  /** Chemin du fichier de projet (null si non défini). */
  projectFilePath: string | null;
  /** Choisit l'emplacement du fichier de projet. */
  onPickProjectFile: () => void;
  /** Cinématique de fermeture du livre en cours (volet 3D + glow). */
  closing?: boolean;
}

export const Layout: React.FC<LayoutProps> = ({
  leftContent,
  bookPages,
  activeIndex,
  progress,
  progressLabel,
  running,
  logs,
  saveState,
  projectFilePath,
  onPickProjectFile,
  closing = false,
}) => {
  // Couverture personnalisée (module Cover Studio) appliquée au livre fermé.
  const { cover } = useStudio();
  const frontUrl = cover.frontPath ? coverUrl(cover.frontPath) : null;
  const backUrl = cover.backPath ? coverUrl(cover.backPath) : null;
  const spineBackground =
    cover.gradient && cover.spineColorFront && cover.spineColorBack
      ? `linear-gradient(90deg, ${cover.spineColorFront}, ${cover.spineColorBack})`
      : cover.spineColorFront ?? "#1c140e";
  const showSpineText = cover.pageCount >= 80 && cover.spineText.trim() !== "";

  return (
    <div
      className="relative flex h-screen w-full flex-col items-center gap-4 overflow-hidden bg-[#12100e] p-3"
      style={{
        backgroundImage:
          "radial-gradient(circle at 50% 45%, #1b1613 0%, #12100e 62%)",
      }}
    >
      {/* Colonne commune : la barre de progression, le livre et le journal
          partagent EXACTEMENT la même emprise horizontale (largeur + position).
          `pl-28` réserve une gouttière franche à gauche : les marque-pages du registre
          se déploient intégralement, sans troncature (ils débordent de `-left-28`,
          soit exactement 7 rem). `flex-1 min-h-0` fait tenir le tout dans la
          global). Grand format : `w-[90vw] max-w-[1700px]`. */}
      <div className="flex w-[90vw] min-h-0 max-w-[1700px] flex-1 flex-col items-center gap-4 pr-6 pl-28">
        {/* Barre de progression — au-dessus du livre */}
        <ProgressBar progress={progress} label={progressLabel} running={running} />

        {/* Le Registre — livre ancien : navigation à gauche, pages tournantes à droite.
            Perspective 3D (1400 px) : le volet droit se rabat vers la gauche à la fermeture. */}
        <div className="relative flex w-full min-h-0 flex-1 [perspective:1400px]">
          {/* Halo lumineux d'ambiance (backdrop glow) — derrière le livre. */}
          <div
            aria-hidden
            className={`pointer-events-none absolute -inset-16 z-0 rounded-full blur-3xl transition-opacity duration-500 ${
              closing ? "opacity-100" : "opacity-0"
            }`}
            style={{
              background: "radial-gradient(circle, rgba(198, 134, 66, 0.4) 0%, transparent 70%)",
            }}
          />

          <div className="relative flex h-full w-full min-h-0 rounded-md shadow-[0_20px_50px_rgba(0,0,0,0.6)]">
            {/* Page de gauche : ombre interne simulant la courbure vers la reliure */}
            <section className="relative h-full w-1/2 rounded-l-md border border-[#383126]/60 bg-[#181614] p-10 shadow-[inset_-30px_0_40px_-18px_rgba(0,0,0,0.85)]">
              {leftContent}
            </section>

            {/* Page de droite : volet qui pivote autour de la reliure (`left`). */}
            <section
              className="relative flex h-full w-1/2 flex-col overflow-hidden rounded-r-md border border-[#383126]/60 bg-linear-to-b from-[#1c1a17] to-[#141210] shadow-[inset_30px_0_40px_-18px_rgba(0,0,0,0.85)]"
              style={{
                transformOrigin: "left center",
                transformStyle: "preserve-3d",
                transition: "transform 1000ms cubic-bezier(0.22, 1, 0.36, 1)",
                transform: closing ? "rotateY(-180deg)" : "rotateY(0deg)",
              }}
            >
              {/* Face interne : le livre virtuel (pages de menus). */}
              <div
                className="flex h-full min-h-0 flex-col p-6"
                style={{ backfaceVisibility: "hidden" }}
              >
                <MenuFlipBook pages={bookPages} activeIndex={activeIndex} />
              </div>

              {/* Face externe (Verso) : couverture personnalisée (plat 4 | tranche | plat 1),
                  révélée pendant le rabat. */}
              <div
                aria-hidden
                className="absolute inset-0 flex overflow-hidden rounded-r-md bg-[#1c140e] shadow-[inset_20px_0_30px_rgba(0,0,0,0.6)]"
                style={{ transform: "rotateY(180deg)", backfaceVisibility: "hidden" }}
              >
                {/* Plat 4 (Verso) */}
                <div
                  className="h-full flex-1"
                  style={{
                    backgroundImage: backUrl ? `url(${backUrl})` : LEATHER_COVER,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                />

                {/* Tranche : couleur/dégradé dynamique + texte vertical */}
                <div
                  className="relative flex h-full shrink-0 items-center justify-center"
                  style={{ width: 26, background: spineBackground }}
                >
                  {showSpineText && (
                    <span
                      className="whitespace-nowrap font-serif text-[10px] tracking-[0.15em] text-white"
                      style={{
                        transform: "rotate(-90deg)",
                        textShadow: "0 1px 1px rgba(0,0,0,0.5)",
                      }}
                    >
                      {cover.spineText}
                    </span>
                  )}
                </div>

                {/* Plat 1 (Recto) */}
                <div
                  className="h-full flex-1"
                  style={{
                    backgroundImage: frontUrl ? `url(${frontUrl})` : LEATHER_COVER,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                />
              </div>
            </section>
          </div>

          {/* Lueur de la reliure (seam glow) — s'intensifie au début de la rotation. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-2 left-1/2 z-20 w-[3px] -translate-x-1/2 rounded-full transition-all duration-500"
            style={{
              boxShadow: closing ? "0 0 25px 6px rgba(217, 119, 6, 0.6)" : "none",
              opacity: closing ? 1 : 0,
            }}
          />
        </div>

        {/* Gouttière centrale — ombre portée de reliure cousue main (double page). */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-1/2 z-10 w-24 -translate-x-1/2 shadow-[inset_0_0_40px_rgba(0,0,0,0.85)]"
        />

        {/* Terminal — journal des opérations, sous le livre */}
        <LogPanel
          logs={logs}
          saveState={saveState}
          projectFilePath={projectFilePath}
          onPickProjectFile={onPickProjectFile}
        />
      </div>
    </div>
  );
};

