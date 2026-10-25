import { useState } from "react";
import { Feather, Plus, Trash2, X } from "lucide-react";
import type { AudioVoice, CastingRoleKind, PodcastLine, ScriptRuleId } from "../../types";
import { frenchCount } from "./frenchCount";
import { DEFAULT_RULES } from "./podcastScript";
import type { usePodcastScript } from "./usePodcastScript";
import { DIALOGUE_ROLE, NARRATOR_ROLE, type useVoiceCasting } from "./useVoiceCasting";

type Podcast = ReturnType<typeof usePodcastScript>;
type Casting = ReturnType<typeof useVoiceCasting>;

const RULE_LABELS: Record<ScriptRuleId, { title: string; hint: string }> = {
  "strip-incises": { title: "Alléger les incises", hint: "Retire « dit-il », « s'écria-t-elle » des répliques." },
  "breath-pauses": { title: "Respirations", hint: "Normalise les points de suspension et les tirets cadratins." },
  "proper-nouns": { title: "Noms propres", hint: "Table de prononciation des noms du manuscrit." },
};

const fieldClass = "min-w-0 rounded-sm border border-[#6b5327] bg-[#13110f] px-2 py-1.5 text-sm text-[#f3f0ea] focus:border-[#d4af37] focus:outline-hidden disabled:opacity-50";
const goldButton = "flex shrink-0 items-center gap-1 rounded-sm border border-[#6b5327] px-2 py-1 font-cinzel text-[10px] tracking-wider text-[#d4af37] uppercase hover:border-[#d4af37] disabled:opacity-50";
const badgeTone: Record<CastingRoleKind, string> = {
  narrator: "border-[#6b5327] text-[#d4af37]",
  "unattributed-dialogue": "border-[#3f6a6e] text-[#9fd0d3]",
  character: "border-[#8a5a3a] text-[#e0a97c]",
};
const lineTone: Record<CastingRoleKind, string> = {
  narrator: "border-l-[#6b5327] bg-[#15120f]",
  "unattributed-dialogue": "border-l-[#3f6a6e] bg-[#12191a]",
  character: "border-l-[#8a5a3a] bg-[#1a1511]",
};

const roleKey = (kind: CastingRoleKind, role: string) => `${kind}|${role}`;

/** Règles de transformation appliquées au chapitre actif. */
export const PodcastRules = ({ podcast }: { podcast: Podcast }) => {
  const { script } = podcast;
  if (!script) return null;
  const transcribe = () => {
    if (podcast.edited && !window.confirm("Ce script contient des retouches manuelles : la transcription les écrasera. Continuer ?")) return;
    podcast.transcribe();
  };
  return (
    <>
      <fieldset className="flex flex-col gap-3">
        <legend className="sr-only">Règles de transformation</legend>
        {DEFAULT_RULES.map(({ id }) => {
          const rule = script.rules.find((candidate) => candidate.id === id);
          return (
            <label key={id} className="flex items-start gap-3 text-sm text-[#c9bea9]">
              <input type="checkbox" checked={rule?.enabled ?? false} onChange={() => podcast.toggleRule(id)} className="mt-1 accent-[#d4af37]" />
              <span>{RULE_LABELS[id].title}<span className="mt-0.5 block text-xs leading-relaxed text-[#8c8275]">{RULE_LABELS[id].hint}</span></span>
            </label>
          );
        })}
      </fieldset>
      <button type="button" onClick={transcribe} className="flex items-center justify-center gap-2 self-start rounded-sm border border-[#d4af37] bg-[#13110f] px-4 py-2 font-cinzel text-xs tracking-wider text-[#d4af37] uppercase transition-all hover:bg-[#211c15] hover:text-[#e6c85a] hover:shadow-[0_0_14px_rgb(212_175_55/30%)]"><Feather size={14} /> Transcrire en script podcast</button>
    </>
  );
};

