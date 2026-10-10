import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Feather, Loader2, ScrollText } from "lucide-react";
import { useStudio } from "./StudioContext";
import { readChapterFile } from "../utils/projectApi";
import { analyzeTypography, type TypographyIssue } from "../data/typography";

/** Règles critiques (rouge carmin) ; les autres relèvent du conseil (bistre). */
const CRITICAL_RULES = new Set(["nbsp-high-punctuation", "nbsp-guillemets", "em-dash"]);

/** Annotation marginale à la plume : couleur selon la gravité de la règle. */
const Annotation: React.FC<{ issue: TypographyIssue }> = ({ issue }) => {
  const critical = CRITICAL_RULES.has(issue.rule);
  return (
    <li
      className={`border-l-2 pl-3 py-2 ${
        critical ? "border-[#a83232]" : "border-[#8f6e2b]"
      }`}
    >
      <p className="flex items-baseline justify-between gap-3">
        <span
          className={`font-serif text-xs ${critical ? "text-[#a83232]" : "text-[#c8a06a]"}`}
        >
          <Feather size={11} className="mr-1 inline" />
          {issue.label}
        </span>
        <span className="font-mono text-[11px] text-[#e2dbce] tabular-nums">
          {issue.count}
        </span>
      </p>
      <p className="mt-0.5 font-serif text-[11px] italic text-[#9e9587]">{issue.advice}</p>
      {issue.samples.length > 0 && (
        <p className="mt-1 font-mono text-[10px] text-[#786c59]">
          {issue.samples.map((sample) => `« ${sample} »`).join("  ·  ")}
        </p>
      )}
      {!issue.fixable && (
        <p className="mt-0.5 font-mono text-[10px] text-[#786c59]">
          Décision d&rsquo;auteur requise (pas de correction automatique).
        </p>
      )}
    </li>
  );
};

/**
 * **Feuillet VII — Examen Typographique Aldin** (page de gauche de l'onglet
 * Correcteur) : vérifications automatiques de l'usage typographique français sur
 * le chapitre sélectionné (insécables, cadratins, doubles espaces, césures et
 * lignes veuves). Les annotations sont portées en marge, rouge carmin pour les
 * fautes critiques, bistre pour les conseils de style.
 *
 * L'application des corrections se fait sur le Feuillet VIII (« Justifier selon
 * l'Usage Aldin »), à côté des épreuves annotées par le correcteur linguistique.
 */
export const TypographicPanel: React.FC = () => {
  const { chapterFiles } = useStudio();
  const [chapter, setChapter] = useState("");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /** Charge le texte brut du chapitre sélectionné. */
  const handleChapterChange = useCallback(async (file: string) => {
    setChapter(file);
    setError(null);
    if (!file) {
      setText("");
      return;
    }
    setLoading(true);
    try {
      setText(await readChapterFile(file));
    } catch (cause) {
      setText("");
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setLoading(false);
    }
  }, []);

  // Présélection : premier chapitre détecté dans « Mes sources ».
  useEffect(() => {
    if (chapter === "" && chapterFiles.length > 0) {
      void handleChapterChange(chapterFiles[0]);
    }
  }, [chapter, chapterFiles, handleChapterChange]);

  const report = useMemo(() => analyzeTypography(text), [text]);

  return (
    <div className="animate-ink-reveal mx-auto flex h-full w-full max-w-2xl flex-col overflow-y-auto px-2 pr-1">
      <h2 className="mb-5 text-center font-serif text-lg tracking-[0.25em] text-[#d4af37] uppercase">
        VII. Examen Typographique Aldin
      </h2>

      <div className="mb-5 flex items-center gap-2">
        <ScrollText size={14} className="shrink-0 text-[#8f6e2b]" />
        <select
          value={chapter}
          onChange={(event) => void handleChapterChange(event.target.value)}
          disabled={loading}
          aria-label="Chapitre examiné"
          className="min-w-0 flex-1 rounded-xs border border-[#3a3022] bg-[#13110f] px-3 py-2 font-serif text-sm text-[#f5efe4] focus:border-[#d4af37] focus:outline-none"
        >
          <option value="">Choisir un chapitre…</option>
          {chapterFiles.map((file) => (
            <option key={file} value={file}>
              {file}
            </option>
          ))}
        </select>
        {loading && <Loader2 size={14} className="animate-spin text-[#c5a059]" />}
      </div>

      {error && (
        <p className="mb-4 border border-[#a83232]/50 bg-[#a83232]/10 px-3 py-2 font-serif text-xs text-[#a83232]">
          {error}
        </p>
      )}

      {text === "" ? (
        <p className="font-serif text-xs italic text-[#9e9587]">
          Sélectionnez un chapitre pour lancer l&rsquo;examen typographique.
        </p>
      ) : (
        <>
          <div className="mb-5 flex items-baseline justify-between border-b border-[#3a3022] pb-2 font-mono text-[11px] text-[#9e9587]">
            <span>{report.words} mots examinés</span>
            <span className={report.total === 0 ? "text-[#c5a059]" : "text-[#c8a06a]"}>
              {report.total === 0 ? "aucune irrégularité" : `${report.total} irrégularités`}
            </span>
          </div>

          {report.issues.length === 0 ? (
            <p className="font-serif text-xs text-[#c5a059]">
              Le chapitre respecte l&rsquo;Usage Aldin : insécables posées, cadratins
              conformes, aucune césure orpheline.
            </p>
          ) : (
            <ul className="space-y-3">
              {report.issues.map((issue) => (
                <Annotation key={issue.rule} issue={issue} />
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
};