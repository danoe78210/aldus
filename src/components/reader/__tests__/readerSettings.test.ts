import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_READER_SETTINGS, loadReaderSettings, sanitizeReaderSettings, saveReaderSettings } from "../readerSettings";

afterEach(() => localStorage.clear());

describe("readerSettings", () => {
  it("falls back to defaults for missing or malformed values", () => {
    expect(sanitizeReaderSettings(null)).toEqual(DEFAULT_READER_SETTINGS);
    expect(sanitizeReaderSettings({ theme: "neon", font: 3, flow: "x", fontSize: "big" })).toEqual(DEFAULT_READER_SETTINGS);
  });

  it("clamps numeric settings to the ranges of the drawer", () => {
    const settings = sanitizeReaderSettings({ fontSize: 99, lineHeight: 0.2, pdfZoom: 10 });
    expect([settings.fontSize, settings.lineHeight, settings.pdfZoom]).toEqual([24, 1.4, 3]);
    expect(sanitizeReaderSettings({ fontSize: 3 }).fontSize).toBe(12);
  });

  it("round-trips through localStorage and survives corrupt storage", () => {
    saveReaderSettings({ ...DEFAULT_READER_SETTINGS, theme: "atelier", fontSize: 21 });
    expect(loadReaderSettings()).toMatchObject({ theme: "atelier", fontSize: 21 });
    localStorage.setItem("aldus-reader-settings", "{not json");
    expect(loadReaderSettings()).toEqual(DEFAULT_READER_SETTINGS);
  });
});
