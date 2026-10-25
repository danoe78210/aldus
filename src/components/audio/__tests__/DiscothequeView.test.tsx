import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { AudioReaderView } from "../AudioReaderView";
import { DiscothequeView } from "../DiscothequeView";
import type { AudioChapter, DeckSelection } from "../../../types";
import { addLibraryBook, deleteLibraryAudioTrack, getLibraryConfig, libraryCoverUrl } from "../../../utils/libraryApi";

vi.mock("../../../utils/libraryApi", async (importOriginal) => ({
  ...await importOriginal<typeof import("../../../utils/libraryApi")>(),
  libraryCoverUrl: vi.fn(),
  deleteLibraryAudioTrack: vi.fn(),
}));

beforeEach(() => {
  localStorage.clear();
  vi.mocked(libraryCoverUrl).mockImplementation((path) => `asset://${path}`);
  vi.mocked(deleteLibraryAudioTrack).mockReset();
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const edition = (chapters: AudioChapter[]) => ({ engine: "http://127.0.0.1:8020", voiceId: "fr-narrator", voiceName: "Narrateur français", generatedAt: 1, chapters });
const polyphonic: AudioChapter["burn"] = { burnedAt: Date.UTC(2026, 9, 20, 12), durationSeconds: 125, mode: "polyphonic", roles: [{ role: "Narrateur", kind: "narrator", voiceId: "fr-narrator", lines: 4 }, { role: "Élise", kind: "character", voiceId: "fr-narrator", lines: 2 }] };
const mono: AudioChapter["burn"] = { burnedAt: Date.UTC(2026, 9, 21, 12), durationSeconds: 3700, mode: "mono", roles: [] };
const tracks = (slug: string, burn = polyphonic): AudioChapter[] => [
  { index: 1, title: "Chapitre premier", path: `C:/Audio/${slug}/001.mp3`, burn },
  { index: 2, title: "Chapitre second", path: `C:/Audio/${slug}/002.mp3`, burn },
];

const addBook = (id: string, title: string, chapters?: AudioChapter[], tome?: string) =>
  addLibraryBook({ id, title, tome, shelfId: "in_progress", files: [{ path: `C:/Exports/${id}.epub`, format: "epub" }], ...(chapters ? { audio: edition(chapters) } : {}) });

const Oratoire = ({ currentBookTitle }: { currentBookTitle?: string }) => {
  const [menu, setMenu] = useState<"discotheque" | "lecteur">("discotheque");
  const [deck, setDeck] = useState<DeckSelection | null>(null);
  return menu === "discotheque"
    ? <DiscothequeView currentBookTitle={currentBookTitle} deck={deck} onPlay={(selection) => { setDeck(selection); setMenu("lecteur"); }} />
    : <AudioReaderView currentBookTitle={currentBookTitle} deck={deck} onDeckChange={setDeck} onOpenDiscotheque={() => setMenu("discotheque")} />;
};

describe("DiscothequeView", () => {
  it("shows a waiting room pointing to the Studio Audio when no book is burnt", async () => {
    await addBook("silent", "Le Roman muet");
    const onOpenStudio = vi.fn();
    render(<DiscothequeView deck={null} onPlay={vi.fn()} onOpenStudio={onOpenStudio} />);
    expect(await screen.findByText("Aucun disque gravé dans l’atelier.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ouvrir le Studio Audio" }));
    expect(onOpenStudio).toHaveBeenCalledOnce();
  });

  it("shelves one album per burnt book with tome, track count, total duration and casting badge", async () => {
    await addBook("silent", "Le Roman muet");
    await addBook("first", "Premier Livre", tracks("first"), "2");
    await addBook("second", "Second Livre", tracks("second", mono));
    render(<DiscothequeView currentBookTitle="second livre" deck={null} onPlay={vi.fn()} />);
    const second = await screen.findByRole("button", { name: "Disque Second Livre" });
    expect(screen.queryByRole("button", { name: "Disque Le Roman muet" })).toBeNull();
    expect(second.getAttribute("aria-pressed")).toBe("true");
    expect(within(second).getByText(/2 pistes gravées · 2 h 03 min/)).toBeTruthy();
    expect(within(second).getByText("Mono · Voix maîtresse")).toBeTruthy();

    const first = screen.getByRole("button", { name: "Disque Premier Livre · Tome 2" });
    expect(within(first).getByText(/2 pistes gravées · 4 min 10 s/)).toBeTruthy();
    expect(within(first).getByText("Polyphonique · 2 voix")).toBeTruthy();
  });

  it("selects a disc and unfolds its session sheet without leaving the page", async () => {
    await addBook("first", "Premier Livre", tracks("first"));
    await addBook("second", "Second Livre", tracks("second", mono));
    const onPlay = vi.fn();
    render(<DiscothequeView currentBookTitle="premier livre" deck={null} onPlay={onPlay} />);
    await screen.findByRole("list", { name: "Pistes gravées" });
    expect(within(screen.getByRole("list", { name: "Pistes gravées" })).getAllByText("Narrateur ×4, Élise ×2")).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "Disque Second Livre" }));
    expect(screen.getByRole("button", { name: "Disque Second Livre" }).getAttribute("aria-pressed")).toBe("true");
    const list = within(screen.getByRole("list", { name: "Pistes gravées" }));
    expect(list.getAllByText(/21\/10\/2026 · 61:40/)).toHaveLength(2);
    expect(list.queryAllByText("Narrateur ×4, Élise ×2")).toHaveLength(0);
    expect(onPlay).not.toHaveBeenCalled();
  });

  it("puts the selected disc on the deck from the session sheet button or a track, never auto-playing", async () => {
    await addBook("first", "Premier Livre", tracks("first"));
    const onPlay = vi.fn();
    render(<DiscothequeView deck={null} onPlay={onPlay} />);
    fireEvent.click(await screen.findByRole("button", { name: "Poser sur la platine" }));
    expect(onPlay).toHaveBeenLastCalledWith({ bookId: "first", chapterIndex: undefined, autoPlay: false });
    fireEvent.click(screen.getByRole("button", { name: /2\. Chapitre second/ }));
    expect(onPlay).toHaveBeenLastCalledWith({ bookId: "first", chapterIndex: 2, autoPlay: false });
  });

  it("switches to the Lecteur with the chosen track on the tape, and comes back to the shelves", async () => {
    await addBook("first", "Premier Livre", tracks("first"));
    await addBook("second", "Second Livre", tracks("second"));
    render(<Oratoire currentBookTitle="premier livre" />);
    fireEvent.click(await screen.findByRole("button", { name: "Disque Second Livre" }));
    fireEvent.click(screen.getByRole("button", { name: /2\. Chapitre second/ }));

    const tape = await screen.findByLabelText("Bande Chapitre second");
    expect(tape.getAttribute("src")).toBe("asset://C:/Audio/second/002.mp3");
    expect((tape as HTMLAudioElement).autoplay).toBe(false);
    expect(screen.getByText("Second Livre")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Retourner à la discothèque" }));
    const album = await screen.findByRole("button", { name: "Disque Second Livre" });
    expect(album.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: /2\. Chapitre second/ }).getAttribute("aria-current")).toBe("true");
  });

  it("puts the first track on the platine with « Poser sur la platine »", async () => {
    await addBook("first", "Premier Livre", tracks("first"));
    render(<Oratoire />);
    fireEvent.click(await screen.findByRole("button", { name: "Poser sur la platine" }));
    expect((await screen.findByLabelText("Bande Chapitre premier")).getAttribute("src")).toBe("asset://C:/Audio/first/001.mp3");
  });

  describe("suppression des enregistrements", () => {
    const eraseTrack = async (bookId: string, chapterIndex: number) => {
      const config = await getLibraryConfig();
      const book = config.books.find((item) => item.id === bookId)!;
      book.audio!.chapters = book.audio!.chapters.filter((chapter) => chapter.index !== chapterIndex);
      localStorage.setItem("aldus-library", JSON.stringify(config));
      return config;
    };

    it("removes one recording after confirmation and keeps the rest of the album", async () => {
      await addBook("first", "Premier Livre", tracks("first"));
      vi.spyOn(window, "confirm").mockReturnValue(true);
      vi.mocked(deleteLibraryAudioTrack).mockImplementation(eraseTrack);
      render(<DiscothequeView deck={null} exportDirectory="C:/Exports" onPlay={vi.fn()} />);
      const trash = await screen.findByRole("button", { name: "Supprimer l’enregistrement Chapitre second" });
      expect(trash.getAttribute("title")).toBe("Supprimer l’enregistrement");
      fireEvent.click(trash);
      expect(window.confirm).toHaveBeenCalledWith(expect.stringContaining("Chapitre second"));
      await waitFor(() => expect(screen.queryByRole("button", { name: /2\. Chapitre second/ })).toBeNull());
      expect(deleteLibraryAudioTrack).toHaveBeenCalledExactlyOnceWith("first", 2, "C:/Exports");
      expect(screen.getByRole("button", { name: /1\. Chapitre premier/ })).toBeTruthy();
      expect(screen.getAllByText(/1 piste gravée/)).toHaveLength(2);
    });

    it("deletes nothing when the confirmation is refused", async () => {
      await addBook("first", "Premier Livre", tracks("first"));
      vi.spyOn(window, "confirm").mockReturnValue(false);
      render(<DiscothequeView deck={null} exportDirectory="C:/Exports" onPlay={vi.fn()} />);
      fireEvent.click(await screen.findByRole("button", { name: "Supprimer l’enregistrement Chapitre premier" }));
      fireEvent.click(screen.getByRole("button", { name: "Supprimer l’album" }));
      expect(deleteLibraryAudioTrack).not.toHaveBeenCalled();
      expect(screen.getByRole("button", { name: /1\. Chapitre premier/ })).toBeTruthy();
    });

    it("deletes every track of the album and empties the shelf", async () => {
      await addBook("first", "Premier Livre", tracks("first"));
      vi.spyOn(window, "confirm").mockReturnValue(true);
      vi.mocked(deleteLibraryAudioTrack).mockImplementation(eraseTrack);
      render(<DiscothequeView deck={null} exportDirectory="C:/Exports" onPlay={vi.fn()} />);
      fireEvent.click(await screen.findByRole("button", { name: "Supprimer l’album" }));
      expect(await screen.findByText("Aucun disque gravé dans l’atelier.")).toBeTruthy();
      expect(vi.mocked(deleteLibraryAudioTrack).mock.calls.map(([, index]) => index)).toEqual([1, 2]);
    });

    it("keeps what was erased and reports the failure when the album deletion stops midway", async () => {
      await addBook("first", "Premier Livre", tracks("first"));
      vi.spyOn(window, "confirm").mockReturnValue(true);
      vi.mocked(deleteLibraryAudioTrack).mockImplementationOnce(eraseTrack).mockRejectedValueOnce("Suppression refusée : fichier verrouillé.");
      render(<DiscothequeView deck={null} exportDirectory="C:/Exports" onPlay={vi.fn()} />);
      fireEvent.click(await screen.findByRole("button", { name: "Supprimer l’album" }));
      expect((await screen.findByRole("alert")).textContent).toBe("Suppression refusée : fichier verrouillé.");
      expect(screen.queryByRole("button", { name: /1\. Chapitre premier/ })).toBeNull();
      expect(screen.getByRole("button", { name: /2\. Chapitre second/ })).toBeTruthy();
    });

    it("disables deletion until an export folder is chosen", async () => {
      await addBook("first", "Premier Livre", tracks("first"));
      render(<DiscothequeView deck={null} onPlay={vi.fn()} />);
      expect((await screen.findByRole("button", { name: "Supprimer l’enregistrement Chapitre premier" }) as HTMLButtonElement).disabled).toBe(true);
      expect((screen.getByRole("button", { name: "Supprimer l’album" }) as HTMLButtonElement).disabled).toBe(true);
    });
  });
});
