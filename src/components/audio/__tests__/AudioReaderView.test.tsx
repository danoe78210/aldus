import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { AudioReaderView } from "../AudioReaderView";
import type { AudioChapter } from "../../../types";
import { addLibraryBook, libraryCoverUrl } from "../../../utils/libraryApi";

vi.mock("../../../utils/libraryApi", async (importOriginal) => ({
  ...await importOriginal<typeof import("../../../utils/libraryApi")>(),
  libraryCoverUrl: vi.fn(),
}));

beforeEach(() => {
  localStorage.clear();
  vi.mocked(libraryCoverUrl).mockImplementation((path) => `asset://${path}`);
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const edition = (chapters: AudioChapter[]) => ({ engine: "http://127.0.0.1:8020", voiceId: "fr-narrator", voiceName: "Narrateur français", generatedAt: 1, chapters });
const burn: AudioChapter["burn"] = { burnedAt: Date.UTC(2026, 9, 20, 12), durationSeconds: 125, mode: "polyphonic", roles: [{ role: "Narrateur", kind: "narrator", voiceId: "fr-narrator", lines: 4 }, { role: "Élise", kind: "character", voiceId: "fr-narrator", lines: 2 }] };
const tracks = (slug: string): AudioChapter[] => [
  { index: 1, title: "Chapitre premier", path: `C:/Audio/${slug}/001.mp3`, burn },
  { index: 2, title: "Chapitre second", path: `C:/Audio/${slug}/002.mp3` },
];

const addBook = (id: string, title: string, chapters?: AudioChapter[]) =>
  addLibraryBook({ id, title, shelfId: "in_progress", files: [{ path: `C:/Exports/${id}.epub`, format: "epub" }], ...(chapters ? { audio: edition(chapters) } : {}) });

const tape = () => screen.getByLabelText(/^Bande /) as HTMLAudioElement;
const setClock = (audio: HTMLAudioElement, currentTime: number, duration: number) => {
  Object.defineProperty(audio, "duration", { configurable: true, value: duration });
  Object.defineProperty(audio, "currentTime", { configurable: true, writable: true, value: currentTime });
  fireEvent.loadedMetadata(audio);
  fireEvent.timeUpdate(audio);
};

describe("AudioReaderView", () => {
  it("shows a graceful empty state pointing to the Studio Audio", async () => {
    await addBook("silent", "Le Roman muet");
    const onOpenStudio = vi.fn();
    render(<AudioReaderView onOpenStudio={onOpenStudio} />);
    expect(await screen.findByText("Aucun disque gravé dans l’atelier.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ouvrir le Studio Audio" }));
    expect(onOpenStudio).toHaveBeenCalledOnce();
    expect(screen.queryByLabelText(/^Bande /)).toBeNull();
  });

  it("offers one disc per burnt book, opening the active book first with its first track on the tape", async () => {
    await addBook("silent", "Le Roman muet");
    await addBook("first", "Premier Livre", tracks("first"));
    await addBook("second", "Second Livre", tracks("second"));
    render(<AudioReaderView currentBookTitle="second livre" />);
    await screen.findByRole("button", { name: "Disque Second Livre" });
    expect(screen.queryByRole("button", { name: "Disque Le Roman muet" })).toBeNull();
    expect((screen.getByRole("button", { name: "Disque Second Livre" })).getAttribute("aria-pressed")).toBe("true");
    expect(tape().getAttribute("src")).toBe("asset://C:/Audio/second/001.mp3");

    fireEvent.click(screen.getByRole("button", { name: "Disque Premier Livre" }));
    expect(screen.getByRole("button", { name: "Disque Premier Livre" }).getAttribute("aria-pressed")).toBe("true");
    expect(tape().getAttribute("src")).toBe("asset://C:/Audio/first/001.mp3");
  });

  it("lists the burnt tracks with their burn details and loads the chosen one on the tape", async () => {
    await addBook("first", "Premier Livre", tracks("first"));
    render(<AudioReaderView />);
    const list = within(await screen.findByRole("list", { name: "Pistes gravées" }));
    expect(list.getByText(/2:05 · polyphonie · Narrateur ×4, Élise ×2/)).toBeTruthy();
    expect(list.getByRole("button", { name: /1\. Chapitre premier/ }).getAttribute("aria-current")).toBe("true");

    fireEvent.click(list.getByRole("button", { name: /2\. Chapitre second/ }));
    expect(tape().getAttribute("src")).toBe("asset://C:/Audio/first/002.mp3");
    expect(tape().autoplay).toBe(false);
    expect(list.getByRole("button", { name: /2\. Chapitre second/ }).getAttribute("aria-current")).toBe("true");
  });

  it("drives the transport: counter, play/pause with spinning reels, scrubbing, skips and volume", async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
    await addBook("first", "Premier Livre", tracks("first"));
    render(<AudioReaderView />);
    await screen.findByLabelText("Bande Chapitre premier");
    const counter = screen.getByLabelText("Compteur de bande");
    expect(counter.textContent).toBe("00:00 / 00:00");
    expect((screen.getByRole("button", { name: "Piste précédente" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "Piste suivante" }) as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getAllByTestId("reel").every((reel) => reel.getAttribute("data-spinning") === "false")).toBe(true);

    const audio = tape();
    setClock(audio, 65, 125);
    expect(counter.textContent).toBe("01:05 / 02:05");

    fireEvent.click(screen.getByRole("button", { name: "Lecture" }));
    expect(play).toHaveBeenCalledOnce();
    fireEvent.play(audio);
    expect(screen.getByRole("button", { name: "Pause" })).toBeTruthy();
    expect(screen.getAllByTestId("reel").every((reel) => reel.getAttribute("data-spinning") === "true")).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Avancer de 15 secondes" }));
    expect(audio.currentTime).toBe(80);
    fireEvent.click(screen.getByRole("button", { name: "Reculer de 15 secondes" }));
    fireEvent.click(screen.getByRole("button", { name: "Reculer de 15 secondes" }));
    expect(audio.currentTime).toBe(50);
    fireEvent.change(screen.getByRole("slider", { name: "Position de la bande" }), { target: { value: "100" } });
    expect(audio.currentTime).toBe(100);
    fireEvent.click(screen.getByRole("button", { name: "Avancer de 15 secondes" }));
    expect(audio.currentTime).toBe(115);
    fireEvent.click(screen.getByRole("button", { name: "Avancer de 15 secondes" }));
    expect(audio.currentTime).toBe(125);

    fireEvent.change(screen.getByRole("slider", { name: "Volume" }), { target: { value: "0.4" } });
    expect(audio.volume).toBeCloseTo(0.4);

    fireEvent.pause(audio);
    expect(screen.getByRole("button", { name: "Lecture" })).toBeTruthy();
    expect(screen.getAllByTestId("reel").every((reel) => reel.getAttribute("data-spinning") === "false")).toBe(true);
  });

  it("chains to the next track keeping the tape running, and never past the last one", async () => {
    await addBook("first", "Premier Livre", tracks("first"));
    render(<AudioReaderView />);
    await screen.findByLabelText("Bande Chapitre premier");
    fireEvent.play(tape());
    fireEvent.click(screen.getByRole("button", { name: "Piste suivante" }));
    expect(screen.getByLabelText("Bande Chapitre second")).toBeTruthy();
    expect(tape().autoplay).toBe(true);
    expect((screen.getByRole("button", { name: "Piste suivante" }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Piste précédente" }));
    expect(screen.getByLabelText("Bande Chapitre premier")).toBeTruthy();
    expect(tape().autoplay).toBe(false);

    fireEvent.play(tape());
    fireEvent.ended(tape());
    expect(screen.getByLabelText("Bande Chapitre second")).toBeTruthy();
    expect(tape().autoplay).toBe(true);
  });

  it("stops the tape when the view is unmounted", async () => {
    const pause = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
    await addBook("first", "Premier Livre", tracks("first"));
    const view = render(<AudioReaderView />);
    await screen.findByLabelText("Bande Chapitre premier");
    pause.mockClear();
    view.unmount();
    await waitFor(() => expect(pause).toHaveBeenCalled());
  });
});
