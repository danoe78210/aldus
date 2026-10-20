import React, { useEffect, useState } from "react";
import { Settings2 } from "lucide-react";
import { useStudio } from "../StudioContext";
import {
  applyStylometrySuggestion,
  auditChapterStylometry,
  getStylometryRules,
  type StylometryIssue,
  type StylometryReport,
  type StylometryRule,
} from "../../utils/stylometryApi";
import { ChapterSelector } from "./ChapterSelector";
import { IssuesList } from "./IssuesList";
import { RulesManagerModal } from "./RulesManagerModal";

export const EpreuvePlumeView: React.FC = () => {
  const { chapterFiles, proofChapter, proofText, proofDirty, proofLoading, proofError, loadProofChapter, onNotify, sourceConfig } = useStudio();
  const [rules, setRules] = useState<StylometryRule[]>([]);
  const [report, setReport] = useState<StylometryReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rulesError, setRulesError] = useState<string | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [ignoredByChapter, setIgnoredByChapter] = useState<Record<string, Set<string>>>({});

  useEffect(() => {
    let active = true;
    getStylometryRules().then((loaded) => {
      if (active) setRules(loaded);
    }).catch((cause: unknown) => {
      if (active) {
        const message = cause instanceof Error ? cause.message : String(cause);
        setRulesError(message);
        onNotify("error", `Chargement des règles de stylométrie impossible : ${message}`);
      }
    });
    return () => { active = false; };
  }, [onNotify]);

  useEffect(() => {
    if (!proofChapter || !sourceConfig.directory || proofDirty || proofLoading || rules.length === 0) {
      return;
    }
    let active = true;
    auditChapterStylometry(sourceConfig.directory, proofChapter).then((next) => {
      if (active) {
        setReport(next);
        setError(null);
      }
    }).catch((cause: unknown) => {
      if (active) {
        const message = cause instanceof Error ? cause.message : String(cause);
        setError(message);
        onNotify("error", `Audit de stylométrie impossible : ${message}`);
      }
    });
    return () => { active = false; };
  }, [proofChapter, proofText, proofDirty, proofLoading, rules, sourceConfig.directory, onNotify]);

  const apply = async (issue: StylometryIssue) => {
    if (!sourceConfig.directory || !proofChapter || issue.suggestedRewrite === null) return;
    setApplyingId(issue.id);
    setError(null);
    try {
      await applyStylometrySuggestion(sourceConfig.directory, proofChapter, issue, issue.suggestedRewrite);
      await loadProofChapter(proofChapter);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      setError(message);
      onNotify("error", `Application de proposition impossible : ${message}`);
    } finally {
      setApplyingId(null);
    }
  };

  const riskLabel = report === null
    ? ""
    : report.aiRiskPercent <= 25
      ? "Plume souveraine / Texture organique"
      : report.aiRiskPercent <= 50
        ? "Zone tempérée / Quelques régularités constatées"
        : "Risque d'interception IA élevé / Cadence ou tics à remanier";
  const activeReport = report?.chapterId === proofChapter && !proofDirty ? report : null;
  const ignored = ignoredByChapter[proofChapter] ?? new Set<string>();

  return (
    <section className="animate-ink-reveal flex h-full w-full min-h-0 flex-col overflow-y-auto px-2 pr-1">
      <header className="mb-5 shrink-0 text-center">
        <p className="font-cinzel text-[10px] tracking-[0.3em] text-[#8f6e2b] uppercase">Épreuve stylistique locale</p>
        <h1 className="mt-1 font-cinzel text-base tracking-[0.22em] text-[#d4af37] uppercase">Épreuve de Plume</h1>
      </header>
      <div className="mb-4 flex shrink-0 flex-wrap items-center gap-3">
        <ChapterSelector chapters={chapterFiles} chapter={proofChapter} loading={proofLoading || applyingId !== null} onChange={(file) => void loadProofChapter(file)} />
        <button type="button" onClick={() => setRulesOpen(true)} className="inline-flex h-10 shrink-0 items-center gap-2 border border-[#3a3022] px-3 font-cinzel text-[10px] tracking-wider text-[#c9bea9] uppercase hover:border-[#8f6e2b] hover:text-[#d4af37]">
          <Settings2 size={14} /> Gérer les règles
        </button>
      </div>

      {!sourceConfig.directory && <p className="mb-3 border border-[#5b4621] bg-[#241c10] px-3 py-2 font-serif text-xs text-[#d8c7a2]">Configurez le dossier des sources du projet pour lancer un audit.</p>}
      {rulesError && <p role="alert" className="mb-3 border border-[#7e3535] bg-[#301515] px-3 py-2 font-serif text-xs text-[#e39b91]">{rulesError}</p>}
      {error && <p role="alert" className="mb-3 border border-[#7e3535] bg-[#301515] px-3 py-2 font-serif text-xs text-[#e39b91]">{error}</p>}
      {proofError && <p role="alert" className="mb-3 border border-[#7e3535] bg-[#301515] px-3 py-2 font-serif text-xs text-[#e39b91]">{proofError}</p>}

      {proofDirty && <p className="mb-3 border border-[#5b4621] bg-[#241c10] px-3 py-2 font-serif text-xs text-[#d8c7a2]">Enregistrez d'abord les retouches en attente dans le Correcteur pour auditer le fichier à jour.</p>}
      <div className="mb-5 flex shrink-0 items-center gap-4 border-y border-[#382f22] py-4">
        <div
          className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full border-2 border-[#8f6e2b]/70 bg-[#13110f] shadow-[inset_0_0_18px_rgba(0,0,0,0.9),0_0_18px_rgba(212,175,55,0.16)]"
          style={{ backgroundImage: `conic-gradient(#d4af37 ${activeReport?.aiRiskPercent ?? 0}%, #29231a 0)` }}
          role="img"
          aria-label={`Risque IA : ${activeReport?.aiRiskPercent ?? 0} pour cent`}
        >
          <span className="flex h-[74px] w-[74px] items-center justify-center rounded-full bg-[#13110f] font-cinzel text-lg text-[#d4af37] tabular-nums">
            {activeReport?.aiRiskPercent ?? "—"}<span className="text-[11px]"> {activeReport ? "%" : ""}</span>
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-cinzel text-xs tracking-widest text-[#d4af37] uppercase">Risque de détection IA</p>
          <p className="mt-1 font-serif text-sm text-[#e2dbce]">{activeReport ? riskLabel : proofDirty ? "En attente d'enregistrement" : proofChapter ? "Audit en cours…" : "Choisissez un chapitre"}</p>
          {activeReport && <p className="mt-1 font-serif text-xs text-[#938879]">Indice de variation rythmique : {activeReport.burstinessScore.toFixed(1)} · {activeReport.issuesCount} signalement{activeReport.issuesCount > 1 ? "s" : ""}</p>}
        </div>
      </div>

      {rules.length > 0 && activeReport && (
        <IssuesList issues={activeReport.issues} ignored={ignored} ruleNames={Object.fromEntries(rules.map((rule) => [rule.id, rule.name]))} onApply={(issue) => void apply(issue)} onIgnore={(id) => setIgnoredByChapter((current) => ({ ...current, [proofChapter]: new Set([...(current[proofChapter] ?? []), id]) }))} applyingId={applyingId} disableApply={proofDirty} />
      )}
      {proofChapter && !proofLoading && rules.length === 0 && !rulesError && <p className="text-center font-serif text-sm text-[#a89f91]">Chargement des règles de stylométrie…</p>}
      {rulesOpen && <RulesManagerModal rules={rules} onRulesChange={(next) => { setRules(next); setRulesError(null); }} onNotify={onNotify} onClose={() => setRulesOpen(false)} />}
    </section>
  );
};
