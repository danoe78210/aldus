import React from "react";
import aldusEmblem from "../../assets/aldus-emblem.png";

interface PressSealAnimationProps {
  /** État du tirage : en attente / sous presse / achevé et scellé. */
  status: "idle" | "pressing" | "completed";
}

/**
 * **Animation d'achevé d'imprimer** (Feuillet X — Le Tirage sous presse) :
 * estampe filaire en veilleuse avant le tirage, pulsation d'or liquide pendant
 * la presse, puis **descente et frappe solennelle de l'emblème** à l'achèvement
 * (onde dorée d'impact + cartouche d'authentification « Festina Lente »).
 */
export const PressSealAnimation: React.FC<PressSealAnimationProps> = ({ status }) => {
  if (status === "idle") {
    return (
      <div className="mt-8 flex flex-col items-center justify-center border-t border-[#2a241c] pt-6 opacity-30">
        <span className="font-cinzel text-xs uppercase tracking-[0.25em] text-[#8f6e2b]">
          Officina Aldina · En attente de tirage
        </span>
      </div>
    );
  }

  if (status === "pressing") {
    return (
      <div className="mt-8 flex flex-col items-center justify-center gap-3 border-t border-[#2a241c] pt-6 animate-pulse">
        <div className="h-12 w-12 rounded-full border-2 border-[#d4af37] border-t-transparent animate-spin" />
        <p className="font-cinzel text-xs uppercase tracking-widest text-[#d4af37]">
          Pression sous fer &amp; encrage des formes en cours…
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8 flex flex-col items-center justify-center border-t border-[#382f22] pt-6 animate-fade-in">
      {/* Sceau / médaillon frappé */}
      <div className="relative flex items-center justify-center">
        {/* Halo d'impact doré (onde du coup de presse) */}
        <div className="pointer-events-none absolute h-28 w-28 rounded-full bg-[#d4af37]/15 opacity-60 blur-xl animate-ping" />

        {/* Cercle de cire / bronze gravé parfaitement centré */}
        <div className="relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-2 border-[#d4af37] bg-linear-to-b from-[#241c13] to-[#120f0c] shadow-[0_0_25px_rgba(212,175,55,0.4)] transition-transform duration-700 ease-out hover:scale-105">
          <img
            src={aldusEmblem}
            alt="Marque d'Alde Manuce"
            className="h-full w-full rounded-full object-cover drop-shadow-md select-none"
          />
        </div>
      </div>

      {/* Cartouche d'authentification */}
      <div className="mt-4 space-y-1 text-center">
        <p className="font-cinzel text-xs uppercase tracking-[0.25em] text-[#f3e5ab]">
          ✦ Forme achevée &amp; scellée sous presse ✦
        </p>
        <p className="font-serif text-xs italic text-[#a89f91]">
          « Festina Lente » — Le manuscrit est déposé dans le dossier de fabrication.
        </p>
      </div>
    </div>
  );
};