import React, { type ReactNode } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import { TopBar } from "./TopBar";
import { StatusBar } from "./StatusBar";
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
      className="relative flex h-screen w-screen flex-col overflow-hidden bg-[#0e0c0a] select-none"
      style={{
        backgroundImage:
          "radial-gradient(circle at 50% 45%, #1b1613 0%, #0e0c0a 62%)",
      }}
    >
      {/* 1. Pupitre supérieur — bandeau continu sur toute la largeur */}
      <header className="relative z-30 w-full shrink-0 border-b border-[#2e261c] bg-[#141210]">
        <TopBar progress={progress} label={progressLabel} running={running} />
      </header>

      {/* 2. Établi central portant le registre. `pl-40` réserve la gouttière
          franche à gauche où se déploient les signets (débord `-translate-x-full`). */}
      <main className="relative z-10 flex flex-1 items-center justify-center p-6 pl-40">

        {/* Le Registre — livre ancien : navigation à gauche, pages tournantes à droite.
            Perspective 3D (1400 px) : le volet droit se rabat vers la gauche à la fermeture. */}
        <div className="relative flex h-full max-h-[860px] w-full max-w-[1560px] [perspective:1400px] shadow-[0_20px_50px_rgba(0,0,0,0.9)]">
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

          {/* Page gauche : navigation & identité (les signets débordent sur la
              tranche extérieure, hors de la surface d'écriture). */}
          <section className="relative h-full w-1/2 rounded-l-sm border-y border-l border-[#3a3022] bg-[#181614] shadow-[inset_-30px_0_40px_-18px_rgba(0,0,0,0.85)]">
            {leftContent}
          </section>

          {/* Gouttière centrale / Reliure cousue — strictement contenue dans le
              livre (aucun débordement sur les pupitres haut et bas). */}
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-0 bottom-0 z-20 w-8 -translate-x-1/2 bg-linear-to-r from-black/80 via-black/40 to-black/80 shadow-[inset_0_0_12px_rgba(0,0,0,0.95)]"
          />

            {/* Page de droite : volet qui pivote autour de la reliure (`left`). */}
            <section
              className="relative flex h-full w-1/2 flex-col overflow-hidden rounded-r-sm border-y border-r border-[#3a3022] bg-linear-to-b from-[#1c1a17] to-[#141210] shadow-[inset_30px_0_40px_-18px_rgba(0,0,0,0.85)]"
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
                className="absolute inset-0 flex overflow-hidden rounded-r-sm bg-[#1c140e] shadow-[inset_20px_0_30px_rgba(0,0,0,0.6)]"
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
      </main>

      {/* 3. Registre inférieur — bandeau continu indépendant */}
      <footer className="relative z-30 w-full shrink-0 border-t border-[#2e261c] bg-[#12100e]">
        <StatusBar
          logs={logs}
          saveState={saveState}
          projectFilePath={projectFilePath}
          onPickProjectFile={onPickProjectFile}
        />
      </footer>
    </div>
  );
};

