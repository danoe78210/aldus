import type { AudioChapter } from "../../types";

const formatClock = (seconds: number): string => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

/** Résumé d'une gravure : date, durée et mode (voix unique ou polyphonie et distribution). */
export const burnDetails = ({ burn }: AudioChapter): string | null => burn
  ? [
      new Date(burn.burnedAt).toLocaleDateString("fr-FR"),
      burn.durationSeconds !== undefined ? formatClock(burn.durationSeconds) : null,
      burn.mode === "polyphonic" ? `polyphonie · ${burn.roles.map((entry) => `${entry.role} ×${entry.lines}`).join(", ")}` : "voix unique",
    ].filter(Boolean).join(" · ")
  : null;
