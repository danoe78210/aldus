import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, RefreshCw } from "lucide-react";
import { useStudio } from "./StudioContext";
import { CorrectorView } from "./CorrectorView";
import { readChapterFile } from "../utils/projectApi";
import {
  SEVERITY_COLOR,
  type TypographyAnomaly,
  type TypographySeverity,
  analyzeTypography,
  applyAnomaly,
  excerptOf,
} from "../utils/typographyEngine";

/** Lignes composées par feuillet d'épreuve (gabarit 7 × 10 po). */
const LINES_PER_PAGE = 14;

/** Signe de correcteur traditionnel selon la gravité. */
const CORRECTOR_SIGN: Record<TypographySeverity, string> = {
  critical: "✗",
  advice: "+",
  minor: "~",
};

interface ProofLine {
  number: number;
  text: string;
  offset: number;
}

/** Découpe le texte en lignes avec leur décalage absolu. */
const splitLines = (text: string): ProofLine[] => {
  const lines: ProofLine[] = [];
  let offset = 0;
  text.split("\n").forEach((value, index) => {
    lines.push({ number: index + 1, text: value, offset });
    offset += value.length + 1;
  });
  return lines;
};

/** Découpe une liste en pages de `size` éléments. */
const paginate = (lines: ProofLine[], size: number): ProofLine[][] => {
  const pages: ProofLine[][] = [];
  for (let index = 0; index < lines.length; index += size) {
    pages.push(lines.slice(index, index + size));
  }
  return pages.length > 0 ? pages : [[]];
};

/** Rend les espaces typographiques visibles dans les gloses. */
const showSpaces = (value: string): string =>
  value.replace(/\u00A0/g, "⍽").replace(/\u202F/g, "⸗");

/**
 * **Feuillet VIII — Le Banc d'Épreuve** (page de droite de l'onglet Correcteur) :
 * feuillet type composé en vélin (justification pleine, alinéa de premier rang),
 * anomalies soulignées à l'encre (carmin pour les espaces et tirets, or pour les
 * ligatures et lettres), **gloses marginales** numérotées à la ligne, navigation
 * de feuillet en feuillet.
 *
 * Un clic sur une glose impose le correctif de cette seule occurrence
 * (micro-animation d'encre). La bascule conserve la relecture linguistique
 * (LanguageTool) pour les fautes de langue.
 */
export const ProofWorkbench: React.FC = () => {
  const { chapterFiles, onNotify } = useStudio();
  const [mode, setMode] = useState<"proof" | "linguistic">("proof");
  const [chapter, setChapter] = useState("");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [onlyAnomalies, setOnlyAnomalies] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const [inked, setInked] = useState<string | null>(null);

  /** Charge (ou recharge) le chapitre dans le banc d'épreuve. */
  const loadChapter = useCallback(async (file: string) => {
    setChapter(file);
    setError(null);
    setPage(1);
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
      void loadChapter(chapterFiles[0]);
    }
  }, [chapter, chapterFiles, loadChapter]);

  const report = useMemo(() => analyzeTypography(text), [text]);
  const lines = useMemo(() => splitLines(text), [text]);
  const pages = useMemo(() => paginate(lines, LINES_PER_PAGE), [lines]);

  /** Page de composition effective (filtre « feuillets à anomalies »). */
  const visiblePages = useMemo(() => {
    if (!onlyAnomalies) {
      return pages;
    }
    const filtered = pages.filter((block) =>
      block.some((line) => report.anomalies.some((anomaly) => anomaly.line === line.number)),
    );
    return filtered.length > 0 ? filtered : [[]];
  }, [onlyAnomalies, pages, report.anomalies]);

  const safePage = Math.min(page, Math.max(1, visiblePages.length));
  const currentLines = visiblePages[safePage - 1] ?? [];
  const anomaliesOfPage = report.anomalies.filter((anomaly) =>
    currentLines.some((line) => anomaly.line === line.number),
  );

  /** Impose une seule occurrence (clic sur une glose) avec animation d'encre. */
  const applyOne = (anomaly: TypographyAnomaly) => {
    const found = showSpaces(excerptOf(text, anomaly.offset, anomaly.length));
    setText((current) => applyAnomaly(current, anomaly));
    setInked(anomaly.id);
    window.setTimeout(() => setInked(null), 600);
    onNotify(
      "success",
      `Usage aldin imposé (ligne ${anomaly.line}) : ${found} → ${showSpaces(anomaly.replacement)}.`,
    );
  };