/** Pupitre de montage : répliques éditables, réassignation de rôle et table de prononciation des noms propres. */
export const PodcastBench = ({ podcast, casting }: { podcast: Podcast; casting: Casting }) => {
  const [spoken, setSpoken] = useState("");
  const [name, setName] = useState("");
  const { script, substitutions } = podcast;
  const roles: { kind: CastingRoleKind; role: string }[] = [
    { kind: "narrator", role: NARRATOR_ROLE },
    { kind: "unattributed-dialogue", role: DIALOGUE_ROLE },
    ...casting.characters.map((character) => ({ kind: character.kind, role: character.role })),
  ];
  const addSubstitution = (entryName: string, entrySpoken: string) => {
    if (!entryName.trim() || !entrySpoken.trim()) return;
    podcast.setSubstitutions([...substitutions.filter((entry) => entry.name !== entryName.trim()), { name: entryName.trim(), spoken: entrySpoken.trim() }]);
    setName("");
    setSpoken("");
  };
  const reassign = (line: PodcastLine, value: string) => {
    const [kind, ...role] = value.split("|");
    podcast.editLine(line.source, { kind: kind as CastingRoleKind, role: role.join("|") });
  };

  if (podcast.loading) return <p role="status" className="font-serif text-sm text-[#a99a83]">Découpage du chapitre en répliques…</p>;
  if (podcast.error) return <p role="alert" className="text-xs text-[#d28b75]">{podcast.error}</p>;
  if (!script) return <p className="font-serif text-sm text-[#a99a83]">Choisissez un chapitre à adapter.</p>;

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <p className="font-cinzel text-xs tracking-wider text-[#c5a059] uppercase">{podcast.transcribed ? `Script adapté · ${frenchCount(script.lines.length, "réplique")}` : "Manuscrit non transcrit"}</p>
      {!podcast.transcribed && <p className="font-serif text-sm text-[#a99a83]">Réglez les règles de transformation, puis transcrivez le chapitre : ses répliques apparaîtront ici, prêtes à être retouchées.</p>}
      {podcast.saveError && <p role="alert" className="text-xs text-[#d28b75]">{podcast.saveError}</p>}
      {podcast.transcribed && <ol aria-label="Répliques du script" className="flex max-h-[34rem] flex-col gap-2 overflow-y-auto rounded-sm border border-[#2e261c] bg-[#13110f] p-2 pr-3">
        {script.lines.map((line, position) => {
          const current = roleKey(line.kind, line.role);
          const known = roles.some((role) => roleKey(role.kind, role.role) === current);
          return (
            <li key={line.source} className={`flex flex-col gap-1.5 rounded-sm border-l-2 p-2 ${lineTone[line.kind]}`}>
              <div className="flex items-center gap-2">
                <select aria-label={`Rôle de la réplique ${position + 1}`} value={current} onChange={(event) => reassign(line, event.target.value)} className={`${fieldClass} min-w-0 flex-1 max-w-60 text-xs ${badgeTone[line.kind]}`}>
                  {!known && <option value={current}>{line.role}</option>}
                  {roles.map((role) => <option key={roleKey(role.kind, role.role)} value={roleKey(role.kind, role.role)}>{role.role}</option>)}
                </select>
                <button type="button" aria-label={`Supprimer la réplique ${position + 1}`} onClick={() => podcast.editLine(line.source, { removed: true })} className="ml-auto p-1 text-[#a99a83] hover:text-[#d28b75]"><X size={14} /></button>
              </div>
              <textarea aria-label={`Texte de la réplique ${position + 1}`} value={line.text} rows={Math.max(1, Math.ceil(line.text.length / 60))} onChange={(event) => podcast.editLine(line.source, { text: event.target.value })} className={`${fieldClass} w-full resize-y font-serif ${line.kind === "narrator" ? "" : "italic"}`} />
            </li>
          );
        })}
      </ol>}
      {script.rules.find((rule) => rule.id === "proper-nouns")?.enabled && (
        <div className="flex flex-col gap-2 rounded-sm border border-[#2e261c] p-3">
          <h4 className="font-cinzel text-xs tracking-wider text-[#a99a83] uppercase">Table de prononciation</h4>
          {substitutions.map((entry) => (
            <p key={entry.name} className="flex items-center gap-2 text-sm text-[#f3f0ea]">
              <span>{entry.name} → {entry.spoken}</span>
              <button type="button" aria-label={`Retirer la prononciation de ${entry.name}`} onClick={() => podcast.setSubstitutions(substitutions.filter((other) => other.name !== entry.name))} className="p-1 text-[#a99a83] hover:text-[#d28b75]"><Trash2 size={12} /></button>
            </p>
          ))}
          {podcast.suggestions.length > 0 && (
            <p className="flex flex-wrap items-center gap-1.5 text-xs text-[#8c8275]">Noms&nbsp;détectés&nbsp;:
              {podcast.suggestions.map((suggestion) => (
                <button key={suggestion} type="button" onClick={() => setName(suggestion)} className="rounded-sm border border-[#3a2f1d] px-1.5 py-0.5 text-[#c5a059] hover:border-[#d4af37]">{suggestion}</button>
              ))}
            </p>
          )}
          <form className="flex flex-wrap gap-2" onSubmit={(event) => { event.preventDefault(); addSubstitution(name, spoken); }}>
            <input aria-label="Nom propre" value={name} onChange={(event) => setName(event.target.value)} placeholder="Nom écrit" className={`${fieldClass} w-40`} />
            <input aria-label="Prononciation" value={spoken} onChange={(event) => setSpoken(event.target.value)} placeholder="Prononciation" className={`${fieldClass} w-40`} />
            <button type="submit" aria-label="Ajouter la prononciation" disabled={!name.trim() || !spoken.trim()} className={goldButton}><Plus size={12} /> Ajouter</button>
          </form>
        </div>
      )}
    </div>
  );
};

