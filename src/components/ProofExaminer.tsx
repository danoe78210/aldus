import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Feather, Loader2, ScrollText, Stamp } from "lucide-react";
import { useStudio } from "./StudioContext";
import { readChapterFile, writeChapterFile } from "../utils/projectApi";
import {
  ALL_RULES,
  FAMILY_COLOR,
  FAMILY_LABEL,
  type TypographyFamily,
  type TypographyRuleId,
  analyzeTypography,
  applyAldineUsage,
} from "../utils/typographyEngine";

/** Familles présentées en cartouches d'inventaire (Feuillet VII). */
const CARD_FAMILIES: TypographyFamily[] = ["punctuation", "dialogue", "letters", "numbers", "hygiene"];

/**
 * **Feuillet VII — L'Examen Aldin** (page de gauche de l'onglet Correcteur) :
 * sceau d'intégrité (indice de pureté typographique), cartouches d'inventaire des
 * fautes par famille, filtre de basse-cour des règles, et **ordre majeur**
 * `[ Imposer l'Usage Typographique Aldin › ]` qui justifie le chapitre en mémoire.
 *
 * Le moteur est `src/utils/typographyEngine.ts` (Code typographique &
 * Lexique de l'Imprimerie nationale) ; le banc d'épreuve annoté est le Feuillet VIII.
 */
