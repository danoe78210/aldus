import React, { useState } from "react";
import { GoldCrucible } from "./GoldCrucible";
import { useStudio } from "./StudioContext";

interface RightPageProps {
  /** Navigation interne des Réglages (tour de page vers le niveau 1). */
  onEnter?: () => void;
  /** Conservé pour compatibilité (la sortie reste sur la tranche gauche). */
  onQuit?: () => void;
}

/**
 * Page de droite d'accueil : **fonderie du caractère**. Le creuset est le seul
 * point focal ; le clic n'importe où abrège la coulée, puis le bouton
 * « Entrer dans l'atelier » déclenche la **transition cinématique** d'entrée
 * (le voile d'encre retire le creuset et le médaillon, cf. `onEnterAtelier`).
 */
export const RightPage: React.FC<RightPageProps> = ({ onEnter }) => {
  const { isTransitioning, onEnterAtelier } = useStudio();
  const [skip, setSkip] = useState(false);

  /** Impulsion (bouton) → synchronise les Réglages puis ouvre l'atelier. */
  const handleEnter = () => {
    onEnter?.();
    onEnterAtelier();
  };

  return (
    <div
      onClick={() => setSkip(true)}
      className={`flex h-full w-full cursor-pointer items-center justify-center bg-[#181614] select-none transition-all duration-400 ease-out ${
        isTransitioning ? "scale-[0.98] opacity-0" : "scale-100 opacity-100"
      }`}
    >
      <GoldCrucible skip={skip} onEnter={handleEnter} />
    </div>
  );
};