import { invokeCommand, isInvokeAvailable } from "../../utils/tauri";

export type SalonTheme = "atelier" | "velin";

export interface SalonBookmark {
  chapter: number;
  spread: number;
}

const THEME_KEY = "aldus-salon-theme";
const resumeKey = (bookId: string): string => `aldus-salon-resume:${bookId}`;

const report = (message: string, reason: unknown): void => {
  const full = `${message} (${reason instanceof Error ? reason.message : String(reason)}).`;
  console.error(full);
  if (isInvokeAvailable()) void invokeCommand("log_frontend", { level: "error", message: full }).catch((cause) => console.error("Transmission au journal Aldus impossible :", cause));
};

const natural = (value: unknown): number => (typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : 0);

export const loadSalonTheme = (): SalonTheme => {
  try {
    return localStorage.getItem(THEME_KEY) === "velin" ? "velin" : "atelier";
  } catch (reason) {
    report("Salon de lecture : thème du papier illisible", reason);
    return "atelier";
  }
};

export const saveSalonTheme = (theme: SalonTheme): void => {
  try {
    localStorage.setItem(THEME_KEY, theme);
  } catch (reason) {
    report("Salon de lecture : thème du papier non conservé", reason);
  }
};

// shortcut: le signet de reprise vit dans le stockage local de l'application, non dans le fichier de signets du livre.
export const loadSalonBookmark = (bookId: string): SalonBookmark => {
  try {
    const stored = localStorage.getItem(resumeKey(bookId));
    const raw = (stored ? JSON.parse(stored) : {}) as Record<string, unknown>;
    return { chapter: natural(raw.chapter), spread: natural(raw.spread) };
  } catch (reason) {
    report("Salon de lecture : signet de reprise illisible", reason);
    return { chapter: 0, spread: 0 };
  }
};

export const saveSalonBookmark = (bookId: string, bookmark: SalonBookmark): void => {
  try {
    localStorage.setItem(resumeKey(bookId), JSON.stringify(bookmark));
  } catch (reason) {
    report("Salon de lecture : signet de reprise non conservé", reason);
  }
};
