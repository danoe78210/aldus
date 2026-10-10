import React from "react";
import {
  Settings,
  Info,
  ListTree,
  BookMarked,
  Share2,
  SpellCheck,
  LogOut,
} from "lucide-react";
import aldusEmblem from "../assets/aldus-emblem.png";
import { InfoIdentityPanel } from "./InfoView";
import type { ActiveMenu } from "../types";

interface LeftPageProps {
  /** Onglet actuellement sélectionné. */
  activeMenu: ActiveMenu;
  /** Sélectionne un onglet. */
  setActiveMenu: (menu: ActiveMenu) => void;
  /** Ferme proprement l'application (cinématique 3D puis sortie native). */
  onExitApp: () => void;
}

interface TabItem {
  id: ActiveMenu;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
  /** Couleur thématique de l'onglet. */
  color: string;
}

// Marque-pages / onglets extérieurs (débordent à gauche du livre).
// Cuirs anciens : maroquin havane, lapis-lazuli, vert sauge, cuir doré,
// garance, encre de noix de galle.
const tabs: TabItem[] = [
  { id: "reglages", label: "Réglages", icon: Settings, color: "bg-linear-to-r from-[#2c1a0e] to-[#1c1209]" },
  { id: "infos", label: "Informations", icon: Info, color: "bg-linear-to-r from-[#121c26] to-[#0b1219]" },
  { id: "organisation", label: "Organisation", icon: ListTree, color: "bg-linear-to-r from-[#122117] to-[#0a140e]" },
  { id: "correcteur", label: "Correcteur", icon: SpellCheck, color: "bg-linear-to-r from-[#332408] to-[#1f1604]" },
  { id: "couverture", label: "Couverture", icon: BookMarked, color: "bg-linear-to-r from-[#300d0d] to-[#1f0808]" },
  { id: "export", label: "Export", icon: Share2, color: "bg-linear-to-r from-[#1c1421] to-[#110c14]" },
];

export const LeftPage: React.FC<LeftPageProps> = ({
  activeMenu,
  setActiveMenu,
  onExitApp,
}) => {
  return (
    <div className="relative flex h-full flex-col items-center justify-center text-center">
      {/* Marque-pages empilés verticalement, en débordement sur la gauche */}
      <nav className="absolute top-16 -left-28 flex flex-col gap-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = activeMenu === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveMenu(tab.id)}
              aria-current={active ? "page" : undefined}
              className={`flex w-32 min-w-[7.5rem] items-center gap-2.5 rounded-l-sm border-l-2 border-[#b89355]/50 border-r border-[#383126]/60 px-3 py-2.5 text-left font-serif text-[11px] uppercase tracking-widest text-[#e2d5bd] shadow-[-4px_2px_8px_rgba(0,0,0,0.6)] transition-all duration-150 ${tab.color} ${
                active
                  ? "-translate-x-1.5 text-[#ffd700] shadow-[-4px_0_12px_rgba(184,147,85,0.25)]"
                  : "opacity-90 hover:-translate-x-1 hover:opacity-100"
              }`}
            >
              <Icon size={18} strokeWidth={1.75} />
              <span className="tracking-wide">{tab.label}</span>
            </button>
          );
        })}

        {/* Action permanente dédiée : sortie de l'atelier depuis tout écran. */}
        <div className="mt-4 border-t border-stone-400/20 pt-2">
          <button
            type="button"
            onClick={onExitApp}
            title="Fermer Aldus"
            className="flex w-32 min-w-[7.5rem] items-center gap-2.5 rounded-l-sm border border-[#383125] bg-[#121110] px-3 py-2.5 text-left font-serif text-[11px] uppercase tracking-widest text-[#bda888] shadow-[-4px_2px_8px_rgba(0,0,0,0.6)] transition-all duration-150 hover:-translate-x-1 hover:text-[#d4af37]"
          >
            <LogOut size={16} strokeWidth={1.75} />
            <span className="tracking-wide">Quitter l&rsquo;atelier</span>
          </button>
        </div>
      </nav>

      {activeMenu === "infos" ? (
        <InfoIdentityPanel />
      ) : (
      <div className="flex flex-col items-center justify-center select-none py-12">
        {/* Médaillon lettrine Aldus avec incrustation sans fond */}
        <div className="relative mb-6 flex items-center justify-center">
          <img
            src={aldusEmblem}
            alt="Emblème Aldus"
            className="h-36 w-36 object-contain drop-shadow-[0_4px_16px_rgba(212,175,55,0.2)]"
          />
        </div>

        {/* Titre principal gravé */}
        <h1 className="bg-linear-to-b from-[#f3e7c4] via-[#d4af37] to-[#997728] bg-clip-text font-serif text-3xl font-semibold uppercase tracking-[0.38em] text-transparent">
          A L D U S
        </h1>

        {/* Filets laiton doubles & Sous-titre */}
        <div className="mt-4 flex flex-col items-center gap-1.5">
          {/* Double filet supérieur */}
          <div className="flex w-64 flex-col gap-0.5">
            <div className="h-px w-full bg-linear-to-r from-transparent via-[#d4af37] to-transparent" />
            <div className="h-px w-full bg-linear-to-r from-transparent via-[#d4af37]/60 to-transparent" />
          </div>

          {/* Sous-titre officiel */}
          <span className="font-serif text-sm italic tracking-widest text-[#ded7cb]">
            Atelier du Livre Moderne
          </span>

          {/* Filet inférieur */}
          <div className="h-px w-64 bg-linear-to-r from-transparent via-[#d4af37]/80 to-transparent" />
        </div>
      </div>
      )}
    </div>
  );
};
