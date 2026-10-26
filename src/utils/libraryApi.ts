import { convertFileSrc } from "@tauri-apps/api/core";
import type { AudioChapterChoice, AudioConfig, AudioGenerationProgress, AudioInitProgressPayload, AudioVoice, Book, ChapterAdaptation, LibraryConfig, PodcastLine, ScannedBook, Shelf, ShelfId, UpdateStatus, VoiceCasting } from "../types";
import { invokeCommand, isInvokeAvailable, listenEvent } from "./tauri";

const STORAGE_KEY = "aldus-library";

const baseName = (path: string): string => (path.split(/[\\/]/).pop() ?? "").replace(/\.[^.]+$/, "").replace(/_/g, " ").replace(/\s+/g, " ").trim().toLocaleLowerCase("fr");

const mergeBrowserBook = (config: LibraryConfig, incoming: Book): void => {
  const names = new Set((incoming.files ?? []).map((file) => baseName(file.path)));
  const existing = config.books.find((book) => book.id === incoming.id || book.files?.some((file) => names.has(baseName(file.path))));
  if (!existing) {
    config.books.push(incoming);
    return;
  }
  existing.files = [...(existing.files ?? [])];
  for (const file of incoming.files ?? []) {
    if (!existing.files.some((known) => known.path === file.path)) existing.files.push(file);
  }
  existing.fileStatistics = { ...incoming.fileStatistics, ...existing.fileStatistics };
  existing.coverPath ??= incoming.coverPath;
  existing.sourceDirectory ??= incoming.sourceDirectory;
  existing.tome ??= incoming.tome;
};

export const scanExportFolder = async (exportDirectory: string): Promise<ScannedBook[]> => {
  if (!isInvokeAvailable()) throw new Error("Le scan du dossier d'export nécessite l'application Aldus de bureau.");
  return invokeCommand<ScannedBook[]>("scan_export_folder", { exportDirectory });
};

export const openLibraryResource = async (bookId: string, resource: string): Promise<void> => {
  if (!isInvokeAvailable()) throw new Error("L'ouverture des fichiers locaux nécessite l'application Aldus de bureau.");
  return invokeCommand<void>("open_library_resource", { bookId, resource });
};

export const checkForUpdates = (force = false): Promise<UpdateStatus> =>
  invokeCommand<UpdateStatus>("check_for_updates", { force });

export const openExternalUrl = (url: string): Promise<void> =>
  invokeCommand<void>("open_external", { url });

export const libraryCoverUrl = (path: string): string | undefined => {
  if (/^(https?:|data:image\/|blob:)/i.test(path)) return path;
  return isInvokeAvailable() ? convertFileSrc(path) : undefined;
};

const defaultConfig = (): LibraryConfig => ({
  shelves: [
    { id: "in_progress", label: "En cours", isCustom: false, isVisible: true },
    { id: "completed", label: "Terminés", isCustom: false, isVisible: true },
  ],
  books: [],
});

const readBrowserConfig = (): LibraryConfig => {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return defaultConfig();
  const config = JSON.parse(stored) as LibraryConfig;
  config.shelves = [
    ...defaultConfig().shelves,
    ...config.shelves
      .filter((shelf) => !["in_progress", "completed", "archived"].includes(shelf.id))
      .filter((shelf) => shelf.isVisible || config.books.some((book) => book.shelfId === shelf.id))
      .map((shelf) => ({ ...shelf, isCustom: true, isVisible: true })),
  ];
  config.books = config.books.map((book) => ({
    ...book,
    chapterCount: book.chapterCount ?? 0,
    chapterCountAvailable: book.chapterCountAvailable ?? (book.chapterCount != null),
    shelfId: book.shelfId === "archived" ? "completed"
      : config.shelves.some((shelf) => shelf.id === book.shelfId) ? book.shelfId : "in_progress",
  }));
  const books = config.books;
  config.books = [];
  books.forEach((book) => mergeBrowserBook(config, book));
  return saveBrowserConfig(config);
};

const saveBrowserConfig = (config: LibraryConfig): LibraryConfig => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  return config;
};

export const getLibraryConfig = async (): Promise<LibraryConfig> =>
  isInvokeAvailable()
    ? invokeCommand<LibraryConfig>("get_library_config")
    : Promise.resolve(readBrowserConfig());

export const createCustomShelf = async (label: string): Promise<LibraryConfig> => {
  const id = `custom_${crypto.randomUUID()}`;
  if (!label.trim()) throw new Error("Le nom du rayon ne peut pas être vide.");
  if (isInvokeAvailable()) {
    return invokeCommand<LibraryConfig>("create_custom_shelf", { id, label });
  }
  const config = readBrowserConfig();
  config.shelves.push({ id, label: label.trim(), isCustom: true, isVisible: true });
  return saveBrowserConfig(config);
};

export const deleteCustomShelf = async (id: ShelfId): Promise<LibraryConfig> => {
  if (isInvokeAvailable()) {
    return invokeCommand<LibraryConfig>("delete_custom_shelf", { id });
  }
  const config = readBrowserConfig();
  if (!config.shelves.some((shelf) => shelf.id === id && shelf.isCustom)) {
    throw new Error("Rayon personnalisé inconnu.");
  }
  config.shelves = config.shelves.filter((shelf) => shelf.id !== id);
  config.books = config.books.map((book) => book.shelfId === id ? { ...book, shelfId: "in_progress" } : book);
  return saveBrowserConfig(config);
};

export const updateCustomShelf = async (shelf: Shelf): Promise<LibraryConfig> => {
  if (!shelf.label.trim()) throw new Error("Le nom du rayon ne peut pas être vide.");
  if (isInvokeAvailable()) {
    return invokeCommand<LibraryConfig>("update_custom_shelf", {
      id: shelf.id,
      label: shelf.label,
      isVisible: shelf.isVisible,
    });
  }
  const config = readBrowserConfig();
  if (!config.shelves.some((item) => item.id === shelf.id && item.isCustom)) {
    throw new Error("Rayon personnalisé inconnu.");
  }
  config.shelves = config.shelves.map((item) => item.id === shelf.id ? { ...item, label: shelf.label.trim() } : item);
  return saveBrowserConfig(config);
};

export const moveLibraryBook = async (
  bookId: string,
  newShelfId: ShelfId,
): Promise<LibraryConfig> => {
  if (isInvokeAvailable()) {
    return invokeCommand<LibraryConfig>("move_book", { bookId, newShelfId });
  }
  const config = readBrowserConfig();
  config.books = config.books.map((book) =>
    book.id === bookId ? { ...book, shelfId: newShelfId } : book,
  );
  return saveBrowserConfig(config);
};

export const addLibraryBook = async (input: Omit<Book, "chapterCount"> & { chapterCount?: number }): Promise<LibraryConfig> => {
  const book: Book = { ...input, chapterCount: input.chapterCount ?? 0, chapterCountAvailable: input.chapterCountAvailable ?? (input.chapterCount != null) };
  if (isInvokeAvailable()) {
    return invokeCommand<LibraryConfig>("add_library_book", { book });
  }
  const config = readBrowserConfig();
  mergeBrowserBook(config, book);
  return saveBrowserConfig(config);
};

export const deleteLibraryBook = async (
  bookId: string,
  exportDirectory?: string,
): Promise<LibraryConfig> => {
  if (!isInvokeAvailable()) throw new Error("La suppression définitive des fichiers nécessite l'application Aldus de bureau.");
  return invokeCommand<LibraryConfig>("delete_book", { bookId, exportDirectory: exportDirectory ?? null });
};

export const deleteLibraryAudioTrack = async (
  bookId: string,
  chapterIndex: number,
  exportDirectory?: string,
): Promise<LibraryConfig> => {
  if (!isInvokeAvailable()) throw new Error("La suppression des pistes audio nécessite l'application Aldus de bureau.");
  return invokeCommand<LibraryConfig>("delete_audio_track", { bookId, chapterIndex, exportDirectory: exportDirectory ?? null });
};

