import { createContext, useContext } from "react";
import type {
  BookInfoConfig,
  CoverStudioState,
  ErrorLogConfig,
  ImageColorMode,
  LogDiagnosticLevel,
  LogLevel,
  ManuscriptLayoutConfig,
  SourcesConfig,
  SpecialPageRole,
  StructureItem,
} from "../types";
import type { FsDirectoryHandle } from "../utils/directory";
import type { ExportFormId } from "../utils/exportEngine";

/**
 * État applicatif exposé aux **pages du livre virtuel** (vue de droite).
 *
 * Les pages de menus sont rendues dans `react-pageflip`, dont le contenu ne doit
 * pas changer d'identité à chaque rendu (sinon le livre se ré-initialise et
 * l'animation de page tournée est interrompue). En lisant l'état via ce contexte,
 * les pages conservent une **identité stable** tout en restant **vivantes**.
 */
export interface StudioContextValue {
  // --- Réglages ---
  manuscriptConfig: ManuscriptLayoutConfig;
  sourceConfig: SourcesConfig;
  errorLogConfig: ErrorLogConfig;
  onTrimChange: (presetId: string) => void;
  onLayoutChange: (patch: Partial<ManuscriptLayoutConfig>) => void;
  onSourcesDirectoryChange: (
    path: string,
    files: string[],
    handle: FsDirectoryHandle | null,
  ) => void;
  onImageColorModeChange: (mode: ImageColorMode) => void;
  onLogLevelChange: (level: LogDiagnosticLevel) => void;
  onLogDirectoryChange: (path: string) => void;
  onOpenLog: () => void;

  // --- Informations ---
  bookInfo: BookInfoConfig;
  onInfoFieldChange: (
    section: string,
    label: string,
    field: keyof BookInfoConfig,
    value: string,
  ) => void;

  // --- Organisation ---
  structure: StructureItem[];
  chapterFiles: string[];
  imageFiles: string[];
  sourcesConfigured: boolean;
  onAddAct: () => void;
  onAddChapter: () => void;
  onAddImage: () => void;
  onAddSpecial: () => void;
  onRemoveStructureItem: (id: string) => void;
  onRenameStructureItem: (id: string, value: string) => void;
  onSpecialRoleChange: (id: string, role: SpecialPageRole) => void;
  onStructureSourceChange: (id: string, fileName: string) => void;
  onStructureReorder: (items: StructureItem[]) => void;
  onPickSourcesDirectory: () => void;
  onImportIntoFolder: (id: string) => void;

  // --- Couverture (Cover Studio) ---
  /** État persistant du module Couverture (autosauvegardé dans `.danoe`). */
  cover: CoverStudioState;
  /** Met à jour partiellement l'état de la couverture. */
  onCoverChange: (patch: Partial<CoverStudioState>) => void;
  /** Signature de la structure courante (détection de dérive de pagination). */
  structureSignature: string;
  /**
   * Compteur de demandes d'export du gabarit de couverture : incrémenté depuis le
   * Feuillet VI, écouté par le marbre de montage (Feuillet V) qui ouvre son
   * dialogue de conformité pré-export.
   */
  coverExportRequest: number;
  /** Demande l'export du gabarit KDP certifié (Feuillet VI). */
  onRequestCoverExport: () => void;

  // --- Export ---
  onExport: (format: string) => void;
  /** Ouvre l'aperçu interactif (flipbook) du manuscrit rendu par Typst. */
  onPreview: () => void;
  isExporting: boolean;

  // --- Application ---
  /** Ferme proprement l'application (cinématique 3D du livre + purge des caches). */
  onQuit: () => void;

  // --- Dossiers & sélecteurs natifs (bandeau inférieur) ---
  /** Dossier de travail du projet (racine des sources), ou `null`. */
  projectDirectory: string | null;
  /**
   * Ouvre le sélecteur de dossier **natif** et associe le dossier de travail du
   * projet (racine des sources + emplacement du fichier `.danoe`).
   */
  onPickProjectDirectory: () => void;
  /**
   * Importe un ou plusieurs **chapitres** dans la table des feuillets.
   * Sans argument : ouvre le sélecteur natif multi-fichiers (`.md`, `.docx`,
   * `.txt`, `.typ`). Avec `paths` : importe ces fichiers (glisser-déposer).
   */
  onImportChapters: (paths?: string[]) => void;

  // --- Sas d'accueil → Atelier (transition cinématique d'entrée) ---
  /** `true` dès que l'utilisateur est entré : le sas d'accueil est démonté. */
  isAtelierOpen: boolean;
  /** `true` pendant le voile d'encre (fondu sortant du sas d'accueil). */
  isTransitioning: boolean;
  /**
   * Déclenche la transition cinématique d'entrée : impulsion, voile d'encre puis
   * bascule d'état vers l'onglet **Informations** (Feuillets I & II).
   */
  onEnterAtelier: () => void;

  // --- Journal d'atelier (StatusBar) ---
  /** Consigne un message horodaté dans le journal d'opérations. */
  onNotify: (level: LogLevel, message: string) => void;

  // --- Presse & export (Feuillets IX & X) ---
  /** Formes d'édition retenues pour le tirage. */
  exportForms: Record<ExportFormId, boolean>;
  /** Active ou désactive une forme d'édition. */
  onToggleExportForm: (id: ExportFormId) => void;
  /** Dossier de fabrication (destination des livrables), ou `null`. */
  exportDirectory: string | null;
  /** Choisit le dossier de destination (sélecteur natif). */
  onPickExportDirectory: () => void;
  /** Étape courante du pressage (indice), `-1` hors tirage. */
  pressStage: number;
  /** `true` pendant la cinématique de tirage. */
  isPressing: boolean;
  /** Actionne la presse : cinématique cadencée puis export des formes retenues. */
  onPress: () => void;
  /** Ouvre le dossier des épreuves dans le gestionnaire de fichiers. */
  onOpenExportDirectory: () => void;
}

const StudioContext = createContext<StudioContextValue | null>(null);

/** Fournit l'état applicatif aux pages du livre virtuel. */
export const StudioProvider = StudioContext.Provider;

/** Accède à l'état applicatif (hors du fournisseur, lève une erreur explicite). */
// eslint-disable-next-line react-refresh/only-export-components -- le fichier de contexte expose aussi son hook d'accès
export const useStudio = (): StudioContextValue => {
  const value = useContext(StudioContext);
  if (!value) {
    throw new Error("useStudio doit être utilisé dans un StudioProvider.");
  }
  return value;
};
