import { useState } from "react";
import { Play, Plus, Trash2 } from "lucide-react";
import type { AudioVoice, CastingRoleKind } from "../../types";
import { DIALOGUE_ROLE, NARRATOR_ROLE, type useVoiceCasting } from "./useVoiceCasting";

interface VoiceChoirProps {
  voices: AudioVoice[];
  defaultVoiceId: string;
  previewingId: string | null;
  previewError: string | null;
  onPreview: (voiceId: string) => void;
  casting: ReturnType<typeof useVoiceCasting>;
  hasBook: boolean;
}

const fieldClass = "w-full min-w-0 rounded-sm border border-[#6b5327] bg-[#13110f] px-2 py-1.5 text-sm text-[#f3f0ea] focus:border-[#d4af37] focus:outline-hidden disabled:opacity-50";
const goldButton = "flex shrink-0 items-center gap-1 rounded-sm border border-[#6b5327] px-2 py-1 font-cinzel text-[10px] tracking-wider text-[#d4af37] uppercase hover:border-[#d4af37] disabled:opacity-50";

export const VoiceChoir = ({ voices, defaultVoiceId, previewingId, previewError, onPreview, casting, hasBook }: VoiceChoirProps) => {
  const [newName, setNewName] = useState("");
  const locked = !hasBook || casting.saving || voices.length === 0;
  const voiceOptions = (placeholder?: string) => (
    <>
      {placeholder && <option value="">{placeholder}</option>}
      {voices.map((voice) => <option key={voice.id} value={voice.id}>{voice.name}</option>)}
    </>
  );
  const fixedRow = (role: string, kind: CastingRoleKind, hint: string) => (
    <tr key={kind} className="border-t border-[#2e261c]">
      <th scope="row" className="py-2 pr-3 text-left align-top font-serif text-sm font-normal text-[#f3f0ea]">{role}<span className="block text-xs text-[#8c8275]">{hint}</span></th>
      <td className="py-2">
        <select aria-label={`Voix du rôle ${role}`} value={casting.voiceOf(role, kind)} disabled={locked} onChange={(event) => { void casting.assign(role, kind, event.target.value); }} className={fieldClass}>
          {voiceOptions("Voix par défaut du Chœur")}
        </select>
      </td>
      <td />
    </tr>
  );
  const submit = () => {
    void casting.addCharacter(newName, defaultVoiceId || voices[0]?.id || "").then(() => setNewName(""));
  };

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <ul aria-label="Voix disponibles" className="grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-3">
        {voices.map((voice) => (
          <li key={voice.id} className="flex items-center gap-3 rounded-sm border border-[#3a2f1d] bg-[#1a1612] px-3 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="truncate font-serif text-sm text-[#f3f0ea]">{voice.name}</p>
              {voice.language && <p className="text-xs text-[#8c8275]">{voice.language}</p>}
            </div>
            <button type="button" aria-label={`Écouter la voix ${voice.name}`} disabled={previewingId !== null} onClick={() => onPreview(voice.id)} className={goldButton}>
              <Play size={12} /> {previewingId === voice.id ? "Lecture…" : "Écouter"}
            </button>
          </li>
        ))}
      </ul>
      {previewError && <p role="alert" className="text-xs text-[#d28b75]">{previewError}</p>}

      <section aria-labelledby="casting-title" className="flex flex-col gap-2">
        <h3 id="casting-title" className="font-cinzel text-xs tracking-wider text-[#d4af37] uppercase">Distribution des rôles</h3>
        {!hasBook && <p className="font-serif text-sm text-[#a99a83]">Sans livre, la distribution des rôles reste en attente : elle se compose livre par livre.</p>}
        <table className="w-full border-collapse">
          <thead className="sr-only"><tr><th scope="col">Rôle</th><th scope="col">Voix</th><th scope="col">Action</th></tr></thead>
          <tbody>
            {fixedRow(NARRATOR_ROLE, "narrator", "Texte courant")}
            {fixedRow(DIALOGUE_ROLE, "unattributed-dialogue", "Répliques sans personnage nommé")}
            {casting.characters.map((character) => (
              <tr key={character.role} className="border-t border-[#2e261c]">
                <th scope="row" className="py-2 pr-3 text-left font-serif text-sm font-normal text-[#f3f0ea]">{character.role}</th>
                <td className="py-2">
                  <select aria-label={`Voix du personnage ${character.role}`} value={character.voiceId} disabled={locked} onChange={(event) => { void casting.assign(character.role, "character", event.target.value); }} className={fieldClass}>
                    {voiceOptions()}
                  </select>
                </td>
                <td className="py-2 pl-2 text-right">
                  <button type="button" aria-label={`Retirer le personnage ${character.role}`} disabled={locked} onClick={() => { void casting.removeCharacter(character.role); }} className="p-1 text-[#a99a83] hover:text-[#d28b75] disabled:opacity-50"><Trash2 size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <form className="flex gap-2" onSubmit={(event) => { event.preventDefault(); submit(); }}>
          <input aria-label="Nom du personnage" value={newName} disabled={locked} onChange={(event) => setNewName(event.target.value)} placeholder="Nom du personnage" className={fieldClass} />
          <button type="submit" disabled={locked || !newName.trim()} className={goldButton}><Plus size={12} /> Ajouter</button>
        </form>
        {casting.error && <p role="alert" className="text-xs text-[#d28b75]">{casting.error}</p>}
      </section>
    </div>
  );
};
