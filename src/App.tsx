import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import './index.css';
import { Layout } from "./components/Layout";
import { LeftPage } from "./components/LeftPage";
import { MenuPage } from "./components/MenuPage";
import { PreviewFlipbook } from "./components/PreviewFlipbook";
import { StudioProvider, type ProofTab, type StudioContextValue } from "./components/StudioContext";
import { Toast, type ToastMessage } from "./components/Toast";
import type { ActiveMenu, BookInfoConfig, CoverStudioState, ErrorLogConfig, ImageColorMode, LogDiagnosticLevel, LogEntry, LogLevel, ManuscriptLayoutConfig, SourcesConfig, SpecialPageRole, StructureItem } from "./types";
import { findTrimPreset } from "./data/trimSizes";
import { INHERIT_FONT, numberFr } from "./data/fonts";
import { DEFAULT_SPECIAL_ROLE, specialRoleLabel } from "./data/specialPages";
import { openPathExternal } from "./utils/shell";
import { invokeCommand, isInvokeAvailable, listenEvent } from "./utils/tauri";
import {
  importFileIntoFolder,
  isFsAvailable,
  listDirectoryFiles,
  pickDirectory,
  pickDirectoryWithFiles,
  type FsDirectoryHandle,
} from "./utils/directory";
import { openNativeDirectory, openNativeFiles } from "./utils/nativeDialog";
import {
  PROJECT_FILE_NAME,
  buildProjectFile,
  loadProject,
  parseProjectJson,
  saveProject,
  treeToFlat,
} from "./utils/projectFile";
import { isImageFile, splitSourceFiles } from "./utils/sources";
import { finalizeExit, onCloseRequested } from "./utils/shutdown";
import { EXPORT_FORMS, PRESS_STAGES, PRESS_TOTAL_MS, type ExportFormId } from "./utils/exportEngine";
import { createChapterFile, listChapterFiles as listNativeChapterFiles, readChapterFile, writeChapterFile } from "./utils/projectApi";
import { showSpaces } from "./utils/proofLayout";
import {
  ALL_RULES,
  analyzeTypography,
  applyAldineUsage,
  applyAnomaly,
  type TypographyAnomaly,
  type TypographyRuleId,
} from "./utils/typographyEngine";

/** Charge utile de l'événement `export-progress` émis par le moteur Rust. */
interface ExportProgressPayload {
  step: string;
  progress: number;
}

/** Délai (ms) du voile d'encre avant la bascule d'état du sas d'accueil. */
const ATELIER_TRANSITION_MS = 450;

/** Extensions acceptées à l'import des chapitres (Feuillet III). */
const CHAPTER_EXTENSIONS = ["md", "docx", "txt", "typ"];

const currentTime = () =>
  new Date().toLocaleTimeString("fr-FR", { hour12: false });

let logSequence = 0;
const createLog = (level: LogLevel, message: string): LogEntry => ({
  id: `${Date.now()}-${logSequence++}`,
  time: currentTime(),
  level,
  message,
});

let structureSequence = 0;
const nextStructureId = (type: string): string =>
  `${type}-${Date.now()}-${structureSequence++}`;

// Configuration de mise en page du manuscrit EXPORTÉ (Word / PDF conforme KDP).
// Portée stricte : ces valeurs ne concernent QUE le document final généré
// (métadonnées & règles de mise en page pour les moteurs d'export).
// Elles ne modifient en AUCUN cas les styles CSS de l'interface du studio.
const DEFAULT_MANUSCRIPT: ManuscriptLayoutConfig = {
  trimSize: "6x9",
  bodyFont: "Garamond",
  bodySize: 11,
  lineSpacing: 1.15,
  textAlignment: "justify",
  dropCap: true,
  chapterTitleFont: "body",
  chapterTitleSize: 16,
  subtitleFont: "body",
  subtitleSize: 14,
};

/** Construit le message de journal décrivant un changement de mise en page. */
const describeLayoutChange = (
  patch: Partial<ManuscriptLayoutConfig>,
  next: ManuscriptLayoutConfig,
): string => {
  const resolve = (font: string): string =>
    font === INHERIT_FONT ? next.bodyFont : font;
  const parts: string[] = [];

  if ("bodyFont" in patch || "bodySize" in patch) {
    parts.push(`${next.bodyFont} ${numberFr(next.bodySize)}pt`);
  }
  if ("lineSpacing" in patch) {
    parts.push(`interligne ${numberFr(next.lineSpacing)}`);
  }
  if ("textAlignment" in patch) {
    parts.push(next.textAlignment === "justify" ? "justifié" : "aligné à gauche");
  }
  if ("dropCap" in patch) {
    parts.push(next.dropCap ? "lettrine active" : "lettrine inactive");
  }
  if ("chapterTitleFont" in patch || "chapterTitleSize" in patch) {
    parts.push(
      `titre de chapitre ${resolve(next.chapterTitleFont)} ${numberFr(next.chapterTitleSize)}pt`,
    );
  }
  if ("subtitleFont" in patch || "subtitleSize" in patch) {
    parts.push(
      `sous-titres ${resolve(next.subtitleFont)} ${numberFr(next.subtitleSize)}pt`,
    );
  }
  return `Mise en page manuscrit mise à jour : ${parts.join(", ")}`;
};

// Configuration des sources brutes du roman (dossier unique « Mes sources »).
const DEFAULT_SOURCES: SourcesConfig = {
  directory: null,
  colorMode: "grayscale",
};

const IMAGE_COLOR_LABELS: Record<ImageColorMode, string> = {
  color: "Couleur",
  grayscale: "Noir & Blanc",
};

// Configuration du journal des erreurs.
const DEFAULT_ERROR_LOG: ErrorLogConfig = {
  level: "standard",
  directory: null,
};

// État par défaut du module Couverture (Cover Studio).
const DEFAULT_COVER: CoverStudioState = {
  frontPath: null,
  backPath: null,
  pageCount: 120,
  paperType: "cream",
  spineText: "",
  spineColorFront: null,
  spineColorBack: null,
  gradient: false,
  pageCountSnapshot: 120,
  structureSignature: "",
  backLogoPath: null,
};

