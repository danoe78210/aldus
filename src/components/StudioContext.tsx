import { createContext, useContext } from "react";
import type {
  BookInfoConfig,
  CoverStudioState,
  ErrorLogConfig,
  ImageColorMode,
  LogDiagnosticLevel,
  LogLevel,
  ManuscriptLayoutConfig,
  PaginationResult,
  SalonTarget,
  DeckSelection,
  SourcesConfig,
  SpecialPageRole,
  StructureItem,
} from "../types";
import type { FsDirectoryHandle } from "../utils/directory";
import type { ExportFormId } from "../utils/exportEngine";
import type { TypographyAnomaly, TypographyRuleId } from "../utils/typographyEngine";

/** Feuillet du Correcteur déployé par la bascule d'en-tête (VII / VIII). */
export type ProofTab = "purete" | "banc";

export interface TypoBatchSummary {
  chaptersModified: number;
  apostrophesCount: number;
  spacesCount: number;
  dashesCount: number;
  ligaturesCount: number;
}

/**
 * État applicatif exposé aux **pages du livre virtuel** (vue de droite).
 *
 * Les pages de menus sont rendues dans `react-pageflip`, dont le contenu ne doit
 * pas changer d'identité à chaque rendu (sinon le livre se ré-initialise et
 * l'animation de page tournée est interrompue). En lisant l'état via ce contexte,
 * les pages conservent une **identité stable** tout en restant **vivantes**.
 */
export interface StudioContextValue {
  bookPagination: PaginationResult | null;
  paginationError: string | null;
  restoreProofSnapshot: (filename: string) => Promise<void>;
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

  // --- Écritoire (Feuillets III & IV) ---
  writingChapter: string;
  writingText: string;
  writingLoading: boolean;
  writingError: string | null;
  writingSaveState: 'idle' | 'saving' | 'saved';
  loadWritingChapter: (file: string) => Promise<void>;
  onWritingTextChange: (text: string) => void;
  createWritingChapter: (name: string) => Promise<void>;

  // --- Couverture (Cover Studio) ---
  /** État persistant du module Couverture (autosauvegardé dans `.danoe`). */
  cover: CoverStudioState;
  /** Met à jour partiellement l'état de la couverture. */
  onCoverChange: (patch: Partial<CoverStudioState>) => void;
  /** Signature de la structure courante (détection de dérive de pagination). */
  structureSignature: string;
  /**
   * Compteur de demandes d'export du gabarit de couverture : incrémenté depuis le
  * Feuillet VIII, écouté par le marbre de montage (Feuillet VII) qui ouvre son
   * dialogue de conformité pré-export.
   */
  coverExportRequest: number;
  /** Demande l'export du gabarit KDP (Feuillet VIII). */
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
   * bascule d'état vers l'onglet **Réglages** (premier signet de la tranche).
   */
  onEnterAtelier: () => void;
  /** Livre choisi dans la Bibliothèque, lu au Salon de lecture. */
  salonTarget: SalonTarget | null;
  /** Transmet un livre au Salon de lecture et l'ouvre. */
  onOpenSalon: (target: SalonTarget) => void;
  /** Ouvre le Studio Audio, où les disques du Lecteur sont gravés. */
  onOpenStudioAudio: () => void;
  /** Ouvre la Discothèque, où l'on choisit le disque à écouter. */
  onOpenDiscotheque: () => void;
  /** Disque et piste posés sur la platine du Lecteur, ou `null`. */
  audioDeck: DeckSelection | null;
  /** Met à jour la piste posée sur la platine (changement de bande). */
  onAudioDeckChange: (selection: DeckSelection) => void;
  /** Pose un disque sur la platine et ouvre le Lecteur. */
  onPlayOnDeck: (selection: DeckSelection) => void;

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
  /** `true` lorsque le dernier tirage s'est achevé (sceau d'achevé d'imprimer frappé). */
  pressDone: boolean;
  /** Actionne la presse : cinématique cadencée puis export des formes retenues. */
  onPress: () => void;
  /** Ouvre le dossier des épreuves dans le gestionnaire de fichiers. */
  onOpenExportDirectory: () => void;

  // --- Correcteur (Feuillets VII & VIII) ---
  /** Feuillet du Correcteur déployé par la bascule d'en-tête (partagée entre les deux pages du livre). */
  proofTab: ProofTab;
  /** Bascule le diptyque du Correcteur (VII — Indice de Qualité Typographique / VIII — Banc d'Épreuve). */
  /** Règles aldines activées : l'analyse (page gauche) suit la grille « Les Règles Analysées » (page droite). */
  proofEnabledRules: TypographyRuleId[];
  /** Active ou désactive une règle depuis « Les Règles Analysées ». */
  onToggleProofRule: (ruleId: TypographyRuleId) => void;
  /** Chapitre en épreuve (partagé entre le pupitre de lecture et les conseils de l'Imprimeur). */
  proofChapter: string;
  /** Texte brut du chapitre en épreuve : toute correction (ordres ou unitaires) se répercute sur les deux pages. */
  proofText: string;
  /** Des corrections du Banc d'Épreuve restent à valider sur disque. */
  proofDirty: boolean;
  /** Feedback bref après l'écriture du chapitre corrigé. */
  proofSaved: boolean;
  /** `true` pendant la lecture native du fichier. */
  proofLoading: boolean;
  /** Erreur de lecture du chapitre, ou `null`. */
  proofError: string | null;
  /** Charge un chapitre dans le Correcteur (lecture native du fichier). */
  loadProofChapter: (file: string) => Promise<void>;
  /** Feuillet de lecture courant du Banc d'Épreuve. */
  proofPage: number;
  /** Tourne d'un feuillet (borné à la pagination courante du chapitre). */
  setProofPage: (page: number) => void;
  /** Filtre « Afficher uniquement les feuillets contenant des anomalies ». */
  proofOnlyAnomalies: boolean;
  setProofOnlyAnomalies: (value: boolean) => void;
  /** Corrige une seule occurrence depuis les conseils de l'Imprimeur (Feuillet X). */
  applyProofAnomaly: (anomaly: TypographyAnomaly) => void;
  /** Anomalie ciblée par la commande « Localiser » (surbrillance or vénitien). */
  activeAnomalyId: string | null;
  /** Cible (ou oublie) l'anomalie à surligner dans le feuillet de lecture. */
  setActiveAnomalyId: (id: string | null) => void;
  /** Ordre majeur : impose l'Usage typographique aldin sur tout le chapitre (Feuillet IX). */
  imposeProofUsage: () => void;
  /** Consigne le chapitre justifié dans son fichier (écriture atomique). */
  persistProofChapter: () => Promise<void>;
  /** Consigne les retouches du vélin (Feuillet X) : texte partagé mis à jour, fichier écrit
      (instantané `.aldus/history/` + écriture atomique), analyse relancée. `true` si le disque est à jour. */
  saveProofRevisions: (next: string) => Promise<boolean>;
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
