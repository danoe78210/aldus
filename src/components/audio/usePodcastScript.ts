import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ChapterAdaptation, LibraryConfig, PodcastLine, PodcastScript, PronunciationEntry, ScriptRule, ScriptRuleId } from "../../types";
import { getBookChapterText, saveChapterAdaptation } from "../../utils/libraryApi";
import { applyRules, DEFAULT_RULES, detectProperNouns, splitIntoLines } from "./podcastScript";
import { NARRATOR_ROLE } from "./useVoiceCasting";

type LinePatch = Partial<Pick<PodcastLine, "text" | "role" | "kind">> & { removed?: boolean };

interface LoadedText {
  key: string;
  text: string;
  error: string | null;
}

interface Adaptation {
  rules: ScriptRule[];
  byLine: Record<number, LinePatch>;
  transcribed: boolean;
}

interface Draft extends Adaptation {
  key: string;
  bookId: string;
  chapterIndex: number;
}

interface UsePodcastScriptOptions {
  bookId: string | undefined;
  chapterIndex: number | null;
  /** Adaptations déjà enregistrées dans l'édition audio du livre. */
  saved: ChapterAdaptation[] | undefined;
  /** Personnages encore distribués : une réplique dont le personnage a disparu retombe sur le Narrateur. */
  characters: string[];
  onSaved: (config: LibraryConfig) => void;
}

const SAVE_DELAY_MS = 400;

const messageOf = (reason: unknown, fallback: string): string =>
  typeof reason === "string" ? reason : reason instanceof Error ? reason.message : fallback;

const normalize = (role: string): string => role.trim().toLocaleLowerCase("fr");

const restore = (saved: ChapterAdaptation | undefined): Adaptation => ({
  rules: DEFAULT_RULES.map((rule) => {
    const stored = saved?.rules.find((candidate) => candidate.id === rule.id);
    return stored ? { ...rule, enabled: stored.enabled, ...(rule.substitutions ? { substitutions: stored.substitutions ?? [] } : {}) } : rule;
  }),
  byLine: Object.fromEntries((saved?.edits ?? []).map(({ source, ...patch }) => [source, patch])),
  transcribed: saved?.transcribed ?? false,
});

const serialize = ({ chapterIndex, rules, byLine, transcribed }: Draft): ChapterAdaptation => ({
  chapterIndex,
  rules,
  transcribed,
  edits: Object.entries(byLine).map(([source, patch]) => ({ source: Number(source), ...patch })),
});

/** Script podcast d'un chapitre : découpage à la volée, règles réactives et retouches, persistés dans l'édition audio du livre. */
export const usePodcastScript = ({ bookId, chapterIndex, saved, characters, onSaved }: UsePodcastScriptOptions) => {
  const key = bookId && chapterIndex !== null ? `${bookId}#${chapterIndex}` : null;
  const [loaded, setLoaded] = useState<LoadedText | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const pending = useRef<{ bookId: string; adaptation: ChapterAdaptation } | null>(null);

  useEffect(() => {
    if (!bookId || chapterIndex === null || !key) return;
    let active = true;
    getBookChapterText(bookId, chapterIndex)
      .then((text) => { if (active) setLoaded({ key, text, error: null }); })
      .catch((reason: unknown) => { if (active) setLoaded({ key, text: "", error: messageOf(reason, "Texte du chapitre indisponible.") }); });
    return () => { active = false; };
  }, [bookId, chapterIndex, key]);

  const savedChapter = chapterIndex === null ? undefined : saved?.find((candidate) => candidate.chapterIndex === chapterIndex);
  const restored = useMemo(() => restore(savedChapter), [savedChapter]);
  const { rules, byLine, transcribed } = draft && draft.key === key ? draft : restored;

  const flush = useCallback(() => {
    const job = pending.current;
    if (!job) return;
    pending.current = null;
    saveChapterAdaptation(job.bookId, job.adaptation)
      .then((config) => { setSaveError(null); onSaved(config); })
      .catch((reason: unknown) => setSaveError(messageOf(reason, "Adaptation du chapitre impossible à enregistrer.")));
  }, [onSaved]);

  useEffect(() => {
    if (!draft) return;
    if (pending.current && (pending.current.bookId !== draft.bookId || pending.current.adaptation.chapterIndex !== draft.chapterIndex)) flush();
    pending.current = { bookId: draft.bookId, adaptation: serialize(draft) };
    const timer = setTimeout(flush, SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [draft, flush]);
  useEffect(() => flush, [flush]);

  const current = key && loaded?.key === key ? loaded : null;
  const text = current?.text ?? "";
  const base = useMemo(() => splitIntoLines(text), [text]);
  const roster = useMemo(() => new Set(characters.map(normalize)), [characters]);
  const lines = useMemo(
    () => !transcribed ? [] : applyRules(base, rules).filter((line) => !byLine[line.source]?.removed).map((line): PodcastLine => {
      const edited = { ...line, ...byLine[line.source] };
      return edited.kind === "character" && !roster.has(normalize(edited.role)) ? { ...edited, kind: "narrator", role: NARRATOR_ROLE } : edited;
    }),
    [base, rules, byLine, roster, transcribed],
  );
  const substitutions = useMemo(() => rules.find((rule) => rule.id === "proper-nouns")?.substitutions ?? [], [rules]);
  const suggestions = useMemo(() => detectProperNouns(text, substitutions), [text, substitutions]);
  const script: PodcastScript | null = current && !current.error && chapterIndex !== null ? { chapterIndex, lines, rules } : null;
  const edited = Object.keys(byLine).length > 0;

  const update = useCallback((change: (state: Adaptation) => Partial<Adaptation>) => {
    if (!bookId || chapterIndex === null || !key) return;
    setDraft((previous) => {
      const state = previous?.key === key ? previous : { key, bookId, chapterIndex, ...restore(savedChapter) };
      return { ...state, ...change(state) };
    });
  }, [bookId, chapterIndex, key, savedChapter]);

  const toggleRule = useCallback((id: ScriptRuleId) => {
    update((state) => ({ rules: state.rules.map((rule) => (rule.id === id ? { ...rule, enabled: !rule.enabled } : rule)) }));
  }, [update]);

  const setSubstitutions = useCallback((entries: PronunciationEntry[]) => {
    update((state) => ({ rules: state.rules.map((rule) => (rule.id === "proper-nouns" ? { ...rule, substitutions: entries } : rule)) }));
  }, [update]);

  // shortcut: les retouches sont repérées par le rang source de la réplique ; un chapitre dont le texte change les décale.
  const editLine = useCallback((source: number, patch: LinePatch) => {
    update((state) => ({ byLine: { ...state.byLine, [source]: { ...state.byLine[source], ...patch } } }));
  }, [update]);

  /** Chapitre brut → script : applique les règles actives et repart d'un découpage vierge, sans retouches. */
  const transcribe = useCallback(() => update(() => ({ transcribed: true, byLine: {} })), [update]);

  return {
    script,
    transcribed,
    edited,
    transcribe,
    loading: key !== null && current === null,
    error: current?.error ?? null,
    saveError,
    substitutions,
    suggestions,
    toggleRule,
    setSubstitutions,
    editLine,
  };
};
