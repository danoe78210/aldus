import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { WorkshopReaderView } from "../WorkshopReaderView";
import type { Book, ReaderBookmark } from "../../../types";
import { loadReaderBookmarks, readBookContent, saveReaderBookmarks } from "../../../utils/readerApi";

vi.mock("../../../utils/readerApi", () => ({
  readBookContent: vi.fn(),
  loadReaderBookmarks: vi.fn(),
  saveReaderBookmarks: vi.fn(),
}));
vi.mock("../PdfReader", () => ({ PdfReader: () => <div data-testid="pdf-reader" /> }));

const BOOK: Book = { id: "book-1", title: "Le Roman", shelfId: "in_progress", chapterCount: 2, files: [{ path: "C:/Sources/roman.epub", format: "epub" }] };
const run = (text: string) => ({ text });
const CONTENT = {
  format: "epub" as const,
  chapters: [
    { title: "Premier chapitre", blocks: [{ kind: "paragraph" as const, level: 0, runs: [run("Il était une fois un scribe.")] }] },
    { title: "Second chapitre", blocks: [{ kind: "paragraph" as const, level: 0, runs: [run("La suite arriva.")] }] },
  ],
};

const renderReader = (onClose = vi.fn(), file: { path: string; format: "epub" | "pdf" | "docx" } = { path: "C:/Sources/roman.epub", format: "epub" }) => {
  render(<WorkshopReaderView book={BOOK} file={file} onClose={onClose} />);
  return onClose;
};

beforeEach(() => {
  localStorage.clear();
  vi.mocked(readBookContent).mockResolvedValue(CONTENT);
  vi.mocked(loadReaderBookmarks).mockResolvedValue([]);
  vi.mocked(saveReaderBookmarks).mockResolvedValue(undefined);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("WorkshopReaderView", () => {
  it("opens the book natively, in a fullscreen dialog, and closes on Escape", async () => {
    const onClose = renderReader();
    expect(screen.getByRole("dialog", { name: "Lecteur d'Atelier — Le Roman" })).toBeTruthy();
    expect(await screen.findByText("Il était une fois un scribe.")).toBeTruthy();
    expect(readBookContent).toHaveBeenCalledWith("book-1", "C:/Sources/roman.epub");
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("closes from the discreet corner button", async () => {
    const onClose = renderReader();
    await screen.findByText("Il était une fois un scribe.");
    fireEvent.click(screen.getByRole("button", { name: "Retour au Registre" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("navigates through the interactive table of contents", async () => {
    renderReader();
    await screen.findByText("Il était une fois un scribe.");
    fireEvent.click(screen.getByRole("button", { name: "Table des matières" }));
    fireEvent.click(screen.getByRole("button", { name: "Second chapitre" }));
    expect(await screen.findByText("La suite arriva.")).toBeTruthy();
    expect(screen.queryByText("Il était une fois un scribe.")).toBeNull();
  });

  it("saves a golden bookmark through the backend and lists it", async () => {
    renderReader();
    await screen.findByText("Il était une fois un scribe.");
    fireEvent.click(await screen.findByRole("button", { name: "Poser un signet doré" }));
    await waitFor(() => expect(saveReaderBookmarks).toHaveBeenCalledOnce());
    const [bookId, saved] = vi.mocked(saveReaderBookmarks).mock.calls[0];
    expect(bookId).toBe("book-1");
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ bookId: "book-1", format: "epub", chapter: 0, chapterTitle: "Premier chapitre", excerpt: "Il était une fois un scribe." });
    fireEvent.click(screen.getByRole("button", { name: "Signets dorés" }));
    expect(screen.getByRole("button", { name: "Retirer le signet Premier chapitre" })).toBeTruthy();
  });

  it("restores persisted bookmarks and removes one", async () => {
    const stored: ReaderBookmark = { id: "b1", bookId: "book-1", format: "epub", chapter: 1, chapterTitle: "Second chapitre", position: 0, excerpt: "La suite", createdAt: 1 };
    vi.mocked(loadReaderBookmarks).mockResolvedValue([stored]);
    renderReader();
    await screen.findByText("Il était une fois un scribe.");
    fireEvent.click(screen.getByRole("button", { name: "Signets dorés" }));
    fireEvent.click(await screen.findByText("La suite"));
    expect(await screen.findByText("La suite arriva.")).toBeTruthy();
    await waitFor(() => expect(screen.getByRole("button", { name: "Retirer le signet doré" })).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Retirer le signet Second chapitre" }));
    await waitFor(() => expect(saveReaderBookmarks).toHaveBeenCalledWith("book-1", []));
  });

  it("persists typographic settings from the drawer", async () => {
    renderReader();
    await screen.findByText("Il était une fois un scribe.");
    fireEvent.click(screen.getByRole("button", { name: "Réglages typographiques" }));
    fireEvent.click(screen.getByRole("button", { name: "Dark Atelier" }));
    fireEvent.click(screen.getByRole("button", { name: "EB Garamond" }));
    fireEvent.change(screen.getByRole("slider", { name: "Taille du texte" }), { target: { value: "22" } });
    expect(screen.getByRole("dialog").style.background).toContain("rgb(18, 17, 16)");
    expect(JSON.parse(localStorage.getItem("aldus-reader-settings") ?? "{}")).toMatchObject({ theme: "atelier", font: "garamond", fontSize: 22 });
  });

  it("hides the chrome after 3 s of silence and restores it on movement", async () => {
    renderReader();
    await screen.findByText("Il était une fois un scribe.");
    vi.useFakeTimers();
    const header = screen.getByRole("button", { name: "Retour au Registre" }).parentElement as HTMLElement;
    act(() => { window.dispatchEvent(new Event("mousemove")); });
    expect(header.className).toContain("opacity-100");
    act(() => { vi.advanceTimersByTime(3000); });
    expect(header.className).toContain("opacity-0 transition-opacity duration-700");
    act(() => { window.dispatchEvent(new Event("mousemove")); });
    expect(header.className).toContain("opacity-100");
  });

  it("renders the PDF reader without a table of contents button", async () => {
    renderReader(vi.fn(), { path: "C:/Sources/roman.pdf", format: "pdf" });
    expect(screen.queryByRole("button", { name: "Table des matières" })).toBeNull();
    expect(readBookContent).not.toHaveBeenCalled();
    expect(await screen.findByTestId("pdf-reader")).toBeTruthy();
  });

  it("reports an unreadable file in an alert", async () => {
    vi.mocked(readBookContent).mockRejectedValue(new Error("Fichier introuvable"));
    renderReader();
    expect((await screen.findByRole("alert")).textContent).toBe("Fichier introuvable");
  });
});
