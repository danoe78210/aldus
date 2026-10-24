import { useCallback, useState } from "react";
import type { CastingRoleKind, CharacterVoiceMapping, LibraryConfig, VoiceCasting } from "../../types";
import { saveVoiceCasting } from "../../utils/libraryApi";

export const NARRATOR_ROLE = "Narrateur";
export const DIALOGUE_ROLE = "Dialogues";

const messageOf = (reason: unknown): string =>
  typeof reason === "string" ? reason : reason instanceof Error ? reason.message : "Distribution des voix impossible à enregistrer.";

/** Distribution des voix d'un livre ; chaque modification est persistée dans son édition audio. */
export const useVoiceCasting = (bookId: string | undefined, saved: VoiceCasting | undefined, onSaved: (config: LibraryConfig) => void) => {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mappings = saved?.mappings ?? [];

  const persist = useCallback((next: CharacterVoiceMapping[]) => {
    if (!bookId) return Promise.resolve();
    setSaving(true);
    setError(null);
    return saveVoiceCasting(bookId, { mappings: next })
      .then(onSaved)
      .catch((reason: unknown) => setError(messageOf(reason)))
      .finally(() => setSaving(false));
  }, [bookId, onSaved]);

  const voiceOf = (role: string, kind: CastingRoleKind): string =>
    mappings.find((mapping) => mapping.kind === kind && mapping.role === role)?.voiceId ?? "";

  const assign = (role: string, kind: CastingRoleKind, voiceId: string) => {
    const others = mappings.filter((mapping) => !(mapping.kind === kind && mapping.role === role));
    return persist(voiceId ? [...others, { role, kind, voiceId }] : others);
  };

  const addCharacter = (name: string, voiceId: string) => {
    const role = name.trim();
    if (!role || !voiceId) return Promise.resolve();
    if (mappings.some((mapping) => mapping.kind === "character" && mapping.role.toLocaleLowerCase("fr") === role.toLocaleLowerCase("fr"))) {
      setError(`Le personnage « ${role} » figure déjà dans la distribution.`);
      return Promise.resolve();
    }
    return assign(role, "character", voiceId);
  };

  return {
    mappings,
    characters: mappings.filter((mapping) => mapping.kind === "character"),
    saving,
    error,
    voiceOf,
    assign,
    addCharacter,
    removeCharacter: (role: string) => assign(role, "character", ""),
  };
};
