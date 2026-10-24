import React, { useMemo } from "react";
import {
  Settings,
  Info,
  ListTree,
  BookMarked,
  LibraryBig,
  Share2,
  SpellCheck,
  Sparkles,
  LogOut,
  Feather,
} from "lucide-react";
import aldusEmblem from "../assets/aldus-emblem.png";
import { InfoIdentityPanel } from "./InfoView";
import { OrganizationView } from "./OrganizationView";
import { CoverPlate } from "./cover/CoverPlate";
import { PressInspection } from "./PressInspection";
import { ProofExaminer } from "./ProofExaminer";
import { EpreuvePlumeView } from "./epreuve-plume/EpreuvePlumeView";
import { ExLibrisBadge } from "./navigation/ExLibrisBadge";
import { BronzeVersionPlate } from "./navigation/BronzeVersionPlate";
import { WritingEditor } from "./WritingStudio";
import { useStudio } from "./StudioContext";
import { placeChapters } from "../data/imposition";
import type { ActiveMenu } from "../types";

interface LeftPageProps {
  /** Onglet actuellement sélectionné. */
  activeMenu: ActiveMenu;
  /** Sélectionne un onglet. */
  setActiveMenu: (menu: ActiveMenu) => void;
  /** Ferme proprement l'application (cinématique 3D puis sortie native). */
  onExitApp: () => void;
  navigationOnly?: boolean;
}

interface TabItem {
  id: ActiveMenu;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
  /** Dégradé de cuir du signet. */
  color: string;
  /** Encre du titre, accordée au cuir du signet. */
  text: string;
}

// Signets de reliure : maroquin ancien ancré sur le flanc gauche du livre.
// Chaque cuir est associé à son encre d'époque.
const tabs: TabItem[] = [
  { id: "reglages", label: "Réglages", icon: Settings, color: "bg-linear-to-r from-[#2c1a0e] to-[#1c1209]", text: "text-[#ecd8b0]" },
  { id: "infos", label: "Informations", icon: Info, color: "bg-linear-to-r from-[#121c26] to-[#0b1219]", text: "text-[#d6e3f0]" },
  { id: "ecritoire", label: "L'Écritoire", icon: Feather, color: "bg-linear-to-r from-[#183027] to-[#0d1b15]", text: "text-[#d0e5d6]" },
  { id: "organisation", label: "Organisation", icon: ListTree, color: "bg-linear-to-r from-[#122117] to-[#0a140e]", text: "text-[#d0e5d6]" },
  { id: "correcteur", label: "Correcteur", icon: SpellCheck, color: "bg-linear-to-r from-[#332408] to-[#1f1604]", text: "text-[#f2e2be]" },
  { id: "epreuve-plume", label: "Épreuve de Plume", icon: Sparkles, color: "bg-linear-to-r from-[#332408] to-[#1f1604]", text: "text-[#f2e2be]" },
  { id: "couverture", label: "Couverture", icon: BookMarked, color: "bg-linear-to-r from-[#300d0d] to-[#1f0808]", text: "text-[#eed0d0]" },
  { id: "export", label: "Export", icon: Share2, color: "bg-linear-to-r from-[#1c1421] to-[#110c14]", text: "text-[#e0d2e8]" },
  { id: "bibliotheque", label: "Bibliothèque", icon: LibraryBig, color: "bg-linear-to-r from-[#2a1d17] to-[#17100c]", text: "text-[#e5d0b1]" },
];

/**
 * Frontispice de l'atelier : médaillon laiton + titre gravé + sous-titre.
 * Partagé par le **sas d'accueil** (fondu de sortie pendant la transition) et
 * par les onglets hors « Informations » (identité permanente du registre).
 */
const Frontispice: React.FC<{ leaving: boolean }> = ({ leaving }) => (
  <div
    className={`my-auto flex flex-col items-center justify-center py-12 text-center transition-all duration-400 ease-out ${
      leaving ? "scale-[0.98] opacity-0" : "scale-100 opacity-100"
    }`}
  >
    {/* Médaillon lettrine Aldus avec incrustation sans fond */}
    <div className="relative mb-6 flex items-center justify-center">
      <img
        src={aldusEmblem}
        alt="Emblème Aldus"
        className="h-36 w-36 object-contain drop-shadow-[0_4px_16px_rgba(212,175,55,0.2)]"
      />
    </div>

    {/* Titre principal gravé */}
    <h1 className="bg-linear-to-b from-[#f3e7c4] via-[#d4af37] to-[#997728] bg-clip-text font-serif text-3xl font-semibold tracking-[0.38em] text-transparent uppercase">
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
);

