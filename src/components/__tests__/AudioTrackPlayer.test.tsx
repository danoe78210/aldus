import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { AudioTrackPlayer } from "../AudioTrackPlayer";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("AudioTrackPlayer", () => {
  it("plays the native MP3, formats elapsed/total time and seeks with its slider", async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
    render(<AudioTrackPlayer src="asset://localhost/chapter.mp3" title="Chapitre premier" />);
    const audio = screen.getByLabelText("Écouter Chapitre premier") as HTMLAudioElement;
    Object.defineProperty(audio, "duration", { configurable: true, value: 125 });
    Object.defineProperty(audio, "currentTime", { configurable: true, writable: true, value: 65 });
    fireEvent.loadedMetadata(audio);
    fireEvent.timeUpdate(audio);
    expect(screen.getByText("1:05")).toBeTruthy();
    expect(screen.getByText("2:05")).toBeTruthy();

    const slider = screen.getByRole("slider", { name: "Position de lecture Chapitre premier" }) as HTMLInputElement;
    fireEvent.change(slider, { target: { value: "90" } });
    expect(slider.value).toBe("90");
    expect(audio.currentTime).toBe(90);

    fireEvent.click(screen.getByRole("button", { name: "Lire Chapitre premier" }));
    expect(play).toHaveBeenCalledOnce();
  });
});