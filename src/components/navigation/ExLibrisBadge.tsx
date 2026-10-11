import React from "react";
import { invokeCommand, isInvokeAvailable } from "../../utils/tauri";

/** Site officiel de l'auteur (navette en repli navigateur hors Tauri). */
const AUTHOR_WEBSITE = "https://danoeecrivain.net/";

/**
 * **Ex-Libris d'atelier de Danoë** — emblème du Dragon gravé dans le bas de la
 * tranche gauche, au-dessus du bouton `[ Quitter l'atelier ]`. Le clic ouvre le
 * site officiel de l'auteur dans le navigateur par défaut via la commande Rust
 * native `open_author_website` (repli `window.open` en SPA navigateur).
 */
export const ExLibrisBadge: React.FC = () => {
  const handleClick = async () => {
    if (isInvokeAvailable()) {
      try {
        await invokeCommand("open_author_website");
        return;
      } catch (cause) {
        console.error("Échec de l'ouverture du site de l'auteur :", cause);
      }
    }
    // Repli hors Tauri : ouverture directe dans un nouvel onglet.
    window.open(AUTHOR_WEBSITE, "_blank", "noopener");
  };

  return (
    <div className="w-full px-3 py-2">
      <button
        type="button"
        onClick={() => void handleClick()}
        title="Visiter la bibliothèque et les œuvres de l'Auteur (danoeecrivain.net)"
        className="group relative w-full cursor-pointer rounded-xs border border-[#382f22] bg-linear-to-b from-[#181410] to-[#120f0c] p-2.5 text-left shadow-[0_4px_12px_rgba(0,0,0,0.5)] transition-all duration-300 hover:border-[#8f6e2b] hover:shadow-[0_0_15px_rgba(212,175,55,0.2)] flex flex-col items-center gap-1.5"
      >
        {/* En-tête gravé */}
        <div className="w-full text-center">
          <p className="font-cinzel text-[11px] uppercase tracking-[0.25em] text-[#8f6e2b] transition-colors group-hover:text-[#c5a059]">
            Ex-Libris
          </p>
          <p className="font-cinzel text-[11px] font-semibold uppercase tracking-[0.2em] text-[#e2dbce] transition-colors group-hover:text-[#f3e5ab]">
            Danoë
          </p>
        </div>

        {/* L'emblème Dragon de l'auteur */}
        <div className="relative my-0.5 flex h-12 w-12 items-center justify-center">
          <img
            src="/danoe-dragon.webp"
            alt="Emblème du Dragon — Danoë"
            className="h-full w-full object-contain opacity-90 transition-all duration-300 filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)] group-hover:scale-105 group-hover:opacity-100"
          />
        </div>

        {/* Sceau & adresse du site */}
        <div className="flex w-full items-center justify-between border-t border-[#2a2218] pt-1.5">
          <span className="font-mono text-[11px] tracking-tight text-[#8f8373] transition-colors group-hover:text-[#d4af37]">
            danoeecrivain.net
          </span>
          <span className="text-[11px] text-[#8f6e2b] transition-all group-hover:translate-x-0.5 group-hover:text-[#d4af37]">
            ↗
          </span>
        </div>
      </button>
    </div>
  );
};