export const LeftPage: React.FC<LeftPageProps> = ({
  activeMenu,
  setActiveMenu,
  onExitApp,
  navigationOnly = false,
}) => {
  const {
    isAtelierOpen,
    isTransitioning,
    structure,
    chapterFiles,
    imageFiles,
    sourcesConfigured,
    onAddAct,
    onAddChapter,
    onAddImage,
    onAddSpecial,
    onRemoveStructureItem,
    onRenameStructureItem,
    onSpecialRoleChange,
    onStructureSourceChange,
    onStructureReorder,
    onPickSourcesDirectory,
    onImportIntoFolder,
    onImportChapters,
    cover,
  } = useStudio();
  /** Folio composé de chaque élément (points de conduite du Feuillet III). */
  const folioById = useMemo(() => {
    const map = new Map<string, number>();
    placeChapters(structure, Math.max(1, cover.pageCount)).forEach((placement) => {
      map.set(placement.id, placement.startPage);
    });
    return map;
  }, [structure, cover.pageCount]);

  return (
    <div className="relative h-full w-full">
      {/* Signets de reliure — greffés sur la tranche extérieure gauche, en débord
          du feuillet (aucune morsure sur la surface d'écriture). **Strictement
          absents du DOM** tant que l'atelier n'est pas ouvert (sas d'accueil). */}
      {isAtelierOpen && (
        <nav className="absolute top-8 left-0 z-20 flex h-[calc(100%-4rem)] w-36 -translate-x-full flex-col gap-1.5 animate-ink-reveal">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeMenu === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveMenu(tab.id)}
                aria-current={active ? "page" : undefined}
                className={`flex w-full items-center gap-2.5 rounded-l-sm border-y border-l-2 border-r border-y-[#2c2414] border-r-[#2c2414] px-3 py-2.5 text-left font-serif text-[11px] tracking-widest uppercase shadow-[-4px_2px_8px_rgba(0,0,0,0.6)] transition-all duration-150 ${tab.color} ${tab.text} ${
                  active
                    ? "-translate-x-1.5 border-l-[#ffd700] text-[#ffd700] shadow-[-4px_0_12px_rgba(184,147,85,0.25)]"
                    : "border-l-[#b89355]/60 opacity-90 hover:-translate-x-1 hover:opacity-100"
                }`}
              >
                <Icon size={18} strokeWidth={1.75} />
                <span className="tracking-wide">{tab.label}</span>
              </button>
            );
          })}

          {/* Bas de tranche : Ex-Libris de l'auteur, puis sortie de l'atelier */}
          <div className="mt-auto flex w-full flex-col items-center space-y-4">
            {/* L'Ex-Libris de Danoë — emblème du Dragon, ouvre danoeecrivain.net */}
            <ExLibrisBadge />

            {/* Marque d'attache discrète : la sortie de l'atelier siége au bas de la
                tranche, sans jamais flotter sur la feuille. */}
            <button
              type="button"
              onClick={onExitApp}
              title="Fermer Aldus"
              className="flex w-full items-center gap-2.5 rounded-l-sm border-y border-l-2 border-r border-y-[#2c2414] border-r-[#2c2414] border-l-[#8f6e2b]/50 bg-linear-to-r from-[#1a120a] to-[#0f0a06] px-3 py-2 text-left font-serif text-[11px] uppercase tracking-widest text-[#bda888]/80 shadow-[-4px_2px_8px_rgba(0,0,0,0.6)] transition-all duration-150 hover:-translate-x-1 hover:text-[#d4af37]"
            >
              <LogOut size={14} strokeWidth={1.75} />
              <span className="tracking-wide">Quitter l&rsquo;atelier</span>
            </button>
          </div>
        </nav>
      )}

      {/* Feuillet d'écriture — recentré royalement (padding symétrique) dès lors
          que les signets sont absents, ou laissé vierge de tout élément parasite. */}
      {!navigationOnly && <div className="flex h-full w-full flex-col items-center justify-center px-10 py-10 text-center">

      {activeMenu === "infos" ? (
        <InfoIdentityPanel />
      ) : activeMenu === "ecritoire" ? (
        <WritingEditor />
      ) : activeMenu === "organisation" ? (
        /* Feuillet V — Table des matières & feuillets (registre de composition). */
        <div className="animate-ink-reveal flex h-full w-full flex-col">
          <h2 className="mb-5 text-center font-serif text-lg tracking-[0.25em] text-[#d4af37] uppercase">
            V. Table des Matières &amp; Feuillets
          </h2>
          <OrganizationView
            items={structure}
            chapterFiles={chapterFiles}
            imageFiles={imageFiles}
            sourcesConfigured={sourcesConfigured}
            onAddAct={onAddAct}
            onAddChapter={onAddChapter}
            onAddImage={onAddImage}
            onAddSpecial={onAddSpecial}
            onRemove={onRemoveStructureItem}
            onRename={onRenameStructureItem}
            onRoleChange={onSpecialRoleChange}
            onSourceChange={onStructureSourceChange}
            onReorder={onStructureReorder}
            onPickSourcesDirectory={onPickSourcesDirectory}
            onImportChapterSource={onImportIntoFolder}
            onImportImageSource={onImportIntoFolder}
            onImportSpecialSource={onImportIntoFolder}
            onImportChapters={onImportChapters}
            folioById={folioById}
          />
        </div>
      ) : activeMenu === "couverture" ? (
        /* Feuillet VII — marbre de montage 2D/3D (le calibreur est à droite). */
        <CoverPlate />
      ) : activeMenu === "correcteur" ? (
        /* Feuillet IX — l'Examen Aldin (le banc d'épreuve est à droite). */
        <ProofExaminer />
      ) : activeMenu === "epreuve-plume" ? (
        <EpreuvePlumeView onOpenCorrector={() => setActiveMenu("correcteur")} />
      ) : activeMenu === "export" ? (
        /* Feuillet XI — inspection pré-presse (le tirage est à droite). */
        <PressInspection />
      ) : (
        <Frontispice leaving={isTransitioning} />
      )}
      </div>}
      {!navigationOnly && activeMenu === "reglages" && (
        <div className="pointer-events-none absolute bottom-10 left-1/2 z-20 -translate-x-1/2">
          <BronzeVersionPlate className="pointer-events-auto flex h-[30px] w-[152px] items-center justify-center" />
        </div>
      )}
    </div>
  );
};
