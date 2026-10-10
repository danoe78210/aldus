import React, { useState } from "react";
import { GoldCrucible } from "./GoldCrucible";

interface RightPageProps {
  /** Ouvre le sommaire des réglages (tour de page vers le niveau 1). */
  onEnter?: () => void;
  /** Conservé pour compatibilité (la sortie reste sur la tranche gauche). */
  onQuit?: () => void;
}

/**
 * Page de droite d'accueil : **fonderie du caractère** — le creuset est le seul
 * point focal, centré sur le feuillet d'ébène. L'animation démarre seule ; un clic
 * n'importe où court-circuite la coulée, puis `onEnter()` suit la solidification.
 */
export const RightPage: React.FC<RightPageProps> = ({ onEnter }) => {
  const [skip, setSkip] = useState(false);

  return (
    <div
      onClick={() => setSkip(true)}
      className="flex h-full w-full cursor-pointer items-center justify-center bg-[#181614] select-none"
    >
      <GoldCrucible skip={skip} onEnter={onEnter} />
    </div>
  );
};