export const ProofExaminer: React.FC = () => {
  const { chapterFiles, onNotify } = useStudio();
  const [chapter, setChapter] = useState("");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enabled, setEnabled] = useState<TypographyRuleId[]>(ALL_RULES.map((rule) => rule.id));

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

  useEffect(() => {
    if (chapter === "" && chapterFiles.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- auto-sélection du premier chapitre (chargement initial)
      void handleChapterChange(chapterFiles[0]);
    }
  }, [chapter, chapterFiles, handleChapterChange]);

  const report = useMemo(() => analyzeTypography(text, enabled), [text, enabled]);

  const toggleRule = (rule: TypographyRuleId) => {
    setEnabled((current) =>
      current.includes(rule) ? current.filter((id) => id !== rule) : [...current, rule],
    );
  };

  /** Ordre majeur : justifie le chapitre en mémoire et notifie le registre. */
  const applyAllCorrections = () => {
    const before = report.total;
    const { text: next, applied } = applyAldineUsage(text, report.anomalies);
    if (applied === 0) {
      onNotify("info", "Usage aldin : aucune correction nécessaire.");
      return;
    }
    setText(next);
    onNotify(
      "success",
      `Usage aldin imposé : ${applied} correction${applied > 1 ? "s" : ""} sur ${
        before > applied ? `${before} anomalies relevées` : "le chapitre"
      }${chapter ? ` — ${chapter}` : ""}.`,
    );
  };

  /** Consigne le texte justifié dans le chapitre (écriture atomique). */
  const persistChapter = async () => {
    if (!chapter) {
      onNotify("warning", "Aucun chapitre sélectionné : rien à consigner.");
      return;
    }
    try {
      await writeChapterFile(chapter, text);
      onNotify("success", `Chapitre consigné au registre : ${chapter}.`);
    } catch (cause) {
      onNotify("error", `Consignation impossible : ${String(cause)}`);
    }
  };

  const severityOf = report.bySeverity;

  return (
    <div className="animate-ink-reveal mx-auto flex h-full w-full max-w-2xl flex-col overflow-y-auto px-2 pr-1">
      <h2 className="mb-5 text-center font-serif text-lg tracking-[0.25em] text-[#d4af37] uppercase">
        VII. L&rsquo;Examen Aldin
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
{/* [1] Sceau d'intégrité — indice de pureté typographique */}
      <div className="mb-6 flex items-center gap-5">
        <div
          className="relative flex h-28 w-28 shrink-0 items-center justify-center rounded-full border-2 border-[#8f6e2b]/60 bg-[#13110f] shadow-[inset_0_0_18px_rgba(0,0,0,0.9),0_0_18px_rgba(212,175,55,0.18)]"
          role="img"
          aria-label={`Indice de pureté typographique : ${report.purity} pour cent`}
        >
          <span className="absolute inset-1.5 rounded-full border border-[#8f6e2b]/30" aria-hidden />
          <span
            className="font-serif text-2xl text-[#d4af37] tabular-nums"
            style={{ textShadow: "0 1px 2px rgba(0,0,0,0.8)" }}
          >
            {report.purity}
            <span className="text-sm"> %</span>
          </span>
          <Stamp size={12} className="absolute bottom-4 text-[#8f6e2b]" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-serif text-xs tracking-widest text-[#c9bea9] uppercase">
            Indice de pureté
          </p>
          <p className="mt-1 font-serif text-[11px] italic text-[#9e9587]">
            {text === ""
              ? "Sélectionnez un chapitre pour sceller l'examen."
              : report.total === 0
                ? `${report.words} mots : le chapitre est digne de la presse d'Alde.`
                : `${report.words} mots · ${report.total} anomalies · ${severityOf.critical} critiques, ${severityOf.advice} de style, ${severityOf.minor} mineures.`}
          </p>
        </div>
      </div>

      {/* [2] Décompte des anomalies par famille */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        {CARD_FAMILIES.map((family) => {
          const count = report.byFamily[family];
          const rules = ALL_RULES.filter((rule) => rule.family === family && report.anomalies.some((a) => a.rule === rule.id));
          return (
            <div
              key={family}
              className="border border-[#3a3022]/70 bg-[#13110f]/60 p-3"
              style={{ borderLeft: `3px solid ${FAMILY_COLOR[family]}` }}
            >
              <p className="flex items-baseline justify-between gap-2">
                <span
                  className="font-serif text-[11px] tracking-widest uppercase"
                  style={{ color: FAMILY_COLOR[family] }}
                >
                  {FAMILY_LABEL[family]}
                </span>
                <span className="font-mono text-xs text-[#e2dbce] tabular-nums">{count}</span>
              </p>
              {rules.length > 0 ? (
                <ul className="mt-1.5 space-y-0.5">
                  {rules.map((rule) => (
                    <li key={rule.id} className="flex items-baseline justify-between gap-2">
                      <span className="font-serif text-[11px] text-[#c9bea9]">{rule.label}</span>
                      <span className="font-mono text-[10px] text-[#9e9587] tabular-nums">
                        {report.anomalies.filter((a) => a.rule === rule.id).length}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 font-serif text-[10px] italic text-[#786c59]">Aucune anomalie.</p>
              )}
            </div>
          );
        })}
      </div>

      {/* [3] Filtre & basse-cour des règles */}
      <div className="mb-6 border border-[#3a3022]/70 bg-[#0f0c0a] p-3">
        <p className="mb-2 font-serif text-[11px] tracking-widest text-[#d4af37] uppercase">
          Basse-cour des règles
        </p>
        <ul className="grid gap-1 sm:grid-cols-2">
          {ALL_RULES.map((rule) => (
            <li key={rule.id}>
              <label className="flex items-center gap-2 font-serif text-[11px] text-[#c9bea9]">
                <input
                  type="checkbox"
                  checked={enabled.includes(rule.id)}
                  onChange={() => toggleRule(rule.id)}
                  className="h-3 w-3 accent-[#d4af37]"
                />
                <span style={{ color: enabled.includes(rule.id) ? FAMILY_COLOR[rule.family] : undefined }}>
                  {rule.label}
                </span>
              </label>
            </li>
          ))}
        </ul>
      </div>

      {/* [4] Ordre majeur de l'atelier */}
      <button
        type="button"
        onClick={applyAllCorrections}
        disabled={text === ""}
        className="w-full border border-[#8f6e2b]/60 bg-linear-to-b from-[#2e1d0f] to-[#170f07] py-3.5 font-serif text-xs tracking-[0.25em] text-[#eedcb8] uppercase shadow-xl transition-all hover:border-[#ffd700] hover:text-[#ffd700] hover:shadow-[0_0_20px_rgba(212,175,55,0.25)] active:scale-[0.99] disabled:opacity-40"
      >
        <Feather size={13} className="mr-2 inline" />
        [ Imposer l&rsquo;Usage Typographique Aldin &rsaquo; ]
      </button>
      <button
        type="button"
        onClick={() => void persistChapter()}
        disabled={text === "" || chapter === ""}
        className="mt-2 w-full border border-[#3a3022] py-2 font-mono text-[10px] tracking-widest text-[#9e9587] uppercase transition-colors hover:text-[#c5a059] disabled:opacity-40"
      >
        [ Consigner le chapitre au registre ]
      </button>
    </div>
  );
};