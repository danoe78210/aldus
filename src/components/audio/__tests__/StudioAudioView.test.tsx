import { afterEach, beforeEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { StudioAudioView } from "../StudioAudioView";
import type { AudioVoice } from "../../../types";
import { addLibraryBook, deleteLibraryAudioTrack, generateLibraryAudio, getAudioConsent, getLibraryConfig, listAudioVoices, listenAudioInitProgress, libraryCoverUrl, listBookAudioChapters, previewVoice, saveAudioConsent, startAudioEngine } from "../../../utils/libraryApi";

vi.mock("../../../utils/libraryApi", async (importOriginal) => ({
  ...await importOriginal<typeof import("../../../utils/libraryApi")>(),
  deleteLibraryAudioTrack: vi.fn(),
  getAudioConsent: vi.fn(),
  listAudioVoices: vi.fn(),
  listenAudioInitProgress: vi.fn().mockResolvedValue(null),
  libraryCoverUrl: vi.fn(),
  listBookAudioChapters: vi.fn(),
  previewVoice: vi.fn(),
  saveAudioConsent: vi.fn(),
  startAudioEngine: vi.fn(),
  generateLibraryAudio: vi.fn(),
}));

const NARRATOR: AudioVoice = { id: "fr-narrator", name: "Narrateur français", language: "fr-FR" };
const SETUP = "Assistant de mise en route XTTS v2";

beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value() { this.setAttribute("open", ""); } });
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value() { this.removeAttribute("open"); } });
});

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  vi.mocked(libraryCoverUrl).mockImplementation((path) => `asset://${path}`);
  vi.mocked(deleteLibraryAudioTrack).mockReset();
  vi.mocked(generateLibraryAudio).mockReset();
  vi.mocked(getAudioConsent).mockResolvedValue({ cpml_accepted: false, cpml_accepted_at: null, engine_mode: "external" });
  vi.mocked(listAudioVoices).mockResolvedValue([NARRATOR]);
  vi.mocked(saveAudioConsent).mockResolvedValue({ cpml_accepted: true, cpml_accepted_at: "2026-10-18T10:45:00Z", engine_mode: "integrated" });
  vi.mocked(startAudioEngine).mockResolvedValue([NARRATOR]);
  vi.mocked(listBookAudioChapters).mockResolvedValue([
    { index: 1, title: "Chapitre premier", wordCount: 250, pageCount: 1, estimatedDurationSeconds: 111 },
    { index: 2, title: "Chapitre second", wordCount: 500, pageCount: 2, estimatedDurationSeconds: 222 },
  ]);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const audioEdition = (chapters: { index: number; title: string; path: string }[]) => ({
  engine: "http://127.0.0.1:8020", voiceId: "fr-narrator", voiceName: "Narrateur français", generatedAt: 1, chapters,
});

describe("StudioAudioView", () => {
  it("lists the chapters of the register's book and generates one chapter with a live timeline", async () => {
    await addLibraryBook({ id: "spoken-book", title: "Le Roman parlé", shelfId: "completed", files: [{ path: "C:/Exports/roman.docx", format: "docx" }] });
    vi.mocked(generateLibraryAudio).mockImplementation(async (bookId, exportDirectory, voiceId, chapterIndex, onProgress) => {
      expect([bookId, exportDirectory, voiceId, chapterIndex]).toEqual(["spoken-book", "C:/Exports", "fr-narrator", 1]);
      onProgress({ bookId, chapterIndex: 1, chapterCount: 2, chapterTitle: "Chapitre premier", progress: 45, status: "Synthèse en cours", segmentIndex: 3, segmentCount: 7 });
      const config = await getLibraryConfig();
      config.books[0].audio = audioEdition([{ index: 1, title: "Chapitre premier", path: "C:/Exports/Audio/roman/001.mp3" }]);
      localStorage.setItem("aldus-library", JSON.stringify(config));
      await new Promise((resolve) => setTimeout(resolve, 20));
      return config;
    });
    render(<StudioAudioView exportDirectory="C:/Exports" />);
    await screen.findByRole("option", { name: "Narrateur français · fr-FR" });
    expect(listAudioVoices).toHaveBeenCalled();
    fireEvent.click(await screen.findByRole("button", { name: "Générer le chapitre 1" }));
    const bar = await screen.findByRole("progressbar", { name: "Progression du chapitre 1" });
    expect(bar.getAttribute("aria-valuenow")).toBe("45");
    expect(screen.getByText("Segment 3/7")).toBeTruthy();
    await screen.findByLabelText("Écouter Chapitre premier");
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(screen.getByText(/Édition audio · Narrateur français · 1 piste/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Régénérer le chapitre 1" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Générer le chapitre 2" })).toBeTruthy();
  });

  it("regenerates one chapter without replacing other audio tracks", async () => {
    await addLibraryBook({
      id: "incremental-book", title: "Le Roman incrémental", shelfId: "in_progress", files: [{ path: "C:/Exports/incremental.epub", format: "epub" }],
      audio: audioEdition([
        { index: 1, title: "Chapitre premier", path: "C:/Exports/Audio/old/001.mp3" },
        { index: 2, title: "Chapitre second", path: "C:/Exports/Audio/old/002.mp3" },
      ]),
    });
    vi.mocked(generateLibraryAudio).mockImplementation(async (bookId) => {
      const config = await getLibraryConfig();
      const book = config.books.find((item) => item.id === bookId)!;
      book.audio!.chapters = book.audio!.chapters.map((chapter) => chapter.index === 2 ? { ...chapter, path: "C:/Exports/Audio/new/002.mp3" } : chapter);
      localStorage.setItem("aldus-library", JSON.stringify(config));
      return config;
    });
    render(<StudioAudioView exportDirectory="C:/Exports" />);
    await screen.findByRole("option", { name: "Narrateur français · fr-FR" });
    fireEvent.click(await screen.findByRole("button", { name: "Régénérer le chapitre 2" }));
    await waitFor(() => expect((screen.getByRole("button", { name: "Régénérer le chapitre 2" }) as HTMLButtonElement).disabled).toBe(false));
    expect(generateLibraryAudio).toHaveBeenCalledExactlyOnceWith("incremental-book", "C:/Exports", "fr-narrator", 2, expect.any(Function));
    expect(screen.getByLabelText("Écouter Chapitre premier")).toBeTruthy();
    expect((await getLibraryConfig()).books[0].audio?.chapters.map((chapter) => chapter.path)).toEqual(["C:/Exports/Audio/old/001.mp3", "C:/Exports/Audio/new/002.mp3"]);
  });

  it("shows the exact local-engine notice, the setup assistant and blocks generation without a voice", async () => {
    await addLibraryBook({ id: "offline-audio", title: "Voix absente", shelfId: "in_progress", files: [{ path: "C:/Exports/offline.epub", format: "epub" }] });
    vi.mocked(listAudioVoices).mockResolvedValueOnce([]);
    render(<StudioAudioView exportDirectory="C:/Exports" />);
    expect(await screen.findAllByText("Le moteur vocal local est inactif. Veuillez lancer le wrapper TTS sur le port 8020 ou configurer ALDUS_TTS_URL.")).not.toHaveLength(0);
    expect(screen.getByRole("region", { name: "Console du moteur vocal" }).textContent).toContain("Moteur inactif");
    const setup = await screen.findByRole("dialog", { name: SETUP });
    expect(setup.textContent).toContain("Moteur local externe");
    expect(within(setup).queryByRole("checkbox")).toBeNull();
    expect((await screen.findByRole("button", { name: "Générer le chapitre 1" }) as HTMLButtonElement).disabled).toBe(true);
    expect(generateLibraryAudio).not.toHaveBeenCalled();
    fireEvent.click(within(setup).getByRole("button", { name: "Vérifier le moteur externe" }));
    await screen.findByRole("option", { name: "Narrateur français · fr-FR" });
    expect(screen.queryByRole("dialog", { name: SETUP })).toBeNull();
    expect(screen.getByRole("region", { name: "Console du moteur vocal" }).textContent).toContain("Moteur prêt");
    expect((screen.getByRole("button", { name: "Générer le chapitre 1" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("shows live voice loading progress while profiles are being fetched", async () => {
    vi.mocked(listenAudioInitProgress).mockImplementationOnce(async (handler) => {
      handler({ percent: 35, stage: "Import PyTorch", isReady: false });
      return null;
    });
    let finish: ((voices: AudioVoice[]) => void) | undefined;
    vi.mocked(listAudioVoices).mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    render(<StudioAudioView exportDirectory="C:/Exports" />);
    await screen.findByRole("option", { name: "Chargement des profils vocaux (35%)..." });
    finish?.([NARRATOR]);
    await screen.findByRole("option", { name: "Narrateur français · fr-FR" });
  });

  it("cancels CPML onboarding without persisting consent and reopens the assistant unchecked", async () => {
    vi.mocked(getAudioConsent).mockResolvedValueOnce({ cpml_accepted: false, cpml_accepted_at: null, engine_mode: "integrated" });
    render(<StudioAudioView exportDirectory="C:/Exports" />);
    const dialog = await screen.findByRole("dialog", { name: SETUP });
    fireEvent.click(within(dialog).getByRole("checkbox"));
    fireEvent.click(within(dialog).getByRole("button", { name: "Annuler" }));
    expect(saveAudioConsent).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog", { name: SETUP })).toBeNull();
    fireEvent.click(within(screen.getByRole("region", { name: "Console du moteur vocal" })).getByRole("button", { name: "Ouvrir l’assistant" }));
    const reopened = await screen.findByRole("dialog", { name: SETUP });
    expect((within(reopened).getByRole("checkbox") as HTMLInputElement).checked).toBe(false);
  });

  it("persists CPML consent before starting the integrated engine", async () => {
    vi.mocked(getAudioConsent).mockResolvedValueOnce({ cpml_accepted: false, cpml_accepted_at: null, engine_mode: "integrated" });
    let resolveConsent!: (config: Awaited<ReturnType<typeof getAudioConsent>>) => void;
    vi.mocked(saveAudioConsent).mockImplementationOnce(() => new Promise((resolve) => { resolveConsent = resolve; }));
    render(<StudioAudioView exportDirectory="C:/Exports" />);
    const dialog = await screen.findByRole("dialog", { name: SETUP });
    fireEvent.click(within(dialog).getByRole("checkbox"));
    fireEvent.click(within(dialog).getByRole("button", { name: "ACCEPTER ET DÉMARRER" }));
    expect(screen.queryByRole("dialog", { name: SETUP })).toBeNull();
    expect(startAudioEngine).not.toHaveBeenCalled();
    resolveConsent({ cpml_accepted: true, cpml_accepted_at: "2026-10-18T10:45:00Z", engine_mode: "integrated" });
    await screen.findByRole("option", { name: "Narrateur français · fr-FR" });
    expect(saveAudioConsent).toHaveBeenCalledWith(true);
    expect(startAudioEngine).toHaveBeenCalledOnce();
    expect(vi.mocked(saveAudioConsent).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(startAudioEngine).mock.invocationCallOrder[0]);
  });

  it("starts the integrated engine automatically when CPML consent is already stored", async () => {
    vi.mocked(getAudioConsent).mockResolvedValueOnce({ cpml_accepted: true, cpml_accepted_at: "2026-10-18T10:45:00Z", engine_mode: "integrated" });
    render(<StudioAudioView exportDirectory="C:/Exports" />);
    await screen.findByRole("option", { name: "Narrateur français · fr-FR" });
    expect(startAudioEngine).toHaveBeenCalledOnce();
    expect(saveAudioConsent).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog", { name: SETUP })).toBeNull();
  });

  it("shows chapter estimates and removes only the selected audio track", async () => {
    await addLibraryBook({
      id: "chapter-metadata", title: "Métriques audio", shelfId: "in_progress", files: [{ path: "C:/Exports/metriques.epub", format: "epub" }],
      audio: audioEdition([
        { index: 1, title: "Chapitre premier", path: "C:/Exports/Audio/book/001.mp3" },
        { index: 2, title: "Chapitre second", path: "C:/Exports/Audio/book/002.mp3" },
      ]),
    });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    vi.mocked(deleteLibraryAudioTrack).mockImplementation(async (bookId, chapterIndex) => {
      const config = await getLibraryConfig();
      const book = config.books.find((item) => item.id === bookId)!;
      book.audio!.chapters = book.audio!.chapters.filter((chapter) => chapter.index !== chapterIndex);
      localStorage.setItem("aldus-library", JSON.stringify(config));
      return config;
    });
    render(<StudioAudioView exportDirectory="C:/Exports" />);
    expect(await screen.findByText("1 page(s) estimée(s) · 250 mots · ~1 min 51 s")).toBeTruthy();
    expect(screen.getByText("2 page(s) estimée(s) · 500 mots · ~3 min 42 s")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Supprimer la piste audio Chapitre second" }));
    await waitFor(() => expect(deleteLibraryAudioTrack).toHaveBeenCalledWith("chapter-metadata", 2, "C:/Exports"));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Lire Chapitre second" })).toBeNull());
    expect(screen.getByRole("button", { name: "Lire Chapitre premier" })).toBeTruthy();
  });

  it("explains that an export folder is required before generation", async () => {
    await addLibraryBook({ id: "needs-export", title: "Dossier manquant", shelfId: "in_progress", files: [{ path: "C:/Sources/livre.epub", format: "epub" }] });
    render(<StudioAudioView />);
    await screen.findByRole("option", { name: "Narrateur français · fr-FR" });
    expect((await screen.findByRole("button", { name: "Générer le chapitre 1" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/Choisissez un dossier d’export dans Export → Inspection Pré-Presse → Parcourir les archives/)).toBeTruthy();
    expect(generateLibraryAudio).not.toHaveBeenCalled();
  });

  it("locks every generate button and the selectors while a chapter is being forged", async () => {
    await addLibraryBook({ id: "busy-audio", title: "En cours", shelfId: "in_progress", files: [{ path: "C:/Exports/busy.epub", format: "epub" }] });
    let resolveGeneration!: (config: Awaited<ReturnType<typeof getLibraryConfig>>) => void;
    vi.mocked(generateLibraryAudio).mockImplementation(() => new Promise((resolve) => { resolveGeneration = resolve; }));
    render(<StudioAudioView exportDirectory="C:/Exports" />);
    await screen.findByRole("option", { name: "Narrateur français · fr-FR" });
    fireEvent.click(await screen.findByRole("button", { name: "Générer le chapitre 1" }));
    await waitFor(() => expect((screen.getByRole("button", { name: "Générer le chapitre 1" }) as HTMLButtonElement).disabled).toBe(true));
    expect((screen.getByRole("button", { name: "Générer le chapitre 2" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("button", { name: "Générer le chapitre 1" }).className).toContain("animate-pulse");
    expect((screen.getByRole("combobox", { name: "Profil de voix" }) as HTMLSelectElement).disabled).toBe(true);
    expect((screen.getByRole("combobox", { name: "Livre à enregistrer" }) as HTMLSelectElement).disabled).toBe(true);
    resolveGeneration(await getLibraryConfig());
    await waitFor(() => expect((screen.getByRole("button", { name: "Générer le chapitre 2" }) as HTMLButtonElement).disabled).toBe(false));
  });

  it("sépare Le Chœur et Le Studio en deux onglets", async () => {
    render(<StudioAudioView exportDirectory="C:/Exports" />);
    expect(screen.getByRole("tab", { name: "Le Chœur" }).getAttribute("aria-selected")).toBe("true");
    fireEvent.click(screen.getByRole("tab", { name: "Le Studio" }));
    expect(screen.getByRole("tab", { name: "Le Studio" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tab", { name: "Le Chœur" }).getAttribute("aria-selected")).toBe("false");
    await screen.findByRole("option", { name: "Narrateur français · fr-FR" });
  });

  it("auditions a voice with the witness phrase through the local engine", async () => {
    const play = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("Audio", vi.fn(function (this: { play: typeof play; pause: () => void }) { this.play = play; this.pause = vi.fn(); }));
    vi.mocked(previewVoice).mockResolvedValue("C:/Data/voice-previews/fr-narrator.mp3");
    render(<StudioAudioView exportDirectory="C:/Exports" />);
    fireEvent.click(await screen.findByRole("button", { name: "Écouter la voix Narrateur français" }));
    await waitFor(() => expect(play).toHaveBeenCalledOnce());
    expect(previewVoice).toHaveBeenCalledWith("fr-narrator", "D'or et d'encre, Aldus prête voix aux feuillets silencieux.");
    expect(Audio).toHaveBeenCalledWith("asset://C:/Data/voice-previews/fr-narrator.mp3");
    vi.unstubAllGlobals();
  });

  it("reports a preview failure instead of failing silently", async () => {
    vi.mocked(previewVoice).mockRejectedValue("Le moteur TTS a refusé la pré-écoute (HTTP 500).");
    render(<StudioAudioView exportDirectory="C:/Exports" />);
    fireEvent.click(await screen.findByRole("button", { name: "Écouter la voix Narrateur français" }));
    expect((await screen.findByRole("alert")).textContent).toContain("refusé la pré-écoute");
  });

  it("composes the casting per book: narrator, default dialogues and manual characters", async () => {
    await addLibraryBook({ id: "casting-book", title: "Le Roman choral", shelfId: "in_progress", files: [{ path: "C:/Exports/choral.epub", format: "epub" }] });
    render(<StudioAudioView exportDirectory="C:/Exports" />);
    const narrator = await screen.findByRole("combobox", { name: "Voix du rôle Narrateur" }) as HTMLSelectElement;
    await screen.findByRole("option", { name: "Narrateur français · fr-FR" });
    fireEvent.change(narrator, { target: { value: "fr-narrator" } });
    await waitFor(() => expect((screen.getByRole("combobox", { name: "Voix du rôle Narrateur" }) as HTMLSelectElement).value).toBe("fr-narrator"));
    fireEvent.change(screen.getByRole("textbox", { name: "Nom du personnage" }), { target: { value: "Élise" } });
    fireEvent.click(screen.getByRole("button", { name: "Ajouter" }));
    await screen.findByRole("combobox", { name: "Voix du personnage Élise" });
    expect((await getLibraryConfig()).books[0].audio?.casting?.mappings).toEqual([
      { role: "Narrateur", kind: "narrator", voiceId: "fr-narrator" },
      { role: "Élise", kind: "character", voiceId: "fr-narrator" },
    ]);
    fireEvent.click(screen.getByRole("button", { name: "Retirer le personnage Élise" }));
    await waitFor(() => expect(screen.queryByRole("combobox", { name: "Voix du personnage Élise" })).toBeNull());
    expect(screen.queryByText(/Édition audio/)).toBeNull();
  });

  it("invites the author to add a book when the register is empty", async () => {
    render(<StudioAudioView exportDirectory="C:/Exports" />);
    expect(await screen.findByText(/Aucun livre au Registre/)).toBeTruthy();
    expect(listBookAudioChapters).not.toHaveBeenCalled();
  });
});
