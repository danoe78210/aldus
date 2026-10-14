import React, { useEffect, useState } from "react";
import aldusEmblem from "../../assets/aldus-emblem.png";

/** Délai de disparition du sceau après l'achèvement du tirage (30 s). */
const SEAL_VISIBLE_MS = 30_000;
/** Début du fondu de sortie du sceau (29,5 s : on perçoit l'estompe pendant 0,5 s). */
const SEAL_FADE_MS = 29_500;

interface PressSealAnimationProps {
  /** État du tirage : en attente / sous presse / achevé et scellé. */
  status: "idle" | "pressing" | "completed";
  /** Notifié à l'échéance des 30 s (disparition du sceau), facultatif. */
  onExpire?: () => void;
}

/**
 * **Animation d'achevé d'imprimer** (Feuillet XII — Le Tirage sous presse) :
 * estampe filaire en veilleuse avant le tirage, pulsation d'or liquide pendant
 * la presse, puis **descente et frappe solennelle de l'emblème** à l'achèvement
 * (onde dorée d'impact + cartouche « Festina Lente »).
 *
 * **Cycle de vie** : le sceau reste affiché **30 secondes**, s'estompe en fondu
 * doux (T + 29,5 s → T + 30 s), puis le composant repasse en veilleuse discrète.
 * Un nouveau tirage (`pressing`) annule les minuteurs et réarmera le cycle.
 */
export const PressSealAnimation: React.FC<PressSealAnimationProps> = ({ status, onExpire }) => {
  const [showCompleted, setShowCompleted] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);
  // Dernier statut observé — pattern React officiel « ajuster l'état au rendu »
  // quand la prop change : la bascule interne ne passe par aucun effet.
  const [lastStatus, setLastStatus] = useState(status);
  if (lastStatus !== status) {
    setLastStatus(status);
    setShowCompleted(status === "completed");
    setIsFadingOut(false);
  }

  // Cycle de vie du sceau : les minuteurs sont armés dès que l'achèvement est
  // affiché, et nettoyés automatiquement (réarmement) dès que `showCompleted`
  // change (relance du tirage, disparition, démontage).
  useEffect(() => {
    if (!showCompleted) {
      return;
    }

    // Début du fondu de sortie à 29,5 secondes…
    const fadeTimer = window.setTimeout(() => {
      setIsFadingOut(true);
    }, SEAL_FADE_MS);

    // …disparition totale (et notification) après 30 secondes.
    const removeTimer = window.setTimeout(() => {
      setIsFadingOut(false);
      setShowCompleted(false);
      onExpire?.();
    }, SEAL_VISIBLE_MS);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(removeTimer);
    };
  }, [showCompleted, onExpire]);

  // État 1 : en cours de tirage.
  if (status === "pressing") {
    return (
      <div className="mt-8 flex flex-col items-center justify-center gap-3 border-t border-[#2a241c] pt-6 animate-pulse">
        <div className="h-10 w-10 rounded-full border-2 border-[#d4af37] border-t-transparent animate-spin" />
        <p className="font-cinzel text-xs uppercase tracking-widest text-[#d4af37]">
          Pression sous fer &amp; encrage des formes en cours…
        </p>
      </div>
    );
  }

  // État 2 : tirage terminé (actif pendant 30 secondes, puis fondu de sortie).
  if (status === "completed" && showCompleted) {
    return (
      <div
        className={`mt-8 flex flex-col items-center justify-center border-t border-[#382f22] pt-6 transition-opacity duration-500 ease-out ${
          isFadingOut ? "opacity-0" : "animate-fade-in opacity-100"
        }`}
      >
        {/* Sceau / médaillon frappé */}
        <div className="relative flex items-center justify-center">
          {/* Halo d'impact doré (onde du coup de presse) */}
          <div className="pointer-events-none absolute h-28 w-28 rounded-full bg-[#d4af37]/15 opacity-50 blur-xl animate-ping" />

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
            ✦ FORME ACHEVÉE &amp; SCELLÉE SOUS PRESSE ✦
          </p>
          <p className="font-serif text-xs italic text-[#a89f91]">
            « Festina Lente » — Le manuscrit est déposé dans le dossier de fabrication.
          </p>
        </div>
      </div>
    );
  }

  // État 3 : attente / veilleuse discrète (par défaut, ou après les 30 s).
  return (
    <div className="mt-8 flex flex-col items-center justify-center border-t border-[#2a241c] pt-6 opacity-25">
      <span className="font-cinzel text-[11px] uppercase tracking-[0.25em] text-[#8f6e2b]">
        Officina Aldina · En attente de tirage
      </span>
    </div>
  );
};