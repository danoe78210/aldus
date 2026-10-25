import { useState } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AudioReaderView } from "../AudioReaderView";
import type { AudioChapter, DeckSelection } from "../../../types";
import { addLibraryBook, libraryCoverUrl } from "../../../utils/libraryApi";

vi.mock("../../../utils/libraryApi", async (importOriginal) => ({
  ...await importOriginal<typeof import("../../../utils/libraryApi")>(),
  libraryCoverUrl: vi.fn(),
}));

const node = () => ({ connect: vi.fn(), disconnect: vi.fn() });
const rig = { levels: [0, 0], analysers: [] as { fftSize: number; smoothingTimeConstant: number }[], source: node(), destination: {}, state: "suspended", resume: vi.fn() };
class FakeAudioContext {
  destination = rig.destination;
  get state() { return rig.state; }
  resume = () => { rig.resume(); rig.state = "running"; return Promise.resolve(); };
  createMediaElementSource = () => { rig.source = node(); return rig.source; };
  createGain = () => ({ ...node(), channelCount: 0, channelCountMode: "", channelInterpretation: "" });
  createChannelSplitter = () => node();
  createAnalyser = () => {
    const channel = rig.analysers.length;
    const analyser = { ...node(), fftSize: 0, smoothingTimeConstant: 0, getByteTimeDomainData: (buffer: Uint8Array) => buffer.fill(128 + Math.round(rig.levels[channel] * 127)) };
    rig.analysers.push(analyser);
    return analyser;
  };
}

let frames = new Map<number, FrameRequestCallback>();
let clock = 0;
let frameId = 0;
const advance = (milliseconds: number) => {
  for (let elapsed = 0; elapsed < milliseconds; elapsed += 16) {
    clock += 16;
    const pending = [...frames.values()];
    frames = new Map();
    pending.forEach((callback) => callback(clock));
  }
};
const angles = () => screen.getAllByTestId("vu-needle").map((needle) => Number(/rotate\((-?[\d.]+)deg\)/.exec(needle.style.transform)?.[1]));