// Ordre des pages du livre virtuel de droite (identique à l'ordre du ruban gauche).
const MENU_ORDER: ActiveMenu[] = [
  'reglages',
  'infos',
  'ecritoire',
  'organisation',
  'correcteur',
  'couverture',
  'export',
];

// Pages du livre virtuel — identité **stable** (constante module) : leur contenu
// reste vivant via `StudioContext`, sans ré-initialiser le flipbook.
const BOOK_PAGES = MENU_ORDER.map((menu) => <MenuPage key={menu} menu={menu} />);

const LOG_LEVEL_LABELS: Record<LogDiagnosticLevel, string> = {
  standard: "Standard",
  diagnostic: "Mécanique",
};

// Métadonnées du roman (onglet « Informations »).
const DEFAULT_BOOK_INFO: BookInfoConfig = {
  title: "Les Schattenjägers",
  subtitle: "",
  sagaTitle: "",
  volumeNumber: "",
  author: "Danoë",
  contributor: "",
  publisher: "",
  isbn: "",
  year: "2026",
  printLocation: "",
  otherBooks: "",
  copyright: "",
  website: "",
};

const App: React.FC = () => {
  const [activeMenu, setActiveMenu] = useState<ActiveMenu>('reglages');
  // Sas d'accueil → Atelier : `isTransitioning` couvre le voile d'encre (fondu
  // sortant du frontispice et du creuset), `isAtelierOpen` marque l'entrée
  // effective (démontage du sas, révélation des feuillets manuscrits).
  const [isAtelierOpen, setIsAtelierOpen] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const enteringRef = useRef(false);
  const pressingRef = useRef(false);
  // Presse & export : formes retenues, dossier de fabrication, cinématique.
  const [exportForms, setExportForms] = useState<Record<ExportFormId, boolean>>({
    "pdf-x": true,
    epub32: true,
    "cover-300": true,
    "docx-x": true,
  });
  const [exportDirectory, setExportDirectory] = useState<string | null>(null);
  const [coverExportRequest, setCoverExportRequest] = useState(0);
  const [pressStage, setPressStage] = useState(-1);
  const [isPressing, setIsPressing] = useState(false);
  const [pressDone, setPressDone] = useState(false);
  // Correcteur (Feuillets IX & X) : la bascule d'en-tête, les règles actives,
  // le chapitre/texte en épreuve et la pagination du banc sont **partagés** entre
  // la page gauche et la page droite du livre (les deux volets du diptyque).
  const [proofTab, setProofTab] = useState<ProofTab>("purete");
  const [proofEnabledRules, setProofEnabledRules] = useState<TypographyRuleId[]>(
    ALL_RULES.map((rule) => rule.id),
  );
  const [proofChapter, setProofChapter] = useState("");
  const [proofText, setProofText] = useState("");
  const [proofLoading, setProofLoading] = useState(false);
  const [proofError, setProofError] = useState<string | null>(null);
  const [proofPage, setProofPage] = useState(1);
  const [proofOnlyAnomalies, setProofOnlyAnomalies] = useState(false);
  // Commande « Localiser » (Feuillet VIII) : anomalie ciblée dans le feuillet de lecture.
  const [activeAnomalyId, setActiveAnomalyId] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>(() => [
    createLog('info', 'Studio initialisé. Prêt à écrire.'),
    createLog('success', 'Projet « Les Schattenjägers » chargé.'),
  ]);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('~ OFFICINA ALDINA · COMPOSITIO LIBRORUM ~');
  const [running, setRunning] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [manuscriptConfig, setManuscriptConfig] =
    useState<ManuscriptLayoutConfig>(DEFAULT_MANUSCRIPT);
  const [sourceConfig, setSourceConfig] =
    useState<SourcesConfig>(DEFAULT_SOURCES);
  const [errorLogConfig, setErrorLogConfig] =
    useState<ErrorLogConfig>(DEFAULT_ERROR_LOG);
  const [bookInfo, setBookInfo] = useState<BookInfoConfig>(DEFAULT_BOOK_INFO);
  const [structure, setStructure] = useState<StructureItem[]>([]);
  const [chapterFiles, setChapterFiles] = useState<string[]>([]);
  const [imageFiles, setImageFiles] = useState<string[]>([]);
  // État persistant du module Couverture (synchronisé dans le fichier `.danoe`).
  const [cover, setCover] = useState<CoverStudioState>(DEFAULT_COVER);
  const [writingChapter, setWritingChapter] = useState("");
  const [writingText, setWritingText] = useState("");
  const [writingLoading, setWritingLoading] = useState(false);
  const [writingError, setWritingError] = useState<string | null>(null);
  const [writingDirty, setWritingDirty] = useState(false);
  const [writingSaveState, setWritingSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const writingRequestRef = useRef(0);
  const writingLatestRef = useRef({ chapter: "", text: "" });
  const writingSaveQueueRef = useRef<Promise<void>>(Promise.resolve());

  const persistWritingText = useCallback((chapter: string, text: string) => {
    const queuedWrite = writingSaveQueueRef.current.then(() => writeChapterFile(chapter, text));
    writingSaveQueueRef.current = queuedWrite.catch(() => undefined);
    return queuedWrite;
  }, []);
  // Payload figé de l'aperçu interactif (null = fermé) : capturé à l'ouverture
  // pour une identité stable (évite toute re-génération au re-rendu).
  const [previewPayload, setPreviewPayload] = useState<unknown | null>(null);
  // Cinématique de fermeture du livre (déclenchée par le bouton ou la croix native).
  const [isClosing, setIsClosing] = useState(false);
  const [projectFilePath, setProjectFilePath] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [hydrated, setHydrated] = useState(false);
  const timerRef = useRef<number | null>(null);
  const sourceHandleRef = useRef<FsDirectoryHandle | null>(null);

  const addLog = useCallback((level: LogLevel, message: string) => {
    setLogs((previous) => [...previous, createLog(level, message)]);
  }, []);

  // Mise à jour partielle de l'état de la couverture (autosauvegardé).
  const handleCoverChange = useCallback((patch: Partial<CoverStudioState>) => {
    setCover((previous) => ({ ...previous, ...patch }));
  }, []);

  // Signature de la structure courante — empreinte déterministe intégrant le VOLUME textuel
  // par section (`wordCount`) : détecte une dérive de contenu, pas seulement un ajout/suppression (§8/§10).
  const structureSignature = useMemo(
    () => structure.map((item) => `${item.id}:${item.type}:${item.wordCount ?? 0}`).join("|"),
    [structure],
  );

  // Fermeture animée : le volet 3D du livre se rabat, puis la sortie est finalisée.
  const handleQuit = useCallback(() => {
    setIsClosing(true);
  }, []);

  // Croix native de la fenêtre → déclenche la même cinématique de fermeture.
  useEffect(() => {
    onCloseRequested(() => setIsClosing(true));
  }, []);

  // Extinction du glow (~1 000 ms) puis fermeture native définitive.
  useEffect(() => {
    if (!isClosing) {
      return;
    }
    const handle = window.setTimeout(() => {
      void finalizeExit();
    }, 1150);
    return () => window.clearTimeout(handle);
  }, [isClosing]);

  // Nettoyage de l'intervalle en cas de démontage.
  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearInterval(timerRef.current);
      }
    };
  }, []);

  // Détection des fichiers du dossier unique (watcher — Tauri uniquement). Hors
  // Tauri, les fichiers sont fournis par le sélecteur de dossier lui-même.
  // Le moteur de tri répartit ensuite les fichiers par extension.
  useEffect(() => {
    if (!isFsAvailable()) {
      return;
    }
    let active = true;
    listDirectoryFiles(sourceConfig.directory).then((files) => {
      console.log("[sources] énumération du dossier :", {
        directory: sourceConfig.directory,
        files,
      });
      if (active) {
        const { chapters, images } = splitSourceFiles(files);
        setChapterFiles(chapters);
        setImageFiles(images);
      }
    });
    return () => {
      active = false;
    };
  }, [sourceConfig.directory]);

  // Restauration du projet au démarrage (fichier Tauri ou repli localStorage).
  useEffect(() => {
    let active = true;
    loadProject(null).then((text) => {
      if (!active) {
        return;
      }
      const data = text ? parseProjectJson(text) : null;
      if (data) {
        if (data.metadata) {
          const metadata = data.metadata;
          setBookInfo({
            title: metadata.bookTitle ?? "",
            subtitle: metadata.subtitle ?? "",
            sagaTitle: metadata.sagaTitle ?? "",
            volumeNumber: metadata.volumeNumber ?? "",
            author: metadata.authorName ?? "",
            contributor: metadata.contributor ?? "",
            publisher: metadata.publisher ?? "",
            isbn: metadata.isbn ?? "",
            year: metadata.year ?? "",
            printLocation: metadata.printLocation ?? "",
            otherBooks: metadata.otherBooks ?? "",
            copyright: metadata.copyrightText ?? "",
            website: metadata.website ?? "",
          });
        }
        if (data.layoutConfig) {
          setManuscriptConfig({ ...DEFAULT_MANUSCRIPT, ...data.layoutConfig });
        }
        if (data.directories) {
          const directories = data.directories;
          // Migration : le dossier unique remplace les anciens dossiers séparés.
          const sourcesDirectory =
            directories.sources ??
            directories.chapters ??
            directories.images ??
            null;
          setSourceConfig((previous) => ({
            ...previous,
            directory: sourcesDirectory,
          }));
          setErrorLogConfig((previous) => ({
            ...previous,
            directory: directories.logs ?? null,
          }));
        }
        if (data.options) {
          const options = data.options;
          setSourceConfig((previous) => ({
            ...previous,
            colorMode: options.imageColorMode ?? previous.colorMode,
          }));
          setErrorLogConfig((previous) => ({
            ...previous,
            level: options.logLevel ?? previous.level,
          }));
        }
        if (data.organization) {
          setStructure(treeToFlat(data.organization));
        }
        if (data.fileCache) {
          setChapterFiles(data.fileCache.chapters);
          setImageFiles(data.fileCache.images);
        }
        if (data.cover) {
          setCover((previous) => ({ ...previous, ...data.cover }));
        }
      }
      setHydrated(true);
    });
    return () => {
      active = false;
    };
  }, []);

  // Compile l'état courant en fichier de projet (réutilisé par la sauvegarde et l'export).
  const buildCurrentProject = useCallback(
    () =>
      buildProjectFile({
        bookInfo,
        manuscriptConfig,
        sourceConfig,
        errorLogConfig,
        structure,
        chapterFiles,
        imageFiles,
        cover,
      }),
    [
      bookInfo,
      manuscriptConfig,
      sourceConfig,
      errorLogConfig,
      structure,
      chapterFiles,
      imageFiles,
      cover,
    ],
  );

  const persistCurrentProject = useCallback(async () => {
    if (!hydrated) {
      throw new Error("Le projet n’est pas encore chargé.");
    }
    const method = await saveProject(
      JSON.stringify(buildCurrentProject(), null, 2),
      projectFilePath,
    );
    if (method === "error") {
      throw new Error("Impossible de préparer le dossier source du projet.");
    }
  }, [buildCurrentProject, hydrated, projectFilePath]);

  // Ouvre l'aperçu interactif : fige le payload courant (généré en mémoire par Typst).
  const handlePreview = useCallback(() => {
    setPreviewPayload(buildCurrentProject());
  }, [buildCurrentProject]);

  // Sauvegarde automatique (debounce ~800 ms) — aucun bouton « Enregistrer ».
  useEffect(() => {
    if (!hydrated) {
      return;
    }
    const timer = window.setTimeout(() => {
      setSaveState('saving');
      const json = JSON.stringify(buildCurrentProject(), null, 2);
      saveProject(json, projectFilePath).then((method) => {
        if (method === 'error') {
          setSaveState('idle');
          return;
        }
        setSaveState('saved');
        window.setTimeout(() => setSaveState('idle'), 1500);
      });
    }, 800);
    return () => window.clearTimeout(timer);
  }, [
    hydrated,
    buildCurrentProject,
    projectFilePath,
  ]);

  const runExport = useCallback(
    async (format: string) => {
      if (running) {
        return;
      }
      setRunning(true);
      setProgress(0);
      setProgressLabel(`Export ${format} en cours…`);
      addLog('info', `Démarrage de l'export — ${format}`);

      // Payload complet du projet (mêmes données que le fichier `.danoe`).
      const payload = buildCurrentProject();

      // **Garde-fou UI** : le moteur Rust applique une politique **stricte** — toute
      // illustration sans fichier lié (`sourceFileName` vide), introuvable ou non
      // décodable **bloque l'export** avec un message explicite remonté au frontend.
      // On prévient donc l'utilisateur AVANT l'export pour qu'il corrige dans
      // l'onglet « Organisation ».
      const unlinkedImages = structure.filter(
        (item) => item.type === "image" && !item.sourceFileName,
      );
      if (unlinkedImages.length > 0) {
        addLog(
          'warning',
          `${unlinkedImages.length} illustration(s) sans fichier lié : l'export sera BLOQUÉ tant qu'elles ne seront pas reliées à un fichier (onglet « Organisation »).`,
        );
      }

      // Débogage : vérifier que l'arborescence (chapitres ajoutés/liaisons
      // sources) est bien transmise au moteur Rust.
      console.log("[export] payload transmis au backend :", {
        format,
        directories: payload.directories,
        organization: payload.organization,
      });

      // Application empaquetée : appel réel du moteur Rust via la commande Tauri.
      if (isInvokeAvailable()) {
        try {
          // Routage par format : EPUB → scaffold, PDF → moteur Typst, sinon Word (.docx).
          const lowered = format.toLowerCase();
          const isEpub = lowered.includes('epub');
          const isPdf = lowered.includes('pdf');
          const message = isEpub
            ? await invokeCommand<string>('generate_epub', { payload })
            : isPdf
              ? await invokeCommand<string>('export_pdf', { payload })
              : await invokeCommand<string>('generate_docx', { format, payload });
          setProgress(100);
          setProgressLabel(`Export ${format} terminé`);
          addLog('success', message || `Export ${format} généré avec succès.`);
          const cancelled = message.startsWith('Export annulé');
          setToast({
            kind: cancelled ? 'info' : 'success',
            message: message || `Export ${format} généré avec succès.`,
          });
        } catch (error) {
          addLog('error', `Échec de l'export ${format} : ${String(error)}`);
          setToast({
            kind: 'error',
            message: `Échec de l'export : ${String(error)}`,
          });
        } finally {
          window.setTimeout(() => {
            setProgress(0);
            setProgressLabel('~ OFFICINA ALDINA · COMPOSITIO LIBRORUM ~');
            setRunning(false);
          }, 1600);
        }
        return;
      }

      // Repli navigateur (SPA sans Tauri) : export simulé.
      addLog(
        'warning',
        "Moteur Rust indisponible (application non empaquetée) : export simulé.",
      );
      let value = 0;
      timerRef.current = window.setInterval(() => {
        value += 10;
        setProgress(value);

        if (value >= 100 && timerRef.current !== null) {
          window.clearInterval(timerRef.current);
          timerRef.current = null;
          setProgressLabel(`Export ${format} terminé`);
          addLog('success', `Export ${format} généré avec succès.`);
          setToast({
            kind: 'success',
            message: `Export ${format} généré avec succès (simulation navigateur).`,
          });
          setRunning(false);

          window.setTimeout(() => {
            setProgress(0);
            setProgressLabel('~ OFFICINA ALDINA · COMPOSITIO LIBRORUM ~');
          }, 1600);
        }
      }, 180);
    },
    [addLog, buildCurrentProject, running, structure],
  );

  const handleTrimChange = useCallback(
    (presetId: string) => {
      const preset = findTrimPreset(presetId);
      if (!preset) {
        return;
      }
      setManuscriptConfig((previous) => ({ ...previous, trimSize: presetId }));
      addLog('success', `Format de coupe configuré sur ${preset.label} (${preset.cm})`);
    },
    [addLog],
  );

  const handleLayoutChange = useCallback(
    (patch: Partial<ManuscriptLayoutConfig>) => {
      const next = { ...manuscriptConfig, ...patch };
      setManuscriptConfig(next);
      addLog('info', describeLayoutChange(patch, next));
    },
    [manuscriptConfig, addLog],
  );

  const handleSourcesDirectoryChange = useCallback(
    (path: string, files: string[], handle: FsDirectoryHandle | null) => {
      sourceHandleRef.current = handle;
      setSourceConfig((previous) => ({ ...previous, directory: path }));
      const { chapters, images } = splitSourceFiles(files);
      setChapterFiles(chapters);
      setImageFiles(images);
      addLog('success', `Dossier des sources mis à jour : ${path}`);
    },
    [addLog],
  );

  const handleImageColorModeChange = useCallback(
    (mode: ImageColorMode) => {
      setSourceConfig((previous) => ({ ...previous, colorMode: mode }));
      addLog('info', `Images PDF configurées sur : ${IMAGE_COLOR_LABELS[mode]}`);
    },
    [addLog],
  );

  const handleLogLevelChange = useCallback(
    (level: LogDiagnosticLevel) => {
      setErrorLogConfig((previous) => ({ ...previous, level }));
      addLog(
        'info',
        `Niveau de diagnostic défini sur : ${LOG_LEVEL_LABELS[level]}`,
      );
    },
    [addLog],
  );

  const handleLogDirectoryChange = useCallback(
    (path: string) => {
      setErrorLogConfig((previous) => ({ ...previous, directory: path }));
      addLog('success', `Emplacement du journal mis à jour : ${path}`);
    },
    [addLog],
  );

  const handleOpenLog = useCallback(async () => {
    const path = errorLogConfig.directory
      ? `${errorLogConfig.directory}/danoe-studio.log`
      : "danoe-studio.log";
    const opened = await openPathExternal(path);
    if (opened) {
      addLog('success', `Ouverture du fichier de bord : ${path}`);
    } else {
      addLog(
        'warning',
        "Ouverture du fichier de bord indisponible (nécessite l'application empaquetée).",
      );
    }
  }, [errorLogConfig, addLog]);

  const handleInfoFieldChange = useCallback(
    (section: string, label: string, field: keyof BookInfoConfig, value: string) => {
      setBookInfo((previous) => ({ ...previous, [field]: value }));
      addLog('info', `[Informations - ${section}] ${label} mis à jour.`);
    },
    [addLog],
  );

  const handleAddAct = useCallback(() => {
    const count = structure.filter((item) => item.type === "act").length;
    setStructure((previous) => [
      ...previous,
      { id: nextStructureId("act"), type: "act", displayName: `Acte ${count + 1}` },
    ]);
    addLog('info', `Structure : acte ${count + 1} ajouté.`);
  }, [structure, addLog]);

  const handleAddChapter = useCallback(() => {
    const count = structure.filter((item) => item.type === "chapter").length;
    setStructure((previous) => [
      ...previous,
      {
        id: nextStructureId("chapter"),
        type: "chapter",
        displayName: `Chapitre ${count + 1}`,
        sourceFileName: "",
      },
    ]);
    addLog('info', `Structure : chapitre ${count + 1} ajouté.`);
  }, [structure, addLog]);

  const handleAddImage = useCallback(() => {
    setStructure((previous) => [
      ...previous,
      { id: nextStructureId("image"), type: "image", sourceFileName: "" },
    ]);
    addLog('info', "Structure : illustration ajoutée.");
  }, [addLog]);

  const handleAddSpecialPage = useCallback(() => {
    setStructure((previous) => [
      ...previous,
      {
        id: nextStructureId("special"),
        type: "special",
        role: DEFAULT_SPECIAL_ROLE,
        sourceFileName: "",
      },
    ]);
    addLog('info', "Structure : page spéciale ajoutée.");
  }, [addLog]);

  const handleSpecialRoleChange = useCallback(
    (id: string, role: SpecialPageRole) => {
      setStructure((previous) =>
        previous.map((item) => (item.id === id ? { ...item, role } : item)),
      );
      addLog(
        'info',
        `Structure : rôle de la page spéciale défini sur « ${specialRoleLabel(role)} ».`,
      );
    },
    [addLog],
  );

  const handleRemoveStructureItem = useCallback(
    (id: string) => {
      setStructure((previous) => previous.filter((item) => item.id !== id));
      addLog('info', "Structure : élément supprimé.");
    },
    [addLog],
  );

  const handleRenameStructureItem = useCallback(
    (id: string, value: string) => {
      setStructure((previous) =>
        previous.map((item) =>
          item.id === id ? { ...item, displayName: value } : item,
        ),
      );
      addLog('info', `Structure : libellé mis à jour (« ${value} »).`);
    },
    [addLog],
  );

  const handleStructureSourceChange = useCallback(
    (id: string, fileName: string) => {
      setStructure((previous) =>
        previous.map((item) =>
          item.id === id ? { ...item, sourceFileName: fileName } : item,
        ),
      );
      addLog(
        'info',
        fileName
          ? `Structure : source liée « ${fileName} ».`
          : "Structure : source retirée.",
      );
    },
    [addLog],
  );

  const handleStructureReorder = useCallback(
    (next: StructureItem[]) => {
      setStructure(next);
      addLog('info', "Structure : ordre réorganisé.");
    },
    [addLog],
  );

  /** Associe le **dossier de travail** du projet (racine) via le sélecteur natif. */
  const handlePickProjectDirectory = useCallback(async () => {
    const directory = await openNativeDirectory("Choisir le dossier du projet");
    if (!directory) {
      return;
    }
    const name = directory.split(/[\\/]/).filter(Boolean).pop() ?? directory;
    sourceHandleRef.current = null;
    setSourceConfig((previous) => ({ ...previous, directory }));
    setProjectFilePath(`${directory}/${PROJECT_FILE_NAME}`);
    const files = await listDirectoryFiles(directory);
    const { chapters, images } = splitSourceFiles(files);
    setChapterFiles(chapters);
    setImageFiles(images);
    addLog('success', `Dossier de travail associé : ${name}`);
  }, [addLog]);

  /** Importe des chapitres (sélecteur natif multi-fichiers, ou glisser-déposer). */
  const handleImportChapters = useCallback(async (paths?: string[]) => {
    const picked =
      paths && paths.length > 0
        ? paths
        : await openNativeFiles(CHAPTER_EXTENSIONS, "Importer des chapitres");
    if (picked.length === 0) {
      return;
    }
    const items: StructureItem[] = picked.map((path) => {
      const base = path.split(/[\\/]/).pop() ?? path;
      const title = base.replace(/\.[^.]+$/, "");
      return {
        id: nextStructureId("chapter"),
        type: "chapter" as const,
        displayName: title || base,
        sourceFileName: base,
      };
    });
    setStructure((previous) => [...previous, ...items]);
    addLog(
      'success',
      `${items.length} chapitre(s) importé(s) dans la table des feuillets.`,
    );
  }, [addLog]);

  const pickSourcesDirectory = useCallback(async () => {
    const { path, files, handle } = await pickDirectoryWithFiles();
    console.log("[sources] dossier « Mes sources » sélectionné :", { path, files });
    if (path) {
      sourceHandleRef.current = handle;
      setSourceConfig((previous) => ({ ...previous, directory: path }));
      const { chapters, images } = splitSourceFiles(files);
      setChapterFiles(chapters);
      setImageFiles(images);
      addLog('success', `Dossier des sources mis à jour : ${path}`);
    }
  }, [addLog]);

  const importIntoFolder = useCallback(
    async (itemId: string) => {
      const result = await importFileIntoFolder(
        sourceHandleRef.current,
        sourceConfig.directory,
      );
      if (!result) {
        return;
      }
      if (result.copied) {
        // Le fichier rejoint le dossier unique ; le moteur de tri décide, selon
        // son extension, du tableau dans lequel il apparaît (chapitres/images).
        const isImage = isImageFile(result.fileName);
        addLog(
          'success',
          `${isImage ? "Illustration" : "Chapitre"} importé dans le projet : ${result.fileName}`,
        );
        const setFiles = isImage ? setImageFiles : setChapterFiles;
        setFiles((previous) =>
          previous.includes(result.fileName)
            ? previous
            : [...previous, result.fileName].sort((a, b) => a.localeCompare(b)),
        );
      } else {
        addLog(
          'warning',
          `Import sans copie (application empaquetée requise) : ${result.fileName}`,
        );
      }
      setStructure((previous) =>
        previous.map((item) =>
          item.id === itemId
            ? { ...item, sourceFileName: result.fileName }
            : item,
        ),
      );
    },
    [sourceConfig.directory, addLog],
  );

  /**
   * **Transition cinématique d'entrée** dans l'atelier (bouton
   * « Entrer dans l'atelier › ») — trois phases enchaînées :
   * 1. impulsion & enfoncement (gérée par le bouton + pulsation thermique du
   *    creuset, 0–150 ms) ;
   * 2. voile d'encre : `isTransitioning` fait disparaître en fondu le médaillon
   *    (page gauche) et le creuset (page droite) sans toucher à la structure du
   *    livre (150–550 ms) ;
   * 3. bascule d'état : onglet **Réglages** activé (premier signet de la tranche),
   *    `isAtelierOpen` posé, les deux feuillets se révèlent (`animate-ink-reveal`,
   *    550–1000 ms).
   */
  const enterAtelier = useCallback(() => {
    if (enteringRef.current) return;
    enteringRef.current = true;
    setIsTransitioning(true);

    window.setTimeout(() => {
      enteringRef.current = false;
      setIsAtelierOpen(true);
      setActiveMenu('reglages');
      setIsTransitioning(false);
    }, ATELIER_TRANSITION_MS);
  }, []);

  /**
   * **Presse d'atelier** (Feuillet X) : cinématique cadencée en trois étapes
   * (~3,5 s), puis tirage séquentiel des formes d'édition retenues.
   */
  const handlePress = useCallback(async () => {
    if (pressingRef.current) {
      return;
    }
    pressingRef.current = true;
    setIsPressing(true);
    setPressDone(false); // nouveau tirage : le sceau d'achevé d'imprimer n'est pas frappé
    addLog('info', "Presse actionnée : encrage des formes au noir d'os.");

    PRESS_STAGES.forEach((_stage, index) => {
      window.setTimeout(
        () => setPressStage(index),
        index === 0 ? 0 : PRESS_STAGES[index - 1].untilMs,
      );
    });

    const selected = EXPORT_FORMS.filter((form) => exportForms[form.id]);
    await new Promise((resolve) => window.setTimeout(resolve, PRESS_TOTAL_MS));

    for (const form of selected) {
      addLog('info', `Tirage de la forme « ${form.label} » (${form.engine}).`);
      await runExport(form.handler);
      await new Promise((resolve) => window.setTimeout(resolve, 400));
    }

    setPressStage(-1);
    setIsPressing(false);
    setPressDone(true); // tirage achevé : frappe solennelle de l'emblème
    pressingRef.current = false;
    addLog(
      'success',
      selected.length > 0
        ? `Tirage achevé avec succès dans les archives (${selected.length} forme${selected.length > 1 ? 's' : ''} tirée${selected.length > 1 ? 's' : ''}).`
        : "Tirage clos : aucune forme d'édition cochée.",
    );
  }, [addLog, exportForms, runExport]);

  /** Dossier de fabrication (destination des livrables). */
  const handlePickExportDirectory = useCallback(async () => {
    const path = await pickDirectory();
    if (!path) {
      return;
    }
    setExportDirectory(path);
    addLog('success', `Dossier de fabrication retenu : ${path}`);
  }, [addLog]);

  /** Ouvre le **dossier des épreuves** (Feuillet X) dans le gestionnaire natif.
      La cible est le dossier de fabrication retenu au Feuillet IX ; sans dossier,
      invite l'utilisateur à en désigner un, puis l'ouvre via la commande Rust
      `open_proofs_directory`. */
  const handleOpenExportDirectory = useCallback(async () => {
    let targetPath: string = exportDirectory ?? "";

    // 1. Aucun dossier retenu : inviter l'utilisateur à en choisir un (annulable).
    if (targetPath === "") {
      const selected = await pickDirectory();
      if (!selected) {
        return; // annulation
      }
      targetPath = selected;
      setExportDirectory(selected);
      addLog("success", `Dossier de fabrication retenu : ${selected}`);
    }

    // 2. Ouverture native (commande Rust dédiée), ou repli navigateur.
    if (isInvokeAvailable()) {
      try {
        await invokeCommand("open_proofs_directory", { path: targetPath });
        addLog("success", `Dossier des épreuves ouvert : ${targetPath}`);
        return;
      } catch (cause) {
        addLog("error", `Ouverture du dossier des épreuves impossible : ${String(cause)}`);
        return;
      }
    }
    if (await openPathExternal(targetPath)) {
      addLog("success", `Dossier des épreuves ouvert : ${targetPath}`);
      return;
    }
    addLog("warning", "Ouverture du dossier impossible hors application de bureau.");
  }, [addLog, exportDirectory]);

  /**
   * **Bus d'événements Tauri** : la progression réelle du moteur Rust
   * (`export-progress`) alimente la jauge du pupitre supérieur, quel que soit
   * l'écran affiché (Feuillets IX & X comme Export direct).
   */
  useEffect(() => {
    let unlisten: (() => void) | null = null;
    let disposed = false;
    void listenEvent<ExportProgressPayload>("export-progress", (payload) => {
      setProgress(Math.min(100, Math.max(0, Math.round(payload.progress))));
      if (payload.step) {
        setProgressLabel(payload.step);
      }
    }).then((off) => {
      if (disposed) {
        off?.();
      } else {
        unlisten = off;
      }
    });
    return () => {
      disposed = true;
      unlisten?.();
      unlisten = null;
    };
  }, []);

  // ───────────────── Correcteur (Feuillets VII & VIII) ─────────────────────
  // L'état partagé vit ici afin que les deux pages du livre (gauche & droite)
  // basculent de concert et travaillent sur le même chapitre.

  /** Charge (ou recharge) un chapitre dans le Correcteur — lecture native du fichier. */
  const handleLoadProofChapter = useCallback(async (file: string) => {
    setProofChapter(file);
    setProofError(null);
    setProofPage(1);
    setActiveAnomalyId(null); // nouveau chapitre : la localisation s'efface
    if (!file) {
      setProofText("");
      return;
    }
    setProofLoading(true);
    try {
      setProofText(await readChapterFile(file));
    } catch (cause) {
      setProofText("");
      setProofError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setProofLoading(false);
    }
  }, []);

  // ───────────────── Écritoire (Feuillets III & IV) ────────────────────────
  const handleLoadWritingChapter = useCallback(async (file: string) => {
    if (writingDirty && writingChapter && writingChapter !== file) {
      try {
        await persistWritingText(writingChapter, writingText);
      } catch (cause) {
        setWritingError(cause instanceof Error ? cause.message : String(cause));
        return;
      }
    }
    const request = ++writingRequestRef.current;
    writingLatestRef.current = { chapter: file, text: "" };
    setWritingChapter(file);
    setWritingError(null);
    setWritingDirty(false);
    setWritingSaveState("idle");
    if (!file) {
      setWritingText("");
      setWritingLoading(false);
      return;
    }
    setWritingLoading(true);
    try {
      await persistCurrentProject();
      const content = await readChapterFile(file);
      if (request === writingRequestRef.current) {
        writingLatestRef.current = { chapter: file, text: content };
        setWritingText(content);
      }
    } catch (cause) {
      if (request === writingRequestRef.current) {
        setWritingText("");
        setWritingError(cause instanceof Error ? cause.message : String(cause));
      }
    } finally {
      if (request === writingRequestRef.current) {
        setWritingLoading(false);
      }
    }
  }, [persistCurrentProject, persistWritingText, writingChapter, writingDirty, writingText]);

  const handleWritingTextChange = useCallback((text: string) => {
    writingLatestRef.current = { chapter: writingLatestRef.current.chapter, text };
    setWritingText(text);
    setWritingDirty(true);
    setWritingSaveState("idle");
  }, []);

  const handleCreateWritingChapter = useCallback(async (name: string) => {
    setWritingError(null);
    try {
      await persistCurrentProject();
      const filename = await createChapterFile(name);
      setChapterFiles((current) =>
        [...new Set([...current, filename])].sort((left, right) => left.localeCompare(right)),
      );
      addLog("success", `Nouveau chapitre créé : ${filename}.`);
      void listNativeChapterFiles().then(setChapterFiles).catch(() => {
        addLog("warning", "Le chapitre est créé, mais la liste n’a pas pu être actualisée.");
      });
      await handleLoadWritingChapter(filename);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      setWritingError(message);
      addLog("error", `Création du chapitre impossible : ${message}`);
    }
  }, [addLog, handleLoadWritingChapter, persistCurrentProject]);

  useEffect(() => {
    if (!writingDirty || !writingChapter || !hydrated) {
      return;
    }
    const chapter = writingChapter;
    const text = writingText;
    const timer = window.setTimeout(() => {
      setWritingSaveState("saving");
      void persistWritingText(chapter, text).then(() => {
        if (writingLatestRef.current.chapter === chapter && writingLatestRef.current.text === text) {
          setWritingDirty(false);
          setWritingSaveState("saved");
        }
      }).catch((cause: unknown) => {
        if (writingLatestRef.current.chapter === chapter && writingLatestRef.current.text === text) {
          setWritingError(cause instanceof Error ? cause.message : String(cause));
          setWritingSaveState("idle");
        }
      });
    }, 650);
    return () => window.clearTimeout(timer);
  }, [hydrated, persistWritingText, writingChapter, writingDirty, writingText]);

  useEffect(() => {
    if (writingChapter === "" && chapterFiles.length > 0 && sourceConfig.directory) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- ouvre le premier chapitre disponible après l’hydratation du dossier source
      void handleLoadWritingChapter(chapterFiles[0]);
    }
  }, [chapterFiles, handleLoadWritingChapter, sourceConfig.directory, writingChapter]);

  /** Bascule le diptyque du Correcteur (VII — Indice de Qualité Typographique / VIII — Banc d'Épreuve). */
  const handleProofTabChange = useCallback((tab: ProofTab) => setProofTab(tab), []);

  /** Active / désactive une règle depuis « Les Règles Analysées » (page droite du Feuillet VII). */
  const handleToggleProofRule = useCallback((ruleId: TypographyRuleId) => {
    setProofEnabledRules((current) =>
      current.includes(ruleId) ? current.filter((id) => id !== ruleId) : [...current, ruleId],
    );
  }, []);

  /** Tourne d'un feuillet : la localisation en cours s'efface (nouveau feuillet). */
  const handleProofPageChange = useCallback(
    (page: number) => {
      setActiveAnomalyId(null);
      setProofPage(page);
    },
    [],
  );

  /** Bascule le filtre « feuillets à anomalies » : la localisation s'efface. */
  const handleProofFilterChange = useCallback(
    (value: boolean) => {
      setActiveAnomalyId(null);
      setProofOnlyAnomalies(value);
    },
    [],
  );

  // Auto-sélection du premier chapitre disponible (pupitre de lecture du banc).
  useEffect(() => {
    if (proofChapter === "" && chapterFiles.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- auto-sélection du premier chapitre (chargement initial)
      void handleLoadProofChapter(chapterFiles[0]);
    }
  }, [proofChapter, chapterFiles, handleLoadProofChapter]);

  /** **Ordre majeur** : impose l'Usage aldin à tout le chapitre et notifie le registre. */
  const handleImposeProofUsage = useCallback(() => {
    if (proofText === "") {
      return;
    }
    const report = analyzeTypography(proofText, proofEnabledRules);
    const before = report.total;
    const { text: next, applied } = applyAldineUsage(proofText, report.anomalies);
    if (applied === 0) {
      addLog("info", "Usage aldin : aucune correction nécessaire.");
      return;
    }
    setProofText(next);
    addLog(
      "success",
      `Usage aldin imposé : ${applied} correction${applied > 1 ? "s" : ""} sur ${
        before > applied ? `${before} anomalies relevées` : "le chapitre"
      }${proofChapter ? ` — ${proofChapter}` : ""}.`,
    );
  }, [proofText, proofEnabledRules, proofChapter, addLog]);

  /** **Consignation au registre** : écriture atomique du chapitre justifié. */
  const handlePersistProofChapter = useCallback(async () => {
    if (!proofChapter) {
      addLog("warning", "Aucun chapitre sélectionné : rien à consigner.");
      return;
    }
    try {
      await writeChapterFile(proofChapter, proofText);
      addLog("success", `Chapitre consigné au registre : ${proofChapter}.`);
    } catch (cause) {
      addLog("error", `Consignation impossible : ${String(cause)}`);
    }
  }, [proofChapter, proofText, addLog]);

  /** **Consignation des retouches du vélin** (Feuillet VIII) : met à jour le texte
      partagé (l'analyse des anomalies est relancée, compteurs de droite recalculés)
      puis écrit le chapitre sur le disque. */
  const handleSaveProofRevisions = useCallback(
    async (next: string) => {
      if (next === proofText) {
        return; // aucune retouche : rien à consigner
      }
      if (proofChapter === "") {
        setProofText(next); // repli mémoire sans fichier
        addLog("warning", "Aucun chapitre sélectionné : retouches gardées en mémoire.");
        return;
      }
      try {
        await writeChapterFile(proofChapter, next);
        setProofText(next);
        addLog("success", `Retouches consignées dans ${proofChapter} — analyse relancée.`);
      } catch (cause) {
        addLog("error", `Consignation impossible : ${String(cause)}`);
      }
    },
    [proofChapter, proofText, addLog],
  );

  /** **Correctif unitaire** : une seule occurrence, depuis les conseils de l'Imprimeur. */
  const handleApplyProofAnomaly = useCallback(
    (anomaly: TypographyAnomaly) => {
      setProofText((current) => applyAnomaly(current, anomaly));
      addLog(
        "success",
        `Usage aldin imposé (ligne ${anomaly.line}) : ${showSpaces(anomaly.found)} → ${showSpaces(anomaly.replacement)}.`,
      );
    },
    [addLog],
  );

  // État applicatif exposé aux pages du livre virtuel (via `StudioContext`).
  const studioValue: StudioContextValue = {
    exportForms,
    onToggleExportForm: (id) =>
      setExportForms((current) => ({ ...current, [id]: !current[id] })),
    exportDirectory,
    onPickExportDirectory: () => {
      void handlePickExportDirectory();
    },
    pressStage,
    isPressing,
    pressDone,
    onPress: () => {
      void handlePress();
    },
    onOpenExportDirectory: () => {
      void handleOpenExportDirectory();
    },
    proofTab,
    onProofTabChange: handleProofTabChange,
    proofEnabledRules,
    onToggleProofRule: handleToggleProofRule,
    proofChapter,
    proofText,
    proofLoading,
    proofError,
    loadProofChapter: (file: string) => handleLoadProofChapter(file),
    proofPage,
    setProofPage: handleProofPageChange,
    proofOnlyAnomalies,
    setProofOnlyAnomalies: handleProofFilterChange,
    applyProofAnomaly: handleApplyProofAnomaly,
    activeAnomalyId,
    setActiveAnomalyId,
    imposeProofUsage: handleImposeProofUsage,
    persistProofChapter: () => handlePersistProofChapter(),
    saveProofRevisions: (next: string) => handleSaveProofRevisions(next),
    writingChapter,
    writingText,
    writingLoading,
    writingError,
    writingSaveState,
    loadWritingChapter: handleLoadWritingChapter,
    onWritingTextChange: handleWritingTextChange,
    createWritingChapter: handleCreateWritingChapter,
    isAtelierOpen,
    isTransitioning,
    onEnterAtelier: enterAtelier,
    onNotify: addLog,
    manuscriptConfig,
    sourceConfig,
    errorLogConfig,
    onTrimChange: handleTrimChange,
    onLayoutChange: handleLayoutChange,
    onSourcesDirectoryChange: handleSourcesDirectoryChange,
    onImageColorModeChange: handleImageColorModeChange,
    onLogLevelChange: handleLogLevelChange,
    onLogDirectoryChange: handleLogDirectoryChange,
    onOpenLog: handleOpenLog,
    bookInfo,
    onInfoFieldChange: handleInfoFieldChange,
    structure,
    chapterFiles,
    imageFiles,
    sourcesConfigured: sourceConfig.directory !== null,
    onAddAct: handleAddAct,
    onAddChapter: handleAddChapter,
    onAddImage: handleAddImage,
    onAddSpecial: handleAddSpecialPage,
    onRemoveStructureItem: handleRemoveStructureItem,
    onRenameStructureItem: handleRenameStructureItem,
    onSpecialRoleChange: handleSpecialRoleChange,
    onStructureSourceChange: handleStructureSourceChange,
    onStructureReorder: handleStructureReorder,
    onPickSourcesDirectory: pickSourcesDirectory,
    onImportIntoFolder: (id: string) => {
      void importIntoFolder(id);
    },
    onExport: runExport,
    onPreview: handlePreview,
    cover,
    onCoverChange: handleCoverChange,
    structureSignature,
    coverExportRequest,
    onRequestCoverExport: () => setCoverExportRequest((current) => current + 1),
    isExporting: running,
    onQuit: handleQuit,
    projectDirectory: sourceConfig.directory,
    onPickProjectDirectory: () => {
      void handlePickProjectDirectory();
    },
    onImportChapters: (paths?: string[]) => {
      void handleImportChapters(paths);
    },
  };

  const activeIndex = Math.max(0, MENU_ORDER.indexOf(activeMenu));

  return (
    <>
      <StudioProvider value={studioValue}>
        <Layout
          leftContent={
            <LeftPage
              activeMenu={activeMenu}
              setActiveMenu={setActiveMenu}
              onExitApp={handleQuit}
            />
          }
          bookPages={BOOK_PAGES}
          activeIndex={activeIndex}
          progress={progress}
          progressLabel={progressLabel}
          running={running}
          logs={logs}
          saveState={saveState}
          closing={isClosing}
        />
      </StudioProvider>
      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}
      {previewPayload !== null && (
        <PreviewFlipbook
          payload={previewPayload}
          onClose={() => setPreviewPayload(null)}
        />
      )}
    </>
  );
};

export default App;

