export type ReaderThemeId = "velin" | "parchemin" | "atelier";
export type ReaderFontId = "literata" | "garamond" | "merriweather" | "system";
export type ReaderFlow = "paged" | "continuous";
export type ReaderWidth = "comfort" | "full";
export type PdfView = "single" | "double";

export interface ReaderTheme {
  id: ReaderThemeId;
  label: string;
  background: string;
  text: string;
  accent: string;
}

export const READER_THEMES: ReaderTheme[] = [
  { id: "velin", label: "Vélin vénitien", background: "#f5f0e6", text: "#2c251e", accent: "#8a6a1f" },
  { id: "parchemin", label: "Parchemin doux", background: "#ede4cf", text: "#231c16", accent: "#8a6a1f" },
  { id: "atelier", label: "Dark Atelier", background: "#121110", text: "#f0ece1", accent: "#d4af37" },
];

export const READER_FONTS: { id: ReaderFontId; label: string; family: string }[] = [
  { id: "literata", label: "Literata", family: '"Literata", Georgia, serif' },
  { id: "garamond", label: "EB Garamond", family: '"EB Garamond", Garamond, Georgia, serif' },
  { id: "merriweather", label: "Merriweather", family: '"Merriweather", Georgia, serif' },
  { id: "system", label: "System Serif", family: 'ui-serif, Georgia, "Times New Roman", serif' },
];

export const FONT_SIZE_RANGE = { min: 12, max: 24, step: 1 } as const;
export const PDF_ZOOM_RANGE = { min: 0.5, max: 3, step: 0.05 } as const;
export const LINE_HEIGHT_RANGE = { min: 1.4, max: 2.0, step: 0.05 } as const;

export interface ReaderSettings {
  theme: ReaderThemeId;
  font: ReaderFontId;
  fontSize: number;
  lineHeight: number;
  width: ReaderWidth;
  flow: ReaderFlow;
  pdfView: PdfView;
  /** Zoom du PDF relatif à l'ajustement en largeur (1 = page ajustée). */
  pdfZoom: number;
}

export const DEFAULT_READER_SETTINGS: ReaderSettings = {
  theme: "velin",
  font: "literata",
  fontSize: 18,
  lineHeight: 1.7,
  width: "comfort",
  flow: "paged",
  pdfView: "single",
  pdfZoom: 1,
};

const STORAGE_KEY = "aldus-reader-settings";

const clamp = (value: unknown, min: number, max: number, fallback: number): number =>
  typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;

const oneOf = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback;

export const sanitizeReaderSettings = (raw: unknown): ReaderSettings => {
  const source = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const defaults = DEFAULT_READER_SETTINGS;
  return {
    theme: oneOf(source.theme, READER_THEMES.map((theme) => theme.id), defaults.theme),
    font: oneOf(source.font, READER_FONTS.map((font) => font.id), defaults.font),
    fontSize: clamp(source.fontSize, FONT_SIZE_RANGE.min, FONT_SIZE_RANGE.max, defaults.fontSize),
    lineHeight: clamp(source.lineHeight, LINE_HEIGHT_RANGE.min, LINE_HEIGHT_RANGE.max, defaults.lineHeight),
    width: oneOf(source.width, ["comfort", "full"] as const, defaults.width),
    flow: oneOf(source.flow, ["paged", "continuous"] as const, defaults.flow),
    pdfView: oneOf(source.pdfView, ["single", "double"] as const, defaults.pdfView),
    pdfZoom: clamp(source.pdfZoom, PDF_ZOOM_RANGE.min, PDF_ZOOM_RANGE.max, defaults.pdfZoom),
  };
};

export const loadReaderSettings = (): ReaderSettings => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return sanitizeReaderSettings(stored ? JSON.parse(stored) : null);
  } catch {
    return DEFAULT_READER_SETTINGS;
  }
};

export const saveReaderSettings = (settings: ReaderSettings): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (reason) {
    console.warn("Réglages du Lecteur d'Atelier non conservés :", reason);
  }
};
