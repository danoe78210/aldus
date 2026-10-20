import React, { useEffect, useRef } from "react";
import { Check, EyeOff } from "lucide-react";
import type { StylometryIssue } from "../../utils/stylometryApi";
import { usePlume } from "./PlumeContext";

/** Libellés d'en-tête des motifs natifs ; les règles personnalisées gardent leur nom. */
const MOTIF_LABEL: Record<string, string> = {
  "rlhf-connectors": "Tic de transition RLHF",
  "isometry-chain": "Cadence isométrique (Monotonie)",
  "paragraph-symmetry": "Paragraphes symétriques",
  "r-det-triads": "Triade rhétorique",
  "r-det-markdown-list": "Liste à amorces grasses",
  "r-det-conclusion": "Conclusion stéréotypée",
  "r-det-zipf": "Prédictibilité lexicale (Zipf)",
  "r-det-entropy": "Entropie uniforme",
};

interface AlertCardProps {
  issue: StylometryIssue;
  location: string;
  label: string;
  focused: boolean;
  leaving: boolean;
  applying: boolean;
  disableApply: boolean;
  onApply: () => void;
  onIgnore: () => void;
  onHover: (hovered: boolean) => void;
}

const AlertCard: React.FC<AlertCardProps> = ({ issue, location, label, focused, leaving, applying, disableApply, onApply, onIgnore, onHover }) => {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!focused) return;
    ref.current?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
    ref.current?.focus({ preventScroll: true });
  }, [focused]);

  return (
    <article
      ref={ref}
      tabIndex={-1}
      aria-label={`${location} · ${label}`}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      onFocus={() => onHover(true)}
      onBlur={() => onHover(false)}
      className={`rounded-xs border bg-[#1c1a17] p-4 transition-all duration-300 focus:outline-none ${
        focused ? "border-[#d4af37] shadow-[0_0_16px_rgba(212,175,55,0.25)]" : "border-[#d4af37]/25 shadow-[0_4px_16px_rgba(0,0,0,0.5)] hover:border-[#d4af37]/50"
      } ${leaving ? "pointer-events-none -translate-x-3 opacity-0" : "opacity-100"}`}
    >
      <h3 className="text-left font-serif text-[15px] font-bold tracking-wide text-[#d4af37] uppercase">
        {location} · {label}
      </h3>
      <p className="mt-3 text-left font-sans text-[11px] font-medium tracking-wider text-[#c5a059] uppercase">Texte original</p>
      <p className="mt-1 line-clamp-4 border-l-2 border-[#c24b2a] bg-[#121110] px-3 py-2 text-left font-reading text-sm leading-relaxed text-[#f0ece1]">
        « {issue.originalText.trim()} »
      </p>
      <p className="mt-3 text-left font-sans text-[11px] font-medium tracking-wider text-[#c5a059] uppercase">Diagnostic</p>
      <p className="mt-1 text-left font-sans text-[13px] leading-normal text-[#ded8cc]">{issue.explanation}</p>
      <p className="mt-3 text-left font-sans text-[11px] font-medium tracking-wider text-[#c5a059] uppercase">Proposition de la Forge</p>
      {issue.suggestedRewrite !== null ? (
        <p className="mt-1 border-l-2 border-[#d4af37] bg-[#23201b] px-3 py-2 text-left font-reading text-sm italic leading-relaxed text-[#f0ece1]">« {issue.suggestedRewrite} »</p>
      ) : (
        <p className="mt-1 text-left font-sans text-[13px] italic text-[#a8a29e]">Aucune reformation automatique : remaniez ce passage à la main.</p>
      )}
      <div className="mt-4 flex flex-wrap justify-between gap-2">
        {issue.suggestedRewrite !== null ? (
          <button
            type="button"
            onClick={onApply}
            disabled={disableApply}
            className="inline-flex cursor-pointer items-center gap-1.5 border border-[#d4af37] bg-[#2a2318] px-3 py-1.5 font-sans text-xs font-medium tracking-wide text-[#d4af37] uppercase transition-colors hover:bg-[#382f20] hover:text-[#f0ece1] disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Check size={12} aria-hidden /> {applying ? "Application…" : "Appliquer la reformation"}
          </button>
        ) : <span />}
        <button
          type="button"
          onClick={onIgnore}
          disabled={applying}
          className="inline-flex cursor-pointer items-center gap-1.5 border border-zinc-700 px-3 py-1.5 font-sans text-xs font-medium tracking-wide text-[#a8a29e] uppercase transition-colors hover:border-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          <EyeOff size={12} aria-hidden /> Ignorer
        </button>
      </div>
    </article>
  );
};

/** Page droite de l'Épreuve de Plume : registre défilant des remaniements actifs. */
export const IssuesList: React.FC = () => {
  const { rules, report, activeIssues, lineOf, applyingId, leavingId, apply, ignore, focusedId, setFocusedId, setHoveredId } = usePlume();
  const ruleNames = Object.fromEntries(rules.map((rule) => [rule.id, rule.name]));

  return (
    <div className="animate-ink-reveal flex h-full min-h-0 flex-col overflow-hidden">
      <header className="mb-4 shrink-0 border-b border-[#382f22] pb-3 text-center">
        <h2 className="font-cinzel text-base tracking-[0.22em] text-[#d4af37] uppercase">Registre des Remaniements</h2>
        <p className="mt-1 font-sans text-xs text-[#ded8cc]" aria-live="polite">
          {report ? `${activeIssues.length} alerte${activeIssues.length > 1 ? "s" : ""} active${activeIssues.length > 1 ? "s" : ""}` : "Aucun audit en cours"}
        </p>
      </header>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        {report === null ? (
          <p className="p-5 text-center font-serif text-sm italic text-[#a89f91]">Choisissez un chapitre sur le pupitre de gauche pour dresser le registre.</p>
        ) : activeIssues.length === 0 ? (
          <p className="rounded-xs border border-[#3a3022] bg-[#13110f]/60 p-5 text-center font-serif text-sm italic text-[#a89f91]">
            {report.issues.length ? "Toutes les alertes ont été ignorées pour cette session." : "Aucun passage critique relevé. Plume souveraine."}
          </p>
        ) : (
          activeIssues.map((issue) => (
            <AlertCard
              key={issue.id}
              issue={issue}
              location={`L.${lineOf[issue.id] ?? "?"}`}
              label={MOTIF_LABEL[issue.ruleId] ?? ruleNames[issue.ruleId] ?? issue.category}
              focused={focusedId === issue.id}
              leaving={leavingId === issue.id}
              applying={applyingId === issue.id}
              disableApply={applyingId !== null}
              onApply={() => void apply(issue)}
              onIgnore={() => {
                ignore(issue.id);
                setHoveredId(null);
                if (focusedId === issue.id) setFocusedId(null);
              }}
              onHover={(hovered) => setHoveredId(hovered ? issue.id : null)}
            />
          ))
        )}
      </div>
    </div>
  );
};
