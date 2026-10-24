import { useCallback, useEffect, useMemo, useState } from "react";
import type { PodcastLine, PodcastScript, PronunciationEntry, ScriptRule, ScriptRuleId } from "../../types";
import { getBookChapterText } from "../../utils/libraryApi";
import { applyRules, DEFAULT_RULES, detectProperNouns, splitIntoLines } from "./podcastScript";

type LineEdit = Partial<Pick<PodcastLine, "text" | "role" | "kind">>;

interface LoadedText {
  key: string;
  text: string;
  error: string | null;
}

const messageOf = (reason: unknown): string =>
  typeof reason === "string" ? reason : reason instanceof Error ? reason.message : "Texte du chapitre indisponible.";

/** Script podcast d'un chapitre : découpage à la volée, règles réactives et retouches de l'auteur. */
// shortcut: règles, table de prononciation et retouches vivent en session ; leur persistance viendra avec l'étape D.
export const usePodcastScript = (bookId: string | undefined, chapterIndex: number | null) => {
  const key = bookId && chapterIndex !== null ? `${bookId}#${chapterIndex}` : null;
  const [loaded, setLoaded] = useState<LoadedText | null>(null);
  const [rules, setRules] = useState<ScriptRule[]>(DEFAULT_RULES);
  const [edits, setEdits] = useState<{ key: string; byLine: Record<number, LineEdit> }>({ key: "", byLine: {} });

  useEffect(() => {
    if (!bookId || chapterIndex === null || !key) return;
    let active = true;
    getBookChapterText(bookId, chapterIndex)
      .then((text) => { if (active) setLoaded({ key, text, error: null }); })
      .catch((reason: unknown) => { if (active) setLoaded({ key, text: "", error: messageOf(reason) }); });
    return () => { active = false; };
  }, [bookId, chapterIndex, key]);

  const current = key && loaded?.key === key ? loaded : null;
  const text = current?.text ?? "";
  const editedLines = edits.key === key ? edits.byLine : undefined;
  const base = useMemo(() => splitIntoLines(text), [text]);
  const lines = useMemo(
    () => applyRules(base, rules).map((line) => ({ ...line, ...editedLines?.[line.source] })),
    [base, rules, editedLines],
  );
  const substitutions = useMemo(() => rules.find((rule) => rule.id === "proper-nouns")?.substitutions ?? [], [rules]);
  const suggestions = useMemo(() => detectProperNouns(text, substitutions), [text, substitutions]);
  const script: PodcastScript | null = current && !current.error && chapterIndex !== null ? { chapterIndex, lines, rules } : null;

  const toggleRule = useCallback((id: ScriptRuleId) => {
    setRules((previous) => previous.map((rule) => (rule.id === id ? { ...rule, enabled: !rule.enabled } : rule)));
  }, []);

  const setSubstitutions = useCallback((entries: PronunciationEntry[]) => {
    setRules((previous) => previous.map((rule) => (rule.id === "proper-nouns" ? { ...rule, substitutions: entries } : rule)));
  }, []);

  const editLine = useCallback((source: number, patch: LineEdit) => {
    if (!key) return;
    setEdits((previous) => {
      const same = previous.key === key;
      const known = same ? previous.byLine : {};
      return { key, byLine: { ...known, [source]: { ...known[source], ...patch } } };
    });
  }, [key]);

  return {
    script,
    loading: key !== null && current === null,
    error: current?.error ?? null,
    substitutions,
    suggestions,
    toggleRule,
    setSubstitutions,
    editLine,
  };
};
