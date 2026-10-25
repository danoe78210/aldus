import { useState } from "react";
import { Lock, Play, Plus, Trash2 } from "lucide-react";
import type { AudioVoice, CastingRoleKind, VoiceGender } from "../../types";
import { DIALOGUE_ROLE, NARRATOR_ROLE, type useVoiceCasting } from "./useVoiceCasting";
import { GENDER_LABELS, voiceGender, voicesForGender } from "./voiceGender";

interface VoiceInventoryProps {
  voices: AudioVoice[];
  previewingId: string | null;
  onPreview: (voiceId: string) => void;
}

interface RoleCastingProps {
  voices: AudioVoice[];
  defaultVoiceId: string;
  previewingId: string | null;
  onPreview: (voiceId: string) => void;
  casting: ReturnType<typeof useVoiceCasting>;
  hasBook: boolean;
}

const fieldClass = "w-full min-w-0 rounded-sm border border-[#6b5327] bg-[#13110f] px-3 py-2 text-sm text-[#f3f0ea] focus:border-[#d4af37] focus:outline-hidden disabled:opacity-50";
const goldButton = "flex shrink-0 items-center gap-1 rounded-sm border border-[#6b5327] px-2 py-1 font-cinzel text-[10px] tracking-wider text-[#d4af37] uppercase hover:border-[#d4af37] disabled:opacity-50";
const GENDERS = Object.keys(GENDER_LABELS) as VoiceGender[];

/** Feuillet gauche : catalogue des voix installées, avec écoute de la phrase témoin. */
export const VoiceInventory = ({ voices, previewingId, onPreview }: VoiceInventoryProps) => (
  <section aria-labelledby="inventory-title" className="flex flex-col gap-3">
    <h3 id="inventory-title" className="font-cinzel text-xs tracking-wider text-[#d4af37] uppercase">Inventaire des voix</h3>
    <ul aria-label="Voix disponibles" className="grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-3">
      {voices.map((voice) => (
        <li key={voice.id} className="flex items-center gap-3 rounded-sm border border-[#3a2f1d] bg-[#1a1612] px-3 py-2.5">
          <div className="min-w-0 flex-1">
            <p className="truncate font-serif text-sm text-[#f3f0ea]">{voice.name}</p>
            <p className="text-xs text-[#8c8275]">{[GENDER_LABELS[voiceGender(voice)], voice.language].filter(Boolean).join(" · ")}</p>
          </div>
          <button type="button" aria-label={`Écouter la voix ${voice.name}`} disabled={previewingId !== null} onClick={() => onPreview(voice.id)} className={goldButton}>
            <Play size={12} /> {previewingId === voice.id ? "Lecture…" : "Écouter"}
          </button>
        </li>
      ))}
    </ul>
  </section>
);

/** Feuillet droit : distribution des rôles du livre (Narrateur permanent, Dialogues génériques, personnages). */
export const RoleCasting = ({ voices, defaultVoiceId, previewingId, onPreview, casting, hasBook }: RoleCastingProps) => {
  const [newName, setNewName] = useState("");
  const [newGender, setNewGender] = useState<VoiceGender>("neutral");
  const [newVoice, setNewVoice] = useState("");
  const [genders, setGenders] = useState<Record<string, VoiceGender>>({});
  const locked = !hasBook || casting.saving || voices.length === 0;

  const genderOptions = () => GENDERS.map((gender) => <option key={gender} value={gender}>{GENDER_LABELS[gender]}</option>);
  const voiceOptions = (gender: VoiceGender, current: string, placeholder?: string) => {
    const matching = voicesForGender(voices, gender);
    const kept = current && !matching.some((voice) => voice.id === current) ? voices.find((voice) => voice.id === current) : undefined;
    return (
      <>
        {placeholder && <option value="">{placeholder}</option>}
        {matching.length === 0 && !kept && <option value="" disabled>Aucune voix {GENDER_LABELS[gender].toLocaleLowerCase("fr")}</option>}
        {[...(kept ? [kept] : []), ...matching].map((voice) => <option key={voice.id} value={voice.id}>{voice.name}</option>)}
      </>
    );
  };
  const audition = (label: string, voiceId: string) => (
    <button type="button" aria-label={`Écouter le timbre ${label}`} disabled={previewingId !== null || !voiceId} onClick={() => onPreview(voiceId)} className={goldButton}>
      <Play size={12} /> {previewingId !== null && previewingId === voiceId ? "Lecture…" : "Écouter"}
    </button>
  );

  const roleRow = (role: string, kind: CastingRoleKind, label: string, hint: string, placeholder?: string) => {
    const key = `${kind}|${role}`;
    const voiceId = casting.voiceOf(role, kind);
    const assigned = voices.find((voice) => voice.id === voiceId);
    const gender = genders[key] ?? (assigned ? voiceGender(assigned) : "neutral");
    const pickGender = (next: VoiceGender) => {
      setGenders((previous) => ({ ...previous, [key]: next }));
      const fits = voicesForGender(voices, next);
      if (voiceId && !fits.some((voice) => voice.id === voiceId) && fits[0]) void casting.assign(role, kind, fits[0].id);
    };
    return (
      <li key={key} className="flex flex-col gap-3 rounded-sm border border-[#3a2f1d] bg-[#15120f] p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 font-serif text-base text-[#f3f0ea]">{role}{kind === "narrator" && <Lock size={12} aria-label="Rôle permanent" className="text-[#c5a059]" />}</p>
            {hint && <p className="text-xs text-[#8c8275]">{hint}</p>}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {audition(label, voiceId || defaultVoiceId)}
            {kind === "character" && <button type="button" aria-label={`Retirer le personnage ${role}`} disabled={locked} onClick={() => { void casting.removeCharacter(role); }} className="p-1 text-[#a99a83] hover:text-[#d28b75] disabled:opacity-50"><Trash2 size={14} /></button>}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <select aria-label={`Genre ${label}`} value={gender} disabled={locked} onChange={(event) => pickGender(event.target.value as VoiceGender)} className={fieldClass}>{genderOptions()}</select>
          <select aria-label={`Voix ${label}`} value={voiceId} disabled={locked} onChange={(event) => { void casting.assign(role, kind, event.target.value); }} className={fieldClass}>
            {voiceOptions(gender, voiceId, placeholder)}
          </select>
        </div>
      </li>
    );
  };

  const candidates = voicesForGender(voices, newGender);
  const chosenVoice = candidates.find((voice) => voice.id === newVoice)?.id ?? candidates.find((voice) => voice.id === defaultVoiceId)?.id ?? candidates[0]?.id ?? "";
  const submit = () => {
    void casting.addCharacter(newName, chosenVoice).then(() => setNewName(""));
  };

  return (
    <section aria-labelledby="casting-title" className="flex min-w-0 flex-col gap-3">
      <h3 id="casting-title" className="font-cinzel text-xs tracking-wider text-[#d4af37] uppercase">Distribution des rôles</h3>
      {!hasBook && <p className="font-serif text-sm text-[#a99a83]">Sans livre, la distribution des rôles reste en attente : elle se compose livre par livre.</p>}
      <ul aria-label="Rôles du livre" className="flex flex-col gap-3">
        {roleRow(NARRATOR_ROLE, "narrator", `du rôle ${NARRATOR_ROLE}`, "Rôle permanent · voix maîtresse du livre et voix de repli de toute réplique orpheline", "Voix par défaut du moteur")}
        {roleRow(DIALOGUE_ROLE, "unattributed-dialogue", `du rôle ${DIALOGUE_ROLE}`, "Répliques sans personnage nommé", "Voix du Narrateur")}
        {casting.characters.map((character) => roleRow(character.role, "character", `du personnage ${character.role}`, ""))}
      </ul>
      <form aria-label="Nouveau personnage" className="flex flex-col gap-3 rounded-sm border border-dashed border-[#6b5327] p-4" onSubmit={(event) => { event.preventDefault(); submit(); }}>
        <input aria-label="Nom du personnage" value={newName} disabled={locked} onChange={(event) => setNewName(event.target.value)} placeholder="Nom du personnage" className={fieldClass} />
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <select aria-label="Genre du nouveau personnage" value={newGender} disabled={locked} onChange={(event) => setNewGender(event.target.value as VoiceGender)} className={fieldClass}>{genderOptions()}</select>
          <select aria-label="Voix du nouveau personnage" value={chosenVoice} disabled={locked} onChange={(event) => setNewVoice(event.target.value)} className={fieldClass}>{voiceOptions(newGender, "")}</select>
        </div>
        <div className="flex items-center justify-end gap-2">
          {audition("du nouveau personnage", chosenVoice)}
          <button type="submit" disabled={locked || !newName.trim() || !chosenVoice} className={goldButton}><Plus size={12} /> Ajouter</button>
        </div>
      </form>
      {casting.error && <p role="alert" className="text-xs text-[#d28b75]">{casting.error}</p>}
    </section>
  );
};