if (mode === "linguistic") {
    return (
      <div className="flex h-full min-h-0 flex-col gap-3">
        <div className="flex shrink-0 justify-end">
          <button
            type="button"
            onClick={() => setMode("proof")}
            className="rounded-xs border border-[#2a2c33] bg-[#0f0e0d] px-3 py-1.5 font-serif text-[10px] tracking-widest text-[#9e9587] uppercase transition-colors hover:border-[#8f6e2b] hover:text-[#c5a059]"
          >
            [ Banc d&rsquo;épreuve typographique ]
          </button>
        </div>
        <div className="min-h-0 flex-1">
          <CorrectorView />
        </div>
      </div>
    );
  }

  return (
    <div className="animate-ink-reveal flex h-full min-h-0 flex-col gap-3">
      <header className="flex shrink-0 flex-wrap items-center gap-2 pb-2">
        <h2 className="flex-1 font-serif text-lg tracking-[0.25em] text-[#d4af37] uppercase">
          VIII. Le Banc d&rsquo;Épreuve
        </h2>
        <button
          type="button"
          onClick={() => setMode("linguistic")}
          className="rounded-xs border border-[#2a2c33] bg-[#0f0e0d] px-3 py-1.5 font-serif text-[10px] tracking-widest text-[#9e9587] uppercase transition-colors hover:border-[#8f6e2b] hover:text-[#c5a059]"
        >
          [ Relecture linguistique ]
        </button>
      </header>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <select
          value={chapter}
          onChange={(event) => void loadChapter(event.target.value)}
          disabled={loading}
          aria-label="Chapitre mis en épreuve"
          className="min-w-0 flex-1 rounded-xs border border-[#3a3022] bg-[#13110f] px-3 py-1.5 font-serif text-sm text-[#f5efe4] focus:border-[#d4af37] focus:outline-none"
        >
          <option value="">Choisir un chapitre…</option>
          {chapterFiles.map((file) => (
            <option key={file} value={file}>
              {file}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => void loadChapter(chapter)}
          disabled={chapter === "" || loading}
          title="Reprendre le texte du chapitre (après correction sur l'autre feuillet)"
          className="rounded-xs border border-[#3a3022] px-2.5 py-1.5 font-mono text-[10px] tracking-widest text-[#9e9587] uppercase transition-colors hover:text-[#c5a059] disabled:opacity-40"
        >
          <RefreshCw size={12} className="mr-1 inline" />
          Recharger
        </button>
        {loading && <Loader2 size={14} className="animate-spin text-[#c5a059]" />}
      </div>

      {error && (
        <p className="shrink-0 border border-[#a83232]/50 bg-[#a83232]/10 px-3 py-2 font-serif text-xs text-[#a83232]">
          {error}
        </p>
      )}

      {/* Barre d'outils de navigation du banc d'épreuve */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-y border-[#382f22] py-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={safePage <= 1}
            className="rounded-xs border border-[#3a3022] px-2 py-1 font-serif text-[10px] tracking-widest text-[#c9bea9] uppercase transition-colors hover:text-[#ffd700] disabled:opacity-40"
          >
            <ChevronLeft size={12} className="mr-1 inline" />
            Feuillet précédent
          </button>
          <span className="font-mono text-[11px] text-[#9e9587] tabular-nums">
            Feuillet {safePage} sur {Math.max(1, visiblePages.length)}
          </span>
          <button
            type="button"
            onClick={() => setPage((current) => Math.min(visiblePages.length, current + 1))}
            disabled={safePage >= visiblePages.length}
            className="rounded-xs border border-[#3a3022] px-2 py-1 font-serif text-[10px] tracking-widest text-[#c9bea9] uppercase transition-colors hover:text-[#ffd700] disabled:opacity-40"
          >
            Feuillet suivant
            <ChevronRight size={12} className="ml-1 inline" />
          </button>
        </div>
        <label className="flex items-center gap-2 font-serif text-[11px] text-[#c9bea9]">
          <input
            type="checkbox"
            checked={onlyAnomalies}
            onChange={(event) => {
              setOnlyAnomalies(event.target.checked);
              setPage(1);
            }}
            className="h-3 w-3 accent-[#d4af37]"
          />
          Afficher uniquement les feuillets contenant des anomalies
        </label>
      </div>
{/* Feuillet type (vélin) + gloses marginales */}
      <div className="flex min-h-0 flex-1 gap-3">
        <div className="min-h-0 flex-1 overflow-y-auto border border-[#3a3022] bg-[#dcd8cf] px-7 py-6 shadow-[inset_0_0_30px_rgba(0,0,0,0.18)]">
          <div
            className="mx-auto max-w-[34rem] font-serif text-[13px] leading-6 text-[#2b2620]"
            style={{ textAlign: "justify" }}
          >
            {currentLines.map((line) => {
              const found = report.anomalies.filter((anomaly) => anomaly.line === line.number);
              const firstLineIndent = line.text.trimStart() === line.text ? "1.5em" : 0;
              if (found.length === 0) {
                return (
                  <p key={line.number} className="min-h-[1.5rem]" style={{ textIndent: firstLineIndent }}>
                    {line.text || "\u00A0"}
                  </p>
                );
              }
              // Décomposition de la ligne : texte neutre / occurrences soulignées.
              const nodes: React.ReactNode[] = [];
              let cursor = line.offset;
              found.forEach((anomaly) => {
                const start = anomaly.offset;
                if (start > cursor) {
                  nodes.push(text.slice(cursor, start));
                }
                const active = hovered === anomaly.id || inked === anomaly.id;
                nodes.push(
                  <mark
                    key={anomaly.id}
                    onMouseEnter={() => setHovered(anomaly.id)}
                    onMouseLeave={() => setHovered(null)}
                    className={`bg-transparent ${inked === anomaly.id ? "animate-ink-reveal" : ""}`}
                    style={{
                      textDecoration: "underline",
                      textDecorationStyle: anomaly.severity === "critical" ? "wavy" : "dotted",
                      textDecorationColor: SEVERITY_COLOR[anomaly.severity],
                      backgroundColor: active ? "rgba(212,175,55,0.25)" : "transparent",
                    }}
                  >
                    {text.slice(start, start + anomaly.length)}
                  </mark>,
                );
                cursor = start + anomaly.length;
              });
              if (cursor < line.offset + line.text.length) {
                nodes.push(text.slice(cursor, line.offset + line.text.length));
              }
              return (
                <p key={line.number} className="min-h-[1.5rem]" style={{ textIndent: firstLineIndent }}>
                  {nodes}
                </p>
              );
            })}
          </div>
        </div>

        {/* Colonne des gloses marginales à la plume */}
        <aside className="min-h-0 w-56 shrink-0 overflow-y-auto border-l border-dotted border-[#5a4f3f] pl-3">
          <p className="mb-2 font-serif text-[10px] tracking-widest text-[#8f6e2b] uppercase">
            Gloses de l&rsquo;imprimeur
          </p>
          {anomaliesOfPage.length === 0 ? (
            <p className="font-serif text-[11px] italic text-[#786c59]">
              Feuillet sans anomalie : la composition est pure.
            </p>
          ) : (
            <ul className="space-y-2">
              {anomaliesOfPage.map((anomaly) => (
                <li key={anomaly.id}>
                  <button
                    type="button"
                    onClick={() => applyOne(anomaly)}
                    onMouseEnter={() => setHovered(anomaly.id)}
                    onMouseLeave={() => setHovered(null)}
                    title="Imposer ce seul correctif"
                    className="w-full border-l-2 pl-2 text-left transition-colors hover:bg-[#1c1814]"
                    style={{ borderColor: SEVERITY_COLOR[anomaly.severity] }}
                  >
                    <span className="font-mono text-[10px] text-[#9e9587]">
                      L.{anomaly.line}
                      <span
                        className="ml-1 font-serif"
                        style={{ color: SEVERITY_COLOR[anomaly.severity] }}
                      >
                        {CORRECTOR_SIGN[anomaly.severity]}
                      </span>
                    </span>
                    <span className="ml-2 font-serif text-[11px] text-[#f5efe4]">
                      {anomaly.label}
                    </span>
                    <span className="mt-0.5 block font-mono text-[10px] text-[#786c59]">
                      {showSpaces(excerptOf(text, anomaly.offset, anomaly.length))} →{" "}
                      {showSpaces(anomaly.replacement) || "∅"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </div>
  );
};