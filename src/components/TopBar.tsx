import React, { useEffect, useState } from "react";
import {
  isFullscreen,
  isFullscreenSupported,
  toggleFullscreen,
} from "../utils/fullscreen";

interface TopBarProps {
  /** Avancement global de 0 à 100. */
  progress: number;
  /** Libellé de l'opération en cours. */
  label: string;
  /** Indique qu'un traitement lourd est actif (presse ou export). */
  running?: boolean;
}

/**
 * **Pupitre supérieur du registre** — bandeau d'atelier continu (ébène & laiton)
 * portant la réglette graduée du typographe.
 *
 * Au repos (`running === false`, aucune opération de presse ou d'export), le
 * libellé affiche la devise d'attente de l'office (`~ OFFICINA ALDINA ·
 * COMPOSITIO LIBRORUM ~`) et les graduations `0 … 100` s'estompent
 * (`opacity-30`) pour ne pas troubler le calme du sas d'accueil.
 */
export const TopBar: React.FC<TopBarProps> = ({
  progress,
  label,
  running = false,
}) => {
  const clamped = Math.min(100, Math.max(0, Math.round(progress)));
  const scale = [0, 25, 50, 75, 100];

  // Porte de sortie du plein écran (la fenêtre démarre en plein écran).
  const fullscreenSupported = isFullscreenSupported();
  const [fullscreen, setIsFullscreen] = useState(false);

  // Aligne l'état initial et suit les bascules externes (sortie gérée par
  // l'OS ou la WebView, qui n'émettent pas d'événement Tauri dédié).
  useEffect(() => {
    if (!fullscreenSupported) return;
    let active = true;
    void isFullscreen().then((value) => {
      if (active) setIsFullscreen(value);
    });
    const onFullscreenChange = () => {
      void isFullscreen().then(setIsFullscreen);
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => {
      active = false;
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, [fullscreenSupported]);

  // Raccourci clavier `F11` : neutralise la bascule native de la WebView au
  // profit d'un pilotage explicite de la fenêtre Tauri.
  useEffect(() => {
    if (!fullscreenSupported) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "F11") return;
      event.preventDefault();
      void toggleFullscreen().then(setIsFullscreen);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [fullscreenSupported]);

  const handleFullscreenToggle = () => {
    void toggleFullscreen().then(setIsFullscreen);
  };

  return (
    <div className="mx-auto w-full max-w-6xl">
      {/* Pupitre de typographe en ébène et laiton */}
      <div className="relative rounded-xs border-b border-[#382f22] bg-[#141210] px-5 py-3 text-[#e2dbce] shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_6px_14px_rgba(0,0,0,0.5)]">
        {/* Vis de fixation aux quatre coins */}
        <span className="absolute left-2 top-2 h-1.5 w-1.5 rounded-full bg-brass/70 shadow-[inset_0_1px_1px_rgba(0,0,0,0.6)]" />
        <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-brass/70 shadow-[inset_0_1px_1px_rgba(0,0,0,0.6)]" />
        <span className="absolute bottom-2 left-2 h-1.5 w-1.5 rounded-full bg-brass/70 shadow-[inset_0_1px_1px_rgba(0,0,0,0.6)]" />
        <span className="absolute bottom-2 right-2 h-1.5 w-1.5 rounded-full bg-brass/70 shadow-[inset_0_1px_1px_rgba(0,0,0,0.6)]" />

        <div className="mb-2 flex items-end justify-between">
          {/* Libellé d'état — or doux, petites capitales romaines */}
          <span className="font-serif text-xs tracking-widest text-[#d4af37] uppercase">
            {label}
            {running && <span className="ml-2 text-[#c5a059]">— en cours</span>}
          </span>
          {/* Commandes d'atelier : porte de sortie du plein écran + curseur gradué */}
          <span className="flex items-center gap-3">
            {fullscreenSupported && (
              <button
                type="button"
                onClick={handleFullscreenToggle}
                aria-pressed={fullscreen}
                title={
                  fullscreen
                    ? "Quitter le plein écran (F11)"
                    : "Passer en plein écran (F11)"
                }
                className="rounded-xs border border-[#3a3022] px-2 py-0.5 font-serif text-[10px] tracking-widest text-[#a89f91] uppercase transition-colors hover:border-[#8f6e2b] hover:text-[#e6c878]"
              >
                {fullscreen ? "⤡ Fenêtré" : "⤢ Plein écran"}
              </button>
            )}
            {/* Curseur gradué du typographe (plus aucun affichage digital) */}
            <span className="flex items-center gap-2 font-serif text-[10px] tracking-widest text-[#8f6e2b] uppercase">
              <span className="h-2 w-px bg-[#8f6e2b]" />
              <span className="h-3 w-px bg-[#8f6e2b]" />
              <span className="h-2 w-px bg-[#8f6e2b]" />
            </span>
          </span>
        </div>

        {/* Réglette de typographe : rainure en laiton sombre + curseur brossé */}
        <div className="relative h-3 w-full overflow-hidden rounded-xs border border-[#2e261b] bg-[#1c1814] shadow-[inset_0_2px_6px_rgba(0,0,0,0.9)]">
          <div
            className={`h-full bg-linear-to-r from-[#8f6e2b] via-[#c5a059] to-[#8f6e2b] transition-all duration-200 ease-out ${
              running ? "animate-pulse" : ""
            }`}
            style={{ width: `${clamped}%` }}
          />
          {/* Tirets millimétriques tous les 10 % (filigrane) */}
          <div
            className="pointer-events-none absolute inset-0 opacity-40"
            style={{
              backgroundImage:
                "repeating-linear-gradient(90deg, transparent 0 10%, rgba(0,0,0,0.75) 10%, rgba(0,0,0,0.75) calc(10% + 1px))",
            }}
          />
        </div>

        {/* Échelle graduée — estompée tant que l'atelier n'est pas actionné */}
        <div
          className={`mt-1 flex justify-between font-mono text-[9px] tracking-widest text-[#9e9587]/70 uppercase transition-opacity duration-500 ${
            running ? "opacity-100" : "opacity-30"
          }`}
        >
          {scale.map((tick) => (
            <span key={tick}>{tick}</span>
          ))}
        </div>
      </div>
    </div>
  );
};