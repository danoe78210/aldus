import { afterEach, beforeEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { StudioAudioView } from "../StudioAudioView";
import type { AudioChapter, AudioVoice } from "../../../types";
import { addLibraryBook, deleteLibraryAudioTrack, generateLibraryAudio, getAudioConsent, getBookChapterText, getLibraryConfig, listAudioVoices, listenAudioInitProgress, libraryCoverUrl, listBookAudioChapters, previewVoice, saveAudioConsent, startAudioEngine } from "../../../utils/libraryApi";

vi.mock("../../../utils/libraryApi", async (importOriginal) => ({
  ...await importOriginal<typeof import("../../../utils/libraryApi")>(),
  deleteLibraryAudioTrack: vi.fn(),
  getAudioConsent: vi.fn(),
  getBookChapterText: vi.fn(),
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
  vi.mocked(getBookChapterText).mockResolvedValue("");
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

const audioEdition = (chapters: Pick<AudioChapter, "index" | "title" | "path" | "burn">[]) => ({
  engine: "http://127.0.0.1:8020", voiceId: "fr-narrator", voiceName: "Narrateur français", generatedAt: 1, chapters,
});

const transcribe = async () => fireEvent.click(await screen.findByRole("button", { name: "Transcrire en script podcast" }));

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
    await screen.findByRole("button", { name: "Écouter la voix Narrateur français" });
    expect(listAudioVoices).toHaveBeenCalled();
    fireEvent.click(await screen.findByRole("button", { name: "Générer le chapitre 1" }));
    const bar = await screen.findByRole("progressbar", { name: "Progression du chapitre 1" });
    expect(bar.getAttribute("aria-valuenow")).toBe("45");
    expect(screen.getByText("Segment 3/7")).toBeTruthy();
    await screen.findByLabelText("Écouter Chapitre premier");
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(screen.getByText("Disque du livre · Voix maîtresse : Narrateur français · 1 piste gravée")).toBeTruthy();
    expect(screen.getByText("Gravée sur le disque")).toBeTruthy();
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
    await screen.findByRole("button", { name: "Écouter la voix Narrateur français" });
    fireEvent.click(await screen.findByRole("button", { name: "Régénérer le chapitre 2" }));
    await waitFor(() => expect((screen.getByRole("button", { name: "Régénérer le chapitre 2" }) as HTMLButtonElement).disabled).toBe(false));
    expect(generateLibraryAudio).toHaveBeenCalledExactlyOnceWith("incremental-book", "C:/Exports", "fr-narrator", 2, expect.any(Function), undefined);
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
    await screen.findByRole("button", { name: "Écouter la voix Narrateur français" });
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
    await screen.findByText("Initialisation du moteur (35 %)…");
    finish?.([NARRATOR]);
    await screen.findByRole("button", { name: "Écouter la voix Narrateur français" });
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
    await screen.findByRole("button", { name: "Écouter la voix Narrateur français" });
    expect(saveAudioConsent).toHaveBeenCalledWith(true);
    expect(startAudioEngine).toHaveBeenCalledOnce();
    expect(vi.mocked(saveAudioConsent).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(startAudioEngine).mock.invocationCallOrder[0]);
  });

  it("starts the integrated engine automatically when CPML consent is already stored", async () => {
    vi.mocked(getAudioConsent).mockResolvedValueOnce({ cpml_accepted: true, cpml_accepted_at: "2026-10-18T10:45:00Z", engine_mode: "integrated" });
    render(<StudioAudioView exportDirectory="C:/Exports" />);
    await screen.findByRole("button", { name: "Écouter la voix Narrateur français" });
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
    expect(await screen.findByText("1 page estimée · 250 mots · ~1 min 51 s")).toBeTruthy();
    expect(screen.getByText("2 pages estimées · 500 mots · ~3 min 42 s")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Supprimer la piste audio Chapitre second" }));
    await waitFor(() => expect(deleteLibraryAudioTrack).toHaveBeenCalledWith("chapter-metadata", 2, "C:/Exports"));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Lire Chapitre second" })).toBeNull());
    expect(screen.getByRole("button", { name: "Lire Chapitre premier" })).toBeTruthy();
  });

  it("explains that an export folder is required before generation", async () => {
    await addLibraryBook({ id: "needs-export", title: "Dossier manquant", shelfId: "in_progress", files: [{ path: "C:/Sources/livre.epub", format: "epub" }] });
    render(<StudioAudioView />);
    await screen.findByRole("button", { name: "Écouter la voix Narrateur français" });
    expect((await screen.findByRole("button", { name: "Générer le chapitre 1" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(/Choisissez un dossier d’export dans Export → Inspection Pré-Presse → Parcourir les archives/)).toBeTruthy();
    expect(generateLibraryAudio).not.toHaveBeenCalled();
  });

  it("locks every generate button and the selectors while a chapter is being forged", async () => {
    await addLibraryBook({ id: "busy-audio", title: "En cours", shelfId: "in_progress", files: [{ path: "C:/Exports/busy.epub", format: "epub" }] });
    let resolveGeneration!: (config: Awaited<ReturnType<typeof getLibraryConfig>>) => void;
    vi.mocked(generateLibraryAudio).mockImplementation(() => new Promise((resolve) => { resolveGeneration = resolve; }));
    render(<StudioAudioView exportDirectory="C:/Exports" />);
    await screen.findByRole("button", { name: "Écouter la voix Narrateur français" });
    fireEvent.click(await screen.findByRole("button", { name: "Générer le chapitre 1" }));
    await waitFor(() => expect((screen.getByRole("button", { name: "Générer le chapitre 1" }) as HTMLButtonElement).disabled).toBe(true));
    expect((screen.getByRole("button", { name: "Générer le chapitre 2" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByRole("button", { name: "Générer le chapitre 1" }).className).toContain("animate-pulse");
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
    await screen.findByRole("button", { name: "Écouter la voix Narrateur français" });
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
    await screen.findByRole("button", { name: "Écouter la voix Narrateur français" });
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
    expect(screen.queryByText(/Disque du livre/)).toBeNull();
  });

  it("adapte un chapitre en trois temps : sélection, banc d'adaptation et régie", async () => {
    await addLibraryBook({ id: "podcast-book", title: "Le Roman dit", shelfId: "in_progress", files: [{ path: "C:/Exports/dit.epub", format: "epub" }] });
    vi.mocked(getBookChapterText).mockImplementation(async (_bookId, index) => index === 2
      ? "Le soir tombait.\n— Je pars, dit-elle, demain.\n— Attends… Aldus !"
      : "Premier chapitre.");
    render(<StudioAudioView exportDirectory="C:/Exports" />);
    fireEvent.click(screen.getByRole("tab", { name: "Le Studio" }));
    await screen.findByRole("option", { name: "2. Chapitre second" });
    fireEvent.change(await screen.findByRole("combobox", { name: "Chapitre à adapter" }), { target: { value: "2" } });
    await waitFor(() => expect(getBookChapterText).toHaveBeenCalledWith("podcast-book", 2));
    expect(screen.getByRole("heading", { name: "I. Sélection du chapitre" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "II.B Banc d’adaptation du script" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "III. Régie de synthèse" })).toBeTruthy();
    expect(await screen.findByText("Manuscrit non transcrit")).toBeTruthy();
    expect(screen.queryByRole("textbox", { name: "Texte de la réplique 1" })).toBeNull();
    expect(screen.getByText(/Chapitre non transcrit : il sera lu en voix unique/)).toBeTruthy();
    await transcribe();
    expect(screen.getByText("Script adapté · 3 répliques")).toBeTruthy();
    expect((await screen.findByRole("textbox", { name: "Texte de la réplique 1" }) as HTMLTextAreaElement).value).toBe("Le soir tombait.");
    expect((screen.getByRole("combobox", { name: "Rôle de la réplique 1" }) as HTMLSelectElement).value).toBe("narrator|Narrateur");
    expect((screen.getByRole("combobox", { name: "Rôle de la réplique 2" }) as HTMLSelectElement).value).toBe("unattributed-dialogue|Dialogues");
    expect((screen.getByRole("textbox", { name: "Texte de la réplique 2" }) as HTMLTextAreaElement).value).toBe("Je pars, dit-elle, demain.");

    fireEvent.click(screen.getByRole("checkbox", { name: /Alléger les incises/ }));
    await waitFor(() => expect((screen.getByRole("textbox", { name: "Texte de la réplique 2" }) as HTMLTextAreaElement).value).toBe("Je pars, demain."));

    fireEvent.click(screen.getByRole("checkbox", { name: /Noms propres/ }));
    fireEvent.change(screen.getByRole("textbox", { name: "Nom propre" }), { target: { value: "Aldus" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Prononciation" }), { target: { value: "Al-duss" } });
    fireEvent.click(screen.getByRole("button", { name: "Ajouter la prononciation" }));
    await waitFor(() => expect((screen.getByRole("textbox", { name: "Texte de la réplique 3" }) as HTMLTextAreaElement).value).toBe("Attends… Al-duss !"));

    fireEvent.change(screen.getByRole("textbox", { name: "Texte de la réplique 1" }), { target: { value: "La nuit tombait." } });
    fireEvent.change(screen.getByRole("combobox", { name: "Rôle de la réplique 1" }), { target: { value: "unattributed-dialogue|Dialogues" } });
    const recap = within(screen.getByRole("list", { name: "Récapitulatif des rôles" }));
    expect(recap.getByText(/Dialogues · 3 répliques/)).toBeTruthy();
    expect(screen.getByText(/lu en polyphonie.*voix par défaut \(Narrateur français\)/)).toBeTruthy();
    expect((screen.getByRole("button", { name: "Générer le chapitre 2" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("propose les personnages du Chœur dans le menu de rôle des répliques", async () => {
    await addLibraryBook({
      id: "choir-podcast", title: "Le Roman choral", shelfId: "in_progress", files: [{ path: "C:/Exports/choral.epub", format: "epub" }],
      audio: { ...audioEdition([]), casting: { mappings: [{ role: "Élise", kind: "character", voiceId: "fr-narrator" }] } },
    });
    vi.mocked(getBookChapterText).mockResolvedValue("— Bonjour.");
    render(<StudioAudioView exportDirectory="C:/Exports" />);
    fireEvent.click(screen.getByRole("tab", { name: "Le Studio" }));
    await transcribe();
    const role = await screen.findByRole("combobox", { name: "Rôle de la réplique 1" });
    fireEvent.change(role, { target: { value: "character|Élise" } });
    expect((screen.getByRole("combobox", { name: "Rôle de la réplique 1" }) as HTMLSelectElement).value).toBe("character|Élise");
    expect(within(screen.getByRole("list", { name: "Récapitulatif des rôles" })).getByText(/Élise · 1 réplique · Narrateur français/)).toBeTruthy();
  });

  it("génère le chapitre adapté en polyphonie et les autres chapitres en voix unique", async () => {
    await addLibraryBook({ id: "poly-book", title: "Le Roman polyphonique", shelfId: "in_progress", files: [{ path: "C:/Exports/poly.epub", format: "epub" }] });
    vi.mocked(getBookChapterText).mockResolvedValue("Le soir tombait.\n— Je pars, dit-elle.");
    vi.mocked(generateLibraryAudio).mockImplementation(async () => getLibraryConfig());
    render(<StudioAudioView exportDirectory="C:/Exports" />);
    fireEvent.click(screen.getByRole("tab", { name: "Le Studio" }));
    await transcribe();
    await screen.findByRole("textbox", { name: "Texte de la réplique 2" });
    await screen.findByRole("button", { name: "Écouter la voix Narrateur français" });
    fireEvent.change(screen.getByRole("combobox", { name: "Rôle de la réplique 2" }), { target: { value: "narrator|Narrateur" } });
    fireEvent.click(screen.getByRole("button", { name: "Générer le chapitre 1" }));
    await waitFor(() => expect(generateLibraryAudio).toHaveBeenCalledTimes(1));
    expect(vi.mocked(generateLibraryAudio).mock.calls[0][5]).toEqual([
      { role: "Narrateur", kind: "narrator", text: "Le soir tombait." },
      { role: "Narrateur", kind: "narrator", text: "Je pars, dit-elle." },
    ]);
    await waitFor(() => expect((screen.getByRole("button", { name: "Générer le chapitre 2" }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "Générer le chapitre 2" }));
    await waitFor(() => expect(generateLibraryAudio).toHaveBeenCalledTimes(2));
    expect(vi.mocked(generateLibraryAudio).mock.calls[1][5]).toBeUndefined();
  });

  it("signale l'indisponibilité du texte d'un chapitre", async () => {
    await addLibraryBook({ id: "broken-text", title: "Texte absent", shelfId: "in_progress", files: [{ path: "C:/Exports/absent.epub", format: "epub" }] });
    vi.mocked(getBookChapterText).mockRejectedValue("Chapitre introuvable.");
    render(<StudioAudioView exportDirectory="C:/Exports" />);
    fireEvent.click(screen.getByRole("tab", { name: "Le Studio" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Chapitre introuvable.");
  });

  it("filtre les voix d'un nouveau personnage par genre et permet de les écouter", async () => {
    const female: AudioVoice = { id: "fr-claribel", name: "Claribel Dervla", language: "fr-FR" };
    const male: AudioVoice = { id: "fr-viktor", name: "Viktor Eka", language: "fr-FR" };
    vi.mocked(listAudioVoices).mockResolvedValue([NARRATOR, female, male]);
    vi.mocked(previewVoice).mockResolvedValue("C:/Data/voice-previews/fr-claribel.mp3");
    vi.stubGlobal("Audio", vi.fn(function (this: { play: () => Promise<void>; pause: () => void }) { this.play = vi.fn().mockResolvedValue(undefined); this.pause = vi.fn(); }));
    await addLibraryBook({ id: "gender-book", title: "Le Roman mixte", shelfId: "in_progress", files: [{ path: "C:/Exports/mixte.epub", format: "epub" }] });
    render(<StudioAudioView exportDirectory="C:/Exports" />);
    await screen.findByRole("button", { name: "Écouter la voix Claribel Dervla" });
    const voiceNames = () => within(screen.getByRole("combobox", { name: "Voix du nouveau personnage" })).getAllByRole("option").map((option) => option.textContent);
    expect(voiceNames()).toEqual(["Narrateur français", "Claribel Dervla", "Viktor Eka"]);
    fireEvent.change(screen.getByRole("combobox", { name: "Genre du nouveau personnage" }), { target: { value: "female" } });
    expect(voiceNames()).toEqual(["Claribel Dervla"]);
    fireEvent.click(screen.getByRole("button", { name: "Écouter le timbre du nouveau personnage" }));
    await waitFor(() => expect(previewVoice).toHaveBeenCalledWith("fr-claribel", expect.any(String)));
    fireEvent.change(screen.getByRole("combobox", { name: "Genre du nouveau personnage" }), { target: { value: "male" } });
    expect(voiceNames()).toEqual(["Viktor Eka"]);
    fireEvent.change(screen.getByRole("textbox", { name: "Nom du personnage" }), { target: { value: "Victor" } });
    fireEvent.click(screen.getByRole("button", { name: "Ajouter" }));
    await screen.findByRole("combobox", { name: "Voix du personnage Victor" });
    expect((await getLibraryConfig()).books[0].audio?.casting?.mappings).toEqual([{ role: "Victor", kind: "character", voiceId: "fr-viktor" }]);
    expect((screen.getByRole("combobox", { name: "Genre du personnage Victor" }) as HTMLSelectElement).value).toBe("male");
    vi.unstubAllGlobals();
  });

  it("garde le Narrateur permanent : aucun bouton pour le retirer", async () => {
    await addLibraryBook({ id: "narrator-book", title: "Le Roman permanent", shelfId: "in_progress", files: [{ path: "C:/Exports/permanent.epub", format: "epub" }] });
    render(<StudioAudioView exportDirectory="C:/Exports" />);
    await screen.findByRole("combobox", { name: "Voix du rôle Narrateur" });
    expect(screen.getByLabelText("Rôle permanent")).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Retirer le (personnage|rôle) Narrateur/ })).toBeNull();
  });

  it("rend au Narrateur les répliques d'un personnage retiré du Chœur", async () => {
    await addLibraryBook({
      id: "orphan-book", title: "Le Roman orphelin", shelfId: "in_progress", files: [{ path: "C:/Exports/orphelin.epub", format: "epub" }],
      audio: { ...audioEdition([]), casting: { mappings: [{ role: "Élise", kind: "character", voiceId: "fr-narrator" }] } },
    });
    vi.mocked(getBookChapterText).mockResolvedValue("— Bonjour.");
    render(<StudioAudioView exportDirectory="C:/Exports" />);
    fireEvent.click(screen.getByRole("tab", { name: "Le Studio" }));
    await transcribe();
    fireEvent.change(await screen.findByRole("combobox", { name: "Rôle de la réplique 1" }), { target: { value: "character|Élise" } });
    fireEvent.click(screen.getByRole("button", { name: "Retirer le personnage Élise" }));
    await waitFor(() => expect((screen.getByRole("combobox", { name: "Rôle de la réplique 1" }) as HTMLSelectElement).value).toBe("narrator|Narrateur"));
  });

  it("restaure l'adaptation d'un chapitre à la réouverture du livre", async () => {
    await addLibraryBook({ id: "kept-book", title: "Le Roman gardé", shelfId: "in_progress", files: [{ path: "C:/Exports/garde.epub", format: "epub" }] });
    vi.mocked(getBookChapterText).mockResolvedValue("— Je pars, dit-elle, demain.\n— Aldus rit.");
    const first = render(<StudioAudioView exportDirectory="C:/Exports" />);
    fireEvent.click(screen.getByRole("tab", { name: "Le Studio" }));
    fireEvent.click(await screen.findByRole("checkbox", { name: /Alléger les incises/ }));
    await transcribe();
    fireEvent.click(screen.getByRole("checkbox", { name: /Noms propres/ }));
    fireEvent.change(screen.getByRole("textbox", { name: "Nom propre" }), { target: { value: "Aldus" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Prononciation" }), { target: { value: "Al-duss" } });
    fireEvent.click(screen.getByRole("button", { name: "Ajouter la prononciation" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Texte de la réplique 1" }), { target: { value: "Je m'en vais." } });
    fireEvent.change(screen.getByRole("combobox", { name: "Rôle de la réplique 2" }), { target: { value: "narrator|Narrateur" } });
    await waitFor(async () => expect((await getLibraryConfig()).books[0].audio?.adaptations).toHaveLength(1));
    const [saved] = (await getLibraryConfig()).books[0].audio?.adaptations ?? [];
    expect(saved.chapterIndex).toBe(1);
    expect(saved.transcribed).toBe(true);
    expect(saved.rules.filter((rule) => rule.enabled).map((rule) => rule.id)).toEqual(["strip-incises", "proper-nouns"]);
    expect(saved.rules.find((rule) => rule.id === "proper-nouns")?.substitutions).toEqual([{ name: "Aldus", spoken: "Al-duss" }]);
    expect(saved.edits).toEqual([{ source: 0, text: "Je m'en vais." }, { source: 1, role: "Narrateur", kind: "narrator" }]);

    first.unmount();
    render(<StudioAudioView exportDirectory="C:/Exports" />);
    fireEvent.click(screen.getByRole("tab", { name: "Le Studio" }));
    expect((await screen.findByRole("textbox", { name: "Texte de la réplique 1" }) as HTMLTextAreaElement).value).toBe("Je m'en vais.");
    expect((screen.getByRole("textbox", { name: "Texte de la réplique 2" }) as HTMLTextAreaElement).value).toBe("Al-duss rit.");
    expect((screen.getByRole("combobox", { name: "Rôle de la réplique 2" }) as HTMLSelectElement).value).toBe("narrator|Narrateur");
    expect((screen.getByRole("checkbox", { name: /Alléger les incises/ }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole("checkbox", { name: /Respirations/ }) as HTMLInputElement).checked).toBe(false);
  });

  it("retire une réplique du script et mémorise l'écart", async () => {
    await addLibraryBook({ id: "trim-book", title: "Le Roman élagué", shelfId: "in_progress", files: [{ path: "C:/Exports/elague.epub", format: "epub" }] });
    vi.mocked(getBookChapterText).mockResolvedValue("Le soir tombait.\n— Je pars.\n— Reste.");
    vi.mocked(generateLibraryAudio).mockImplementation(async () => getLibraryConfig());
    render(<StudioAudioView exportDirectory="C:/Exports" />);
    fireEvent.click(screen.getByRole("tab", { name: "Le Studio" }));
    await transcribe();
    fireEvent.click(await screen.findByRole("button", { name: "Supprimer la réplique 2" }));
    expect((screen.getByRole("textbox", { name: "Texte de la réplique 2" }) as HTMLTextAreaElement).value).toBe("Reste.");
    expect(screen.getByText("Script adapté · 2 répliques")).toBeTruthy();
    await waitFor(async () => expect((await getLibraryConfig()).books[0].audio?.adaptations?.[0].edits).toEqual([{ source: 1, removed: true }]));
  });

  it("demande confirmation avant qu'une nouvelle transcription n'écrase les retouches", async () => {
    await addLibraryBook({ id: "redo-book", title: "Le Roman repris", shelfId: "in_progress", files: [{ path: "C:/Exports/repris.epub", format: "epub" }] });
    vi.mocked(getBookChapterText).mockResolvedValue("— Je pars.");
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<StudioAudioView exportDirectory="C:/Exports" />);
    fireEvent.click(screen.getByRole("tab", { name: "Le Studio" }));
    await transcribe();
    const text = () => screen.getByRole("textbox", { name: "Texte de la réplique 1" }) as HTMLTextAreaElement;
    await screen.findByRole("textbox", { name: "Texte de la réplique 1" });
    fireEvent.click(screen.getByRole("button", { name: "Transcrire en script podcast" }));
    expect(confirm).not.toHaveBeenCalled();

    fireEvent.change(text(), { target: { value: "Je m'en vais." } });
    fireEvent.click(screen.getByRole("button", { name: "Transcrire en script podcast" }));
    expect(confirm).toHaveBeenCalledOnce();
    expect(text().value).toBe("Je m'en vais.");

    confirm.mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "Transcrire en script podcast" }));
    await waitFor(() => expect(text().value).toBe("Je pars."));
  });

  it("n'enregistre rien quand l'adaptation revient à son état d'origine", async () => {
    await addLibraryBook({ id: "pristine-book", title: "Le Roman intact", shelfId: "in_progress", files: [{ path: "C:/Exports/intact.epub", format: "epub" }] });
    vi.mocked(getBookChapterText).mockResolvedValue("— Bonjour.");
    render(<StudioAudioView exportDirectory="C:/Exports" />);
    fireEvent.click(screen.getByRole("tab", { name: "Le Studio" }));
    const rule = await screen.findByRole("checkbox", { name: /Respirations/ });
    fireEvent.click(rule);
    await waitFor(async () => expect((await getLibraryConfig()).books[0].audio?.adaptations).toHaveLength(1));
    fireEvent.click(rule);
    await waitFor(async () => expect((await getLibraryConfig()).books[0].audio?.adaptations).toEqual([]));
  });

  it("marque la piste « Gravée sur le disque » avec ses métadonnées de gravure", async () => {
    await addLibraryBook({
      id: "burnt-book", title: "Le Roman gravé", shelfId: "in_progress", files: [{ path: "C:/Exports/grave.epub", format: "epub" }],
      audio: audioEdition([{
        index: 1, title: "Chapitre premier", path: "C:/Exports/Audio/grave/001.mp3",
        burn: { burnedAt: Date.UTC(2026, 9, 20, 12), durationSeconds: 125, mode: "polyphonic", roles: [{ role: "Narrateur", kind: "narrator", voiceId: "fr-narrator", lines: 4 }, { role: "Élise", kind: "character", voiceId: "fr-narrator", lines: 2 }] },
      }, { index: 2, title: "Chapitre second", path: "C:/Exports/Audio/grave/002.mp3" }]),
    });
    render(<StudioAudioView exportDirectory="C:/Exports" />);
    fireEvent.click(screen.getByRole("tab", { name: "Le Studio" }));
    await screen.findByRole("button", { name: "Régénérer le chapitre 1" });
    expect(screen.getAllByText("Gravée sur le disque")).toHaveLength(2);
    expect(screen.getByText(/2:05 · polyphonie · Narrateur ×4, Élise ×2/)).toBeTruthy();
  });

  it("invites the author to add a book when the register is empty", async () => {
    render(<StudioAudioView exportDirectory="C:/Exports" />);
    expect(await screen.findByText(/Aucun livre au Registre/)).toBeTruthy();
    expect(listBookAudioChapters).not.toHaveBeenCalled();
  });
});