beforeEach(() => {
  Object.assign(rig, { levels: [0, 0], analysers: [], state: "suspended" });
  rig.resume.mockClear();
  clock = 1000;
  frames = new Map();
  vi.stubGlobal("AudioContext", FakeAudioContext);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { frames.set(++frameId, callback); return frameId; });
  vi.stubGlobal("cancelAnimationFrame", (id: number) => frames.delete(id));
  vi.spyOn(performance, "now").mockImplementation(() => clock);
  localStorage.clear();
  vi.mocked(libraryCoverUrl).mockImplementation((path) => `asset://${path}`);
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
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

const Reader = ({ initial = null, ...props }: { initial?: DeckSelection | null; currentBookTitle?: string; onOpenStudio?: () => void; onOpenDiscotheque?: () => void }) => {
  const [deck, setDeck] = useState<DeckSelection | null>(initial);
  return <AudioReaderView {...props} deck={deck} onDeckChange={setDeck} />;
};

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
    render(<Reader onOpenStudio={onOpenStudio} />);
    expect(await screen.findByText("Aucun disque gravé dans l’atelier.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Ouvrir le Studio Audio" }));
    expect(onOpenStudio).toHaveBeenCalledOnce();
    expect(screen.queryByLabelText(/^Bande /)).toBeNull();
  });

  it("puts the deck's disc and track on the tape, with the album and chapter shown above the machine", async () => {
    await addBook("silent", "Le Roman muet");
    await addBook("first", "Premier Livre", tracks("first"));
    await addBook("second", "Second Livre", tracks("second"));
    render(<Reader initial={{ bookId: "first", chapterIndex: 2, autoPlay: false }} currentBookTitle="second livre" />);
    await screen.findByLabelText("Bande Chapitre second");
    expect(tape().getAttribute("src")).toBe("asset://C:/Audio/first/002.mp3");
    expect(screen.getByText("Premier Livre")).toBeTruthy();
    expect(screen.getByText("2. Chapitre second")).toBeTruthy();
    expect(screen.queryByRole("list", { name: "Pistes gravées" })).toBeNull();
  });

  it("falls back to the current book's disc when nothing sits on the deck, and links back to the discothèque", async () => {
    await addBook("first", "Premier Livre", tracks("first"));
    await addBook("second", "Second Livre", tracks("second"));
    const onOpenDiscotheque = vi.fn();
    render(<Reader currentBookTitle="second livre" onOpenDiscotheque={onOpenDiscotheque} />);
    await screen.findByLabelText("Bande Chapitre premier");
    expect(tape().getAttribute("src")).toBe("asset://C:/Audio/second/001.mp3");
    fireEvent.click(screen.getByRole("button", { name: "Retourner à la discothèque" }));
    expect(onOpenDiscotheque).toHaveBeenCalledOnce();
  });

  it("drives the transport: counter, play/pause with spinning reels, scrubbing, skips and volume", async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
    await addBook("first", "Premier Livre", tracks("first"));
    render(<Reader />);
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
    render(<Reader />);
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

  it("routes the tape through the speakers and one stereo analyser per channel, waking a suspended context", async () => {
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    await addBook("first", "Premier Livre", tracks("first"));
    render(<Reader />);
    await screen.findByLabelText("Bande Chapitre premier");
    expect(tape().crossOrigin).toBe("anonymous");
    expect(rig.analysers).toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: "Lecture" }));
    expect(rig.resume).toHaveBeenCalledOnce();
    expect(rig.source.connect).toHaveBeenCalledWith(rig.destination);
    expect(rig.analysers).toHaveLength(2);
    expect(rig.analysers.every((analyser) => analyser.fftSize === 512 && analyser.smoothingTimeConstant === 0.3)).toBe(true);
  });

  it("swings each needle with its own channel, with inertia, and eases back to rest after the pause", async () => {
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    await addBook("first", "Premier Livre", tracks("first"));
    render(<Reader />);
    await screen.findByLabelText("Bande Chapitre premier");
    expect(angles()).toEqual([-45, -45]);

    rig.levels = [0.1, 0.03];
    fireEvent.click(screen.getByRole("button", { name: "Lecture" }));
    fireEvent.play(tape());
    advance(16);
    const [attack] = angles();
    expect(attack).toBeGreaterThan(-45);
    advance(1000);
    const [left, right] = angles();
    expect(left).toBeGreaterThan(5);
    expect(left).toBeLessThanOrEqual(40);
    expect(right).toBeGreaterThan(-45);
    expect(right).toBeLessThan(left - 20);

    rig.levels = [0.1, 0.1];
    advance(1000);
    expect(Math.abs(angles()[0] - angles()[1])).toBeLessThan(0.5);

    fireEvent.pause(tape());
    advance(16);
    expect(angles()[0]).toBeGreaterThan(-45);
    advance(2000);
    expect(angles()).toEqual([-45, -45]);
    expect(frames.size).toBe(0);
  });

  it("disconnects the audio graph when the view is unmounted", async () => {
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    await addBook("first", "Premier Livre", tracks("first"));
    const view = render(<Reader />);
    await screen.findByLabelText("Bande Chapitre premier");
    fireEvent.click(screen.getByRole("button", { name: "Lecture" }));
    const { source } = rig;
    view.unmount();
    expect(source.disconnect).toHaveBeenCalled();
  });

  it("stops the tape when the view is unmounted", async () => {
    const pause = vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
    await addBook("first", "Premier Livre", tracks("first"));
    const view = render(<Reader />);
    await screen.findByLabelText("Bande Chapitre premier");
    pause.mockClear();
    view.unmount();
    await waitFor(() => expect(pause).toHaveBeenCalled());
  });
});
