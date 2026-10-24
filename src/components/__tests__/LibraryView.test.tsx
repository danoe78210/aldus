import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { LibraryView } from "../LibraryView";
import { addLibraryBook, createCustomShelf, deleteLibraryBook, getLibraryConfig, listAudioVoices, openLibraryResource, scanExportFolder } from "../../utils/libraryApi";
import { readBookContent } from "../../utils/readerApi";

vi.mock("../../utils/libraryApi", async (importOriginal) => ({
  ...await importOriginal<typeof import("../../utils/libraryApi")>(),
  scanExportFolder: vi.fn(),
  openLibraryResource: vi.fn().mockResolvedValue(undefined),
  deleteLibraryBook: vi.fn(),
  listAudioVoices: vi.fn(),
}));

vi.mock("../../utils/readerApi", () => ({
  readBookContent: vi.fn(),
  loadReaderBookmarks: vi.fn().mockResolvedValue([]),
  saveReaderBookmarks: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../reader/PdfReader", () => ({ PdfReader: () => <div data-testid="pdf-reader" /> }));

const READER = { name: /Lecteur d'Atelier/ };
const closeReader = async () => {
  fireEvent.click(await screen.findByRole("button", { name: "Retour au Registre" }));
  await waitFor(() => expect(screen.queryByRole("dialog", READER)).toBeNull());
};

beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value() { this.setAttribute("open", ""); } });
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value() { this.removeAttribute("open"); } });
});

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  vi.mocked(deleteLibraryBook).mockReset();
  vi.mocked(readBookContent).mockResolvedValue({ format: "epub", chapters: [{ title: "Chapitre premier", blocks: [{ kind: "paragraph", level: 0, runs: [{ text: "Il était une fois." }] }] }] });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("LibraryView", () => {
  it("requires confirmation, allows cancellation and returns to shelves only after a successful deletion", async () => {
    await addLibraryBook({ id: "delete-me", title: "À supprimer", shelfId: "completed", files: [{ path: "C:/Exports/Livre.epub", format: "epub" }] });
    vi.mocked(deleteLibraryBook).mockImplementation(async (bookId, _exportDirectory) => {
      expect(_exportDirectory).toBe("C:/Exports");
      const config = await getLibraryConfig();
      config.books = config.books.filter((book) => book.id !== bookId);
      localStorage.setItem("aldus-library", JSON.stringify(config));
      return config;
    });
    render(<LibraryView exportDirectory="C:/Exports" />);
    fireEvent.click(await screen.findByRole("button", { name: "Inspecter À supprimer" }));
    fireEvent.click(await screen.findByRole("button", { name: "Supprimer l’ouvrage" }));
    let dialog = await screen.findByRole("alertdialog", { name: "Supprimer l’ouvrage" });
    expect(dialog.textContent).toContain("effacer définitivement");
    expect(deleteLibraryBook).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: /^Annuler$/ }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect((await getLibraryConfig()).books).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Supprimer l’ouvrage" }));
    dialog = await screen.findByRole("alertdialog", { name: "Supprimer l’ouvrage" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Effacer définitivement" }));
    await screen.findByRole("heading", { name: "Bibliothèque" });
    expect(deleteLibraryBook).toHaveBeenCalledExactlyOnceWith("delete-me", "C:/Exports");
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.queryByRole("button", { name: "Inspecter À supprimer" })).toBeNull();
    expect((await getLibraryConfig()).books).toHaveLength(0);
    expect(screen.getByRole("status").textContent).toContain("supprimés");
  });

  it("keeps the book and confirmation open if native deletion fails", async () => {
    await addLibraryBook({ id: "locked", title: "Fichier ouvert", shelfId: "in_progress" });
    vi.mocked(deleteLibraryBook).mockRejectedValueOnce(new Error("Fermez le fichier ouvert avant de réessayer."));
    render(<LibraryView exportDirectory="C:/Exports" />);
    fireEvent.click(await screen.findByRole("button", { name: "Inspecter Fichier ouvert" }));
    fireEvent.click(await screen.findByRole("button", { name: "Supprimer l’ouvrage" }));
    const dialog = await screen.findByRole("alertdialog", { name: "Supprimer l’ouvrage" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Effacer définitivement" }));
    expect((await within(dialog).findByRole("alert")).textContent).toContain("Fermez le fichier ouvert");
    expect(screen.getByRole("heading", { name: "Le Registre du Livre" })).toBeTruthy();
    expect((await getLibraryConfig()).books).toHaveLength(1);
    expect((within(dialog).getByRole("button", { name: "Effacer définitivement" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("aggregates the three formats with spaced or underscored accented filenames into one spine", async () => {
    await addLibraryBook({ id: "first", title: "Les Schattenjägers", shelfId: "in_progress", files: [{ path: "C:/Exports/Les_Schattenjägers.epub", format: "epub" }], fileStatistics: { "C:/Exports/Les_Schattenjägers.epub": { chapterCount: 9 } } });
    await addLibraryBook({ id: "second", title: "Les Schattenjägers", shelfId: "in_progress", files: [
      { path: "C:/Exports/Les Schattenjägers.pdf", format: "pdf" },
      { path: "C:/Exports/Les_Schattenjägers.docx", format: "docx" },
    ] });
    render(<LibraryView />);
    expect(await screen.findAllByRole("button", { name: "Inspecter Les Schattenjägers" })).toHaveLength(1);
    expect(screen.getByLabelText("Formats : EPUB, PDF, DOCX").textContent).toBe("EPUBPDFDOCX");
    fireEvent.click(screen.getByRole("button", { name: "Inspecter Les Schattenjägers au format PDF" }));
    await screen.findByRole("heading", { name: "Le Registre du Livre" });
    expect(screen.getByRole("button", { name: "PDF" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "Ouvrir le livre" }));
    await screen.findByTestId("pdf-reader");
    expect(openLibraryResource).not.toHaveBeenCalled();
    await closeReader();
    fireEvent.click(screen.getByRole("button", { name: "Retour aux rayons" }));
    const config = await getLibraryConfig();
    expect(config.books).toHaveLength(1);
    expect(config.books[0].files).toHaveLength(3);
  });
  it("separates the main shelves and persists dynamic shelf creation, renaming and deletion", async () => {
    render(<LibraryView />);
    await screen.findByRole("region", { name: "En cours" });
    expect(screen.getByRole("region", { name: "Terminés" })).toBeTruthy();
    expect(screen.queryByRole("region", { name: "Archives" })).toBeNull();
    fireEvent.click(screen.getByRole("tab", { name: "Rayons Personnalisés" }));
    expect(screen.queryByRole("region", { name: "En cours" })).toBeNull();

    for (const label of ["Romans", "Poésie", "Essais"]) {
      fireEvent.change(screen.getByRole("textbox", { name: "Nom du nouveau rayon" }), { target: { value: label } });
      fireEvent.click(screen.getByRole("button", { name: "Ajouter un nouveau rayon" }));
      await screen.findByRole("region", { name: label });
    }
    expect((await getLibraryConfig()).shelves).toHaveLength(5);
    const field = screen.getAllByRole("textbox", { name: "Nom de l’étagère personnalisée" })[0];
    fireEvent.change(field, { target: { value: "Romans historiques" } });
    fireEvent.blur(field);
    await screen.findByRole("region", { name: "Romans historiques" });
    expect((await getLibraryConfig()).shelves[2].label).toBe("Romans historiques");
    fireEvent.click(screen.getByRole("button", { name: "Supprimer Romans historiques" }));
    await waitFor(() => expect(screen.queryByRole("region", { name: "Romans historiques" })).toBeNull());
    expect((await getLibraryConfig()).shelves).toHaveLength(4);

    cleanup();
    render(<LibraryView />);
    await screen.findByRole("region", { name: "En cours" });
    expect(screen.getByRole("tab", { name: "Rayons Principaux" }).getAttribute("aria-selected")).toBe("true");
    fireEvent.click(screen.getByRole("tab", { name: "Rayons Personnalisés" }));
    expect(screen.getByRole("region", { name: "Poésie" })).toBeTruthy();
  });

  it("moves books across tabs and returns them to En cours when their custom shelf is deleted", async () => {
    await createCustomShelf("Romans");
    await addLibraryBook({ id: "book", title: "Le Livre", shelfId: "in_progress" });
    render(<LibraryView />);
    await screen.findByRole("region", { name: "En cours" });
    const select = await screen.findByRole("combobox", { name: "Déplacer Le Livre" });
    const shelf = (await getLibraryConfig()).shelves.find((item) => item.label === "Romans")!;
    fireEvent.change(select, { target: { value: shelf.id } });
    await waitFor(() => expect(screen.queryByRole("combobox")).toBeNull());
    fireEvent.click(screen.getByRole("tab", { name: "Rayons Personnalisés" }));
    expect(screen.getByRole("combobox", { name: "Déplacer Le Livre" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Supprimer Romans" }));
    expect(screen.getByRole("alert").textContent).toContain("En cours");
    fireEvent.click(screen.getByRole("button", { name: /^Supprimer$/ }));
    await waitFor(() => expect(screen.queryByRole("region", { name: "Romans" })).toBeNull());
    fireEvent.click(screen.getByRole("tab", { name: "Rayons Principaux" }));
    expect(screen.getByRole("combobox", { name: "Déplacer Le Livre" })).toBeTruthy();
    expect((await getLibraryConfig()).books[0].shelfId).toBe("in_progress");
  });

  it("scans, corrects metadata, imports and inspects a book with persistent file links", async () => {
    const config = await createCustomShelf("Romans");
    const shelf = config.shelves.find((item) => item.isCustom)!;
    vi.mocked(scanExportFolder).mockResolvedValue([{
      title: "Roman_export",
      files: [{ path: "C:/Exports/roman.epub", format: "epub" }, { path: "C:/Exports/roman.pdf", format: "pdf" }, { path: "C:/Exports/roman.docx", format: "docx" }],
      coverPath: "https://example.test/roman.jpg",
    }]);
    render(<LibraryView exportDirectory="C:/Exports" sourceDirectory="C:/Sources" currentBookTitle="Roman export" />);
    fireEvent.click(await screen.findByRole("button", { name: "Scanner le dossier d’export" }));
    await screen.findByRole("dialog", { name: "Intégrer les exports" });
    expect(scanExportFolder).toHaveBeenCalledWith("C:/Exports");
    fireEvent.change(screen.getByRole("textbox", { name: "Titre" }), { target: { value: "Le Roman" } });
    fireEvent.change(screen.getByRole("textbox", { name: "Tome" }), { target: { value: "II" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Rayon de destination" }), { target: { value: shelf.id } });
    fireEvent.click(screen.getByRole("button", { name: "Importer" }));
    await screen.findByRole("status");
    fireEvent.click(screen.getByRole("button", { name: "Fermer l’import" }));
    fireEvent.click(screen.getByRole("tab", { name: "Rayons Personnalisés" }));
    fireEvent.click(screen.getByRole("button", { name: "Inspecter Le Roman" }));
    expect(await screen.findByRole("heading", { name: "Le Registre du Livre" })).toBeTruthy();
    expect(screen.getByText("Tome II")).toBeTruthy();
    const cover = screen.getByRole("img", { name: "Couverture de Le Roman" });
    fireEvent.error(cover);
    expect(screen.getByRole("img", { name: "Couverture vierge de Le Roman" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ouvrir le livre" }));
    await waitFor(() => expect(readBookContent).toHaveBeenCalledWith(expect.any(String), "C:/Exports/roman.epub"));
    expect(openLibraryResource).not.toHaveBeenCalled();
    await closeReader();
    expect(screen.queryByRole("button", { name: "Ouvrir l’EPUB" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Ouvrir le PDF" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Ouvrir le dossier source" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Ouvrir le dossier d’export" })).toBeNull();
    expect(screen.getAllByText("Non disponible")).toHaveLength(2);
    expect(screen.getByRole("region", { name: "Statistiques de l’ouvrage" }).textContent).not.toContain("Nbre de chapitres");
    fireEvent.change(screen.getByRole("combobox", { name: "Emplacement actuel" }), { target: { value: "completed" } });
    await waitFor(() => expect((screen.getByRole("combobox", { name: "Emplacement actuel" }) as HTMLSelectElement).value).toBe("completed"));
    fireEvent.click(screen.getByRole("button", { name: "Retour aux rayons" }));
    expect(screen.getByRole("button", { name: "Inspecter Le Roman" })).toBeTruthy();
    const book = (await getLibraryConfig()).books[0];
    expect(book).toMatchObject({ title: "Le Roman", tome: "II", shelfId: "completed", sourceDirectory: "C:/Sources" });
    expect(book.files).toHaveLength(3);
  });

  it("handles an empty scan, scan failures and a missing configured directory", async () => {
    const view = render(<LibraryView />);
    fireEvent.click(await screen.findByRole("button", { name: "Scanner le dossier d’export" }));
    expect(screen.getByRole("alert").textContent).toContain("Choisissez un dossier");
    expect(scanExportFolder).not.toHaveBeenCalled();
    view.rerender(<LibraryView exportDirectory="C:/Exports" />);
    vi.mocked(scanExportFolder).mockRejectedValueOnce(new Error("Dossier inaccessible"));
    fireEvent.click(screen.getByRole("button", { name: "Scanner le dossier d’export" }));
    await screen.findByText("Dossier inaccessible");
    vi.mocked(scanExportFolder).mockResolvedValueOnce([]);
    fireEvent.click(screen.getByRole("button", { name: "Scanner le dossier d’export" }));
    await screen.findByText("Aucun nouvel export à importer.");
  });

  it("adds new formats to the original book, shows one spine and confirms the unified import", async () => {
    await addLibraryBook({ id: "nunael", title: "Titre corrigé", tome: "II", shelfId: "completed", files: [{ path: "C:/Exports/Nunael.epub", format: "epub" }], fileStatistics: { "C:/Exports/Nunael.epub": { chapterCount: 9 } } });
    vi.mocked(scanExportFolder).mockResolvedValue([{ title: "Titre corrigé", existingBookId: "nunael", files: [
      { path: "C:/Exports/Nunael.pdf", format: "pdf" },
      { path: "C:/Exports/Nunael.docx", format: "docx" },
    ] }]);
    render(<LibraryView exportDirectory="C:/Exports" />);
    fireEvent.click(await screen.findByRole("button", { name: "Scanner le dossier d’export" }));
    await screen.findByRole("dialog", { name: "Intégrer les exports" });
    expect((screen.getByRole("textbox", { name: "Titre" }) as HTMLInputElement).value).toBe("Titre corrigé");
    expect((screen.getByRole("combobox", { name: "Rayon de destination" }) as HTMLSelectElement).value).toBe("completed");
    fireEvent.click(screen.getByRole("button", { name: "Importer" }));
    const summary = await screen.findByRole("status");
    expect(summary.textContent).toContain("EPUB + PDF + DOCX unifiés dans une seule fiche");
    fireEvent.click(screen.getByRole("button", { name: "Fermer l’import" }));
    expect(screen.getAllByRole("button", { name: "Inspecter Titre corrigé" })).toHaveLength(1);
    const markings = screen.getByLabelText("Formats : EPUB, PDF, DOCX");
    expect(markings.textContent).toBe("EPUBPDFDOCX");
    expect(markings.querySelectorAll("[title]")).toHaveLength(3);
    expect([...markings.children].every((mark) => mark.className.includes("border-[#d4af37]/50") && mark.className.includes("bg-[#15120f]") && mark.className.includes("text-[10px]") && mark.className.includes("text-[#f3f0ea]"))).toBe(true);
    const config = await getLibraryConfig();
    expect(config.books).toHaveLength(1);
    expect(config.books[0]).toMatchObject({ id: "nunael", title: "Titre corrigé", tome: "II", shelfId: "completed" });
    expect(config.books[0].files).toHaveLength(3);
    expect(config.books[0].fileStatistics?.["C:/Exports/Nunael.epub"].chapterCount).toBe(9);
    await addLibraryBook({ id: "repeat", title: "Nunael", shelfId: "in_progress", files: [{ path: "C:/Exports/Nunael.pdf", format: "pdf" }] });
    expect((await getLibraryConfig()).books).toHaveLength(1);
    expect((await getLibraryConfig()).books[0].files).toHaveLength(3);
  });

  it("merges legacy duplicate records while keeping their individual format metadata", async () => {
    const defaults = await getLibraryConfig();
    localStorage.setItem("aldus-library", JSON.stringify({ ...defaults, books: [
      { id: "first", title: "Nunael", shelfId: "completed", files: [{ path: "exports/Nunael.epub", format: "epub" }], fileStatistics: { "exports/Nunael.epub": { chapterCount: 9 } } },
      { id: "second", title: "Autre titre", shelfId: "in_progress", files: [{ path: "exports/nunael.pdf", format: "pdf" }], fileStatistics: { "exports/nunael.pdf": { pageCount: 49 } } },
    ] }));
    const config = await getLibraryConfig();
    expect(config.books).toHaveLength(1);
    expect(config.books[0].id).toBe("first");
    expect(config.books[0].fileStatistics?.["exports/nunael.pdf"].pageCount).toBe(49);
    expect(config.books[0].fileStatistics?.["exports/Nunael.epub"].chapterCount).toBe(9);
    expect(await getLibraryConfig()).toEqual(config);
  });

  it("offers one selector per format while retaining copies and choosing the most recently modified file", async () => {
    await addLibraryBook({ id: "copies", title: "Copies", shelfId: "in_progress", files: [
      { path: "old/Nunael.pdf", format: "pdf" }, { path: "new/Nunael.pdf", format: "pdf" }, { path: "new/Nunael.epub", format: "epub" },
    ], fileStatistics: {
      "old/Nunael.pdf": { pageCount: 40, lastModified: 1 },
      "new/Nunael.pdf": { pageCount: 49, lastModified: 2 },
    } });
    render(<LibraryView />);
    fireEvent.click(await screen.findByRole("button", { name: "Inspecter Copies" }));
    await screen.findByRole("heading", { name: "Le Registre du Livre" });
    expect(screen.getAllByRole("button", { name: "PDF" })).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "PDF" }));
    expect(screen.getByText("49")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ouvrir le livre" }));
    await screen.findByTestId("pdf-reader");
    expect(openLibraryResource).not.toHaveBeenCalled();
    await closeReader();
    expect((await getLibraryConfig()).books[0].files).toHaveLength(3);
  });

  it("displays the selected book statistics and a readable modification date", async () => {
    await addLibraryBook({ id: "stats", title: "Statistiques", shelfId: "in_progress", pageCount: 240, chapterCount: 18, lastModified: Date.UTC(2026, 9, 16, 12) });
    render(<LibraryView />);
    fireEvent.click(await screen.findByRole("button", { name: "Inspecter Statistiques" }));
    await screen.findByRole("heading", { name: "Le Registre du Livre" });
    expect(screen.getByRole("region", { name: "Statistiques de l’ouvrage" }).textContent).toContain("240");
    expect(screen.getByRole("region", { name: "Statistiques de l’ouvrage" }).textContent).not.toContain("Nbre de chapitres");
    expect(screen.getByText("16 octobre 2026")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Ouvrir le livre" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Retour aux rayons" }));
    const config = await getLibraryConfig();
    config.books[0].chapterCount = 0;
    config.books[0].chapterCountAvailable = true;
    localStorage.setItem("aldus-library", JSON.stringify(config));
    fireEvent.click(screen.getByRole("button", { name: "Inspecter Statistiques" }));
    await screen.findByRole("heading", { name: "Le Registre du Livre" });
    expect(screen.getByRole("region", { name: "Statistiques de l’ouvrage" }).textContent).not.toContain("Nbre de chapitres");
    expect(screen.queryByText("\u2014")).toBeNull();
  });

  it("switches DOCX statistics and opens the selected Word file instead of the EPUB or PDF", async () => {
    await addLibraryBook({
      id: "formats", title: "Multi-formats", shelfId: "in_progress", pageCount: 49, chapterCount: 9,
      files: [
        { path: "C:/Exports/livre.epub", format: "epub" },
        { path: "C:/Exports/livre.pdf", format: "pdf" },
        { path: "C:/Exports/livre.docx", format: "docx" },
      ],
      fileStatistics: {
        "C:/Exports/livre.epub": { chapterCount: 9, lastModified: Date.UTC(2026, 9, 16, 12) },
        "C:/Exports/livre.pdf": { pageCount: 49, chapterCount: 9, lastModified: Date.UTC(2026, 9, 17, 12) },
        "C:/Exports/livre.docx": { pageCount: 12, chapterCount: 3, wordCount: 4200, lastModified: Date.UTC(2026, 9, 18, 12), metadataModified: "2020-01-01T00:00:00Z" },
      },
    });
    render(<LibraryView />);
    fireEvent.click(await screen.findByRole("button", { name: "Inspecter Multi-formats" }));
    await screen.findByRole("heading", { name: "Le Registre du Livre" });
    expect(screen.getByRole("button", { name: "EPUB" }).getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: "DOCX" }));
    expect(screen.getByRole("button", { name: "DOCX" }).getAttribute("aria-pressed")).toBe("true");
    const statistics = screen.getByRole("region", { name: "Statistiques de l’ouvrage" });
    expect(statistics.textContent).toContain("Nbre de pages :12");
    expect(statistics.textContent).not.toContain("Nbre de chapitres");
    expect(statistics.textContent).toContain((4200).toLocaleString("fr-FR"));
    expect(screen.getByText("18 octobre 2026")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ouvrir le livre" }));
    await waitFor(() => expect(readBookContent).toHaveBeenLastCalledWith("formats", "C:/Exports/livre.docx"));
    await closeReader();
    await waitFor(() => expect((screen.getByRole("button", { name: "PDF" }) as HTMLButtonElement).disabled).toBe(false));
    fireEvent.click(screen.getByRole("button", { name: "PDF" }));
    expect(statistics.textContent).toContain("Nbre de pages :49");
    expect(statistics.textContent).not.toContain("Nbre de chapitres");
    expect(screen.getByText("17 octobre 2026")).toBeTruthy();
    expect(screen.queryByText("Nbre de mots :")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Ouvrir le livre" }));
    await screen.findByTestId("pdf-reader");
    await closeReader();
  });

  it("keeps the AUDIO format chip for generated editions and points to the Studio Audio ribbon", async () => {
    await addLibraryBook({
      id: "spoken-book",
      title: "Le Roman parlé",
      shelfId: "completed",
      files: [{ path: "C:/Exports/roman.docx", format: "docx" }],
      audio: {
        engine: "http://127.0.0.1:8020",
        voiceId: "fr-narrator",
        voiceName: "Narrateur français",
        generatedAt: Date.UTC(2026, 9, 16),
        chapters: [{ index: 1, title: "Chapitre premier", path: "C:/Exports/Audio/roman/001-chapitre-premier.mp3" }],
      },
    });
    render(<LibraryView exportDirectory="C:/Exports" />);
    expect(await screen.findByLabelText("Formats : DOCX, AUDIO")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Inspecter Le Roman parlé au format AUDIO" }));
    await screen.findByRole("heading", { name: "Le Registre du Livre" });
    expect(screen.getByRole("button", { name: "AUDIO" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByText(/à retrouver dans le Studio Audio/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Générer l’édition audio" })).toBeNull();
    expect(listAudioVoices).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Ouvrir le livre" }));
    await waitFor(() => expect(openLibraryResource).toHaveBeenLastCalledWith("spoken-book", "C:/Exports/Audio/roman/001-chapitre-premier.mp3"));
    expect(screen.queryByRole("dialog", { name: /Lecteur d'Atelier/ })).toBeNull();
  });

  it("does not reuse aggregate PDF statistics for a DOCX without readable metadata", async () => {
    await addLibraryBook({ id: "word", title: "Word seul", shelfId: "in_progress", pageCount: 49, chapterCount: 9, files: [{ path: "C:/Exports/word.docx", format: "docx" }] });
    render(<LibraryView exportDirectory="C:/Exports" />);
    fireEvent.click(await screen.findByRole("button", { name: "Inspecter Word seul" }));
    await screen.findByRole("heading", { name: "Le Registre du Livre" });
    expect(screen.getByRole("button", { name: "DOCX" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.queryByText("49")).toBeNull();
    expect(screen.queryByText("9")).toBeNull();
    expect(screen.getAllByText("\u2014")).toHaveLength(1);
    vi.mocked(readBookContent).mockRejectedValueOnce(new Error("Fichier introuvable"));
    fireEvent.click(screen.getByRole("button", { name: "Ouvrir le livre" }));
    const reader = await screen.findByRole("dialog", READER);
    expect((await within(reader).findByRole("alert")).textContent).toBe("Fichier introuvable");
  });

  it("migrates legacy archive books and hidden populated custom shelves without losing books", async () => {
    localStorage.setItem("aldus-library", JSON.stringify({
      shelves: [
        { id: "archived", label: "Archives", isCustom: false, isVisible: true },
        { id: "custom_1", label: "Romans", isCustom: true, isVisible: false },
        { id: "custom_2", label: "Vide", isCustom: true, isVisible: false },
      ],
      books: [
        { id: "old", title: "Ancien", shelfId: "archived" },
        { id: "hidden", title: "Caché", shelfId: "custom_1" },
      ],
    }));
    const config = await getLibraryConfig();
    expect(config.shelves.map((shelf) => shelf.id)).toEqual(["in_progress", "completed", "custom_1"]);
    expect(config.books.map((book) => book.shelfId)).toEqual(["completed", "custom_1"]);
    expect(config.shelves[2].isVisible).toBe(true);
    expect(await getLibraryConfig()).toEqual(config);
  });
});