export const PodcastRegie = ({ podcast, casting, voices, defaultVoiceId, chapterTitle }: { podcast: Podcast; casting: Casting; voices: AudioVoice[]; defaultVoiceId: string; chapterTitle: string | undefined }) => {
  const lines = podcast.script?.lines ?? [];
  const voiceName = (id: string) => voices.find((voice) => voice.id === id)?.name;
  const defaultName = voiceName(defaultVoiceId) ?? "voix du Chœur";
  const summary = new Map<string, { kind: CastingRoleKind; role: string; count: number }>();
  lines.forEach((line) => {
    const entry = summary.get(roleKey(line.kind, line.role)) ?? { kind: line.kind, role: line.role, count: 0 };
    summary.set(roleKey(line.kind, line.role), { ...entry, count: entry.count + 1 });
  });
  if (!podcast.script) return null;
  if (!podcast.transcribed) return <p className="font-serif text-xs italic text-[#8c8275]">Chapitre non transcrit : il sera lu en voix unique ({defaultName}). Transcrivez-le pour une lecture polyphonique.</p>;
  return (
    <div className="flex flex-col gap-1 font-serif text-sm text-[#c9bea9]">
      <p>{chapterTitle ?? "Chapitre"} · {frenchCount(lines.length, "réplique")} · {frenchCount(lines.reduce((total, line) => total + line.text.length, 0), "caractère")}</p>
      <ul aria-label="Récapitulatif des rôles" className="text-xs text-[#a99a83]">
        {[...summary.values()].map(({ kind, role, count }) => (
          <li key={roleKey(kind, role)}>{role} · {frenchCount(count, "réplique")} · {voiceName(casting.voiceOf(role, kind)) ?? voiceName(casting.voiceOf(NARRATOR_ROLE, "narrator")) ?? `voix par défaut (${defaultName})`}</li>
        ))}
      </ul>
      <p className="text-xs italic text-[#8c8275]">Ce chapitre est lu en polyphonie : chaque réplique prend la voix de son rôle ; à défaut, la voix du Narrateur, puis la voix par défaut ({defaultName}). Les autres chapitres restent en voix unique.</p>
    </div>
  );
};