export const exportLibraryAudioTrack = async (
  sourcePath: string,
  targetPath: string,
): Promise<void> => {
  if (!isInvokeAvailable()) throw new Error("L'exportation de pistes audio nécessite l'application Aldus de bureau.");
  return invokeCommand<void>("export_audio_file", { sourcePath, targetPath });
};

export const saveVoiceCasting = async (bookId: string, casting: VoiceCasting): Promise<LibraryConfig> => {
  if (isInvokeAvailable()) return invokeCommand<LibraryConfig>("save_voice_casting", { bookId, casting });
  const config = readBrowserConfig();
  const book = config.books.find((candidate) => candidate.id === bookId);
  if (!book) throw new Error("Ouvrage introuvable dans la bibliothèque.");
  const stamped = { ...casting, updatedAt: Date.now() };
  book.audio = book.audio ? { ...book.audio, casting: stamped } : { engine: "", voiceId: "", voiceName: "", generatedAt: 0, chapters: [], casting: stamped };
  return saveBrowserConfig(config);
};

export const saveChapterAdaptation = async (bookId: string, adaptation: ChapterAdaptation): Promise<LibraryConfig> => {
  if (isInvokeAvailable()) return invokeCommand<LibraryConfig>("save_chapter_adaptation", { bookId, adaptation });
  const config = readBrowserConfig();
  const book = config.books.find((candidate) => candidate.id === bookId);
  if (!book) throw new Error("Ouvrage introuvable dans la bibliothèque.");
  const edition = book.audio ?? { engine: "", voiceId: "", voiceName: "", generatedAt: 0, chapters: [] };
  const others = (edition.adaptations ?? []).filter((saved) => saved.chapterIndex !== adaptation.chapterIndex);
  const pristine = !adaptation.transcribed && adaptation.edits.length === 0 && adaptation.rules.every((rule) => !rule.enabled && !rule.substitutions?.length);
  book.audio = { ...edition, adaptations: pristine ? others : [...others, { ...adaptation, updatedAt: Date.now() }].sort((a, b) => a.chapterIndex - b.chapterIndex) };
  return saveBrowserConfig(config);
};

export const previewVoice = (voiceId: string, text: string): Promise<string> =>
  invokeCommand<string>("preview_voice", { voiceId, text });

export const listAudioVoices = (): Promise<AudioVoice[]> =>
  invokeCommand<AudioVoice[]>("list_audio_voices");

export const getAudioConsent = (): Promise<AudioConfig> =>
  invokeCommand<AudioConfig>("get_audio_consent");

export const saveAudioConsent = (accepted: boolean): Promise<AudioConfig> =>
  invokeCommand<AudioConfig>("save_audio_consent", { accepted });

export const startAudioEngine = (): Promise<AudioVoice[]> =>
  invokeCommand<AudioVoice[]>("start_audio_engine");

export const listenAudioInitProgress = (
  handler: (progress: AudioInitProgressPayload) => void,
): Promise<(() => void) | null> => listenEvent<AudioInitProgressPayload>("audio:init-progress", handler);

export const listBookAudioChapters = (bookId: string): Promise<AudioChapterChoice[]> =>
  invokeCommand<AudioChapterChoice[]>("list_book_audio_chapters", { bookId });

export const getBookChapterText = (bookId: string, chapterIndex: number): Promise<string> =>
  invokeCommand<string>("get_book_chapter_text", { bookId, chapterIndex });

export const generateLibraryAudio = async (
  bookId: string,
  exportDirectory: string,
  voiceId: string,
  chapterIndex: number,
  onProgress: (progress: AudioGenerationProgress) => void,
  script?: Pick<PodcastLine, "role" | "kind" | "text">[],
): Promise<LibraryConfig> => {
  const unlisten = await listenEvent<AudioGenerationProgress>("audio-generation-progress", (progress) => {
    if (progress.bookId === bookId) onProgress(progress);
  });
  try {
    return await invokeCommand<LibraryConfig>("generate_book_audio", { bookId, exportDirectory, voiceId, chapterIndex, script });
  } finally {
    unlisten?.();
  }
};