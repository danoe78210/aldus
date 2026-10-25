import type { AudioChapter } from "../../types";
import { frenchCount } from "./frenchCount";

export const formatClock = (seconds: number): string => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

/** Résumé d'une gravure : date, durée et mode (voix unique ou polyphonie et distribution). */
export const burnDetails = ({ burn }: AudioChapter): string | null => burn
  ? [
      new Date(burn.burnedAt).toLocaleDateString("fr-FR"),
      burn.durationSeconds !== undefined ? formatClock(burn.durationSeconds) : null,
      burn.mode === "polyphonic" ? `polyphonie · ${burn.roles.map((entry) => `${entry.role} ×${entry.lines}`).join(", ")}` : "voix unique",
    ].filter(Boolean).join(" · ")
  : null;

/** Badge de mixage d'une piste gravée : « Mono » ou « Polyphonique · N voix ». */
export const mixBadge = ({ burn }: AudioChapter): string | null => burn
  ? burn.mode === "polyphonic" ? `Polyphonique · ${frenchCount(burn.roles.length, "voix", "voix")}` : "Mono"
  : null;

/** Durée cumulée des pistes dont la durée est connue, ou `null` si aucune ne l'est. */
export const albumDuration = (tracks: AudioChapter[]): string | null => {
  const known = tracks.flatMap(({ burn }) => burn?.durationSeconds ?? []);
  if (known.length === 0) return null;
  const total = known.reduce((sum, seconds) => sum + seconds, 0);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  return hours > 0
    ? `${hours} h ${String(minutes).padStart(2, "0")} min`
    : `${minutes} min ${String(total % 60).padStart(2, "0")} s`;
};

/** Badge de casting d'un album : polyphonie dès qu'une piste l'est (voix distinctes de tout l'album), sinon voix maîtresse. */
export const albumCasting = (tracks: AudioChapter[]): string | null => {
  const burns = tracks.flatMap(({ burn }) => burn ?? []);
  if (burns.length === 0) return null;
  const roles = new Set(burns.flatMap((burn) => burn.mode === "polyphonic" ? burn.roles.map((entry) => entry.role) : []));
  return roles.size > 0 ? `Polyphonique · ${frenchCount(roles.size, "voix", "voix")}` : "Mono · Voix maîtresse";
};
