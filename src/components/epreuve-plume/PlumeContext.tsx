import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useStudio } from "../StudioContext";
import {
  applyStylometrySuggestion,
  auditChapterStylometry,
  getStylometryRules,
  type StylometryIssue,
  type StylometryReport,
  type StylometryRule,
} from "../../utils/stylometryApi";

/** Durée de l'animation de retrait d'une carte résolue. */
const LEAVE_MS = 280;

export interface PlumeValue {
  rules: StylometryRule[];
  setRules: (rules: StylometryRule[]) => void;
  rulesError: string | null;
  error: string | null;
  /** Rapport du chapitre affiché, `null` tant qu'il n'est pas à jour. */
  report: StylometryReport | null;
  /** Alertes non ignorées pour la session. */
  activeIssues: StylometryIssue[];
  /** Ligne (1-based) de chaque alerte dans le fichier source. */
  lineOf: Record<string, number>;
  applyingId: string | null;
  leavingId: string | null;
  apply: (issue: StylometryIssue) => Promise<void>;
  ignore: (id: string) => void;
  hoveredId: string | null;
  setHoveredId: (id: string | null) => void;
  focusedId: string | null;
  setFocusedId: (id: string | null) => void;
}

const PlumeContext = createContext<PlumeValue | null>(null);

const messageOf = (cause: unknown) => (cause instanceof Error ? cause.message : String(cause));

/**
 * État partagé de l'Épreuve de Plume entre le pupitre gauche (jauge, texte
 * annoté) et le registre des remaniements (page droite). `enabled` borne les
 * appels backend à l'écran actif.
 */
export const PlumeProvider: React.FC<{ enabled: boolean; children: React.ReactNode }> = ({ enabled, children }) => {
  const { proofChapter, proofText, proofDirty, proofLoading, loadProofChapter, onNotify, sourceConfig } = useStudio();
  const [rules, setRulesState] = useState<StylometryRule[]>([]);
  const [rulesError, setRulesError] = useState<string | null>(null);
  const [report, setReport] = useState<StylometryReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [leavingId, setLeavingId] = useState<string | null>(null);
  const [ignoredByChapter, setIgnoredByChapter] = useState<Record<string, Set<string>>>({});
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [focusedId, setFocusedId] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || rules.length > 0) return;
    let active = true;
    getStylometryRules().then((loaded) => {
      if (active) setRulesState(loaded);
    }).catch((cause: unknown) => {
      if (active) {
        setRulesError(messageOf(cause));
        onNotify("error", `Chargement des règles de stylométrie impossible : ${messageOf(cause)}`);
      }
    });
    return () => { active = false; };
  }, [enabled, rules.length, onNotify]);

  useEffect(() => {
    if (!enabled || !proofChapter || !sourceConfig.directory || proofDirty || proofLoading || rules.length === 0) return;
    let active = true;
    auditChapterStylometry(sourceConfig.directory, proofChapter).then((next) => {
      if (active) {
        setReport(next);
        setError(null);
      }
    }).catch((cause: unknown) => {
      if (active) {
        setError(messageOf(cause));
        onNotify("error", `Audit de stylométrie impossible : ${messageOf(cause)}`);
      }
    });
    return () => { active = false; };
  }, [enabled, proofChapter, proofText, proofDirty, proofLoading, rules, sourceConfig.directory, onNotify]);

  const activeReport = report?.chapterId === proofChapter && !proofDirty ? report : null;
  const ignored = ignoredByChapter[proofChapter];
  const activeIssues = useMemo(
    () => activeReport?.issues.filter((issue) => !ignored?.has(issue.id)) ?? [],
    [activeReport, ignored],
  );

  const lineOf = useMemo(() => {
    const lines: Record<string, number> = {};
    if (!activeReport) return lines;
    const characters = Array.from(proofText);
    let line = 1;
    let cursor = 0;
    for (const issue of [...activeReport.issues].sort((left, right) => left.startOffset - right.startOffset)) {
      for (; cursor < Math.min(issue.startOffset, characters.length); cursor += 1) {
        if (characters[cursor] === "\n") line += 1;
      }
      lines[issue.id] = line;
    }
    return lines;
  }, [activeReport, proofText]);

  const apply = async (issue: StylometryIssue) => {
    if (!sourceConfig.directory || !proofChapter || issue.suggestedRewrite === null) return;
    setApplyingId(issue.id);
    setError(null);
    try {
      // Le backend archive le chapitre dans `.aldus/history/` avant l'écriture atomique.
      await applyStylometrySuggestion(sourceConfig.directory, proofChapter, issue, issue.suggestedRewrite);
      setLeavingId(issue.id);
      await new Promise((resolve) => setTimeout(resolve, LEAVE_MS));
      await loadProofChapter(proofChapter);
    } catch (cause) {
      setError(messageOf(cause));
      onNotify("error", `Application de la reformation impossible : ${messageOf(cause)}`);
    } finally {
      setApplyingId(null);
      setLeavingId(null);
    }
  };

  const value: PlumeValue = {
    rules,
    setRules: (next) => {
      setRulesState(next);
      setRulesError(null);
    },
    rulesError,
    error,
    report: activeReport,
    activeIssues,
    lineOf,
    applyingId,
    leavingId,
    apply,
    ignore: (id) => setIgnoredByChapter((current) => ({
      ...current,
      [proofChapter]: new Set([...(current[proofChapter] ?? []), id]),
    })),
    hoveredId,
    setHoveredId,
    focusedId,
    setFocusedId,
  };

  return <PlumeContext.Provider value={value}>{children}</PlumeContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components -- le fichier de contexte expose aussi son hook d'accès
export const usePlume = (): PlumeValue => {
  const value = useContext(PlumeContext);
  if (!value) throw new Error("usePlume doit être utilisé dans un PlumeProvider.");
  return value;
};
