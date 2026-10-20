import React from "react";
import { Check, EyeOff } from "lucide-react";
import type { StylometryIssue } from "../../utils/stylometryApi";

interface IssuesListProps {
  issues: StylometryIssue[];
  ignored: Set<string>;
  ruleNames: Record<string, string>;
  onApply: (issue: StylometryIssue) => void;
  onIgnore: (id: string) => void;
  applyingId: string | null;
  disableApply: boolean;
}

export const IssuesList: React.FC<IssuesListProps> = ({
  issues,
  ignored,
  ruleNames,
  onApply,
  onIgnore,
  applyingId,
  disableApply,
}) => {
  const visible = issues.filter((issue) => !ignored.has(issue.id));
  if (visible.length === 0) {
    return (
      <p className="rounded-xs border border-[#3a3022] bg-[#13110f]/60 p-5 text-center font-serif text-sm italic text-[#a89f91]">
        {issues.length ? "Tous les passages ont été ignorés pour ce chapitre." : "Aucun passage critique relevé."}
      </p>
    );
  }
  return (
    <div className="space-y-3">
      {visible.map((issue) => (
        <article key={issue.id} className="rounded-xs border border-[#3a3022] bg-[#171410] p-4">
          <h3 className="font-cinzel text-xs uppercase tracking-wider text-[#d4af37]">{issue.category}</h3>
          <p className="mt-1 font-serif text-xs text-[#a89f91]">{ruleNames[issue.ruleId] ?? issue.ruleId}</p>
          <p className="mt-2 border-l-2 border-[#8f6e2b] bg-[#100e0c] px-3 py-2 font-serif text-sm leading-relaxed text-[#eee5d5]">
            {issue.originalText}
          </p>
          <p className="mt-2 font-serif text-xs leading-relaxed text-[#bdb3a3]">{issue.explanation}</p>
          {issue.suggestedRewrite !== null && (
            <div className="mt-3">
              <p className="font-cinzel text-[10px] uppercase tracking-widest text-[#8f8373]">Proposition de remaniement</p>
              <p className="mt-1 font-serif text-sm italic text-[#d8c7a2]">{issue.suggestedRewrite}</p>
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {issue.suggestedRewrite !== null && (
              <button
                type="button"
                onClick={() => onApply(issue)}
                disabled={applyingId !== null || disableApply}
                className="inline-flex items-center gap-1.5 border border-[#8f6e2b] px-3 py-1.5 font-cinzel text-[10px] tracking-wider text-[#e6c96f] uppercase hover:border-[#d4af37] disabled:opacity-50"
              >
                <Check size={12} aria-hidden /> {applyingId === issue.id ? "Application…" : "Appliquer la proposition"}
              </button>
            )}
            <button
              type="button"
              onClick={() => onIgnore(issue.id)}
              className="inline-flex items-center gap-1.5 border border-[#3a3022] px-3 py-1.5 font-cinzel text-[10px] tracking-wider text-[#a89f91] uppercase hover:text-[#d4af37]"
            >
              <EyeOff size={12} aria-hidden /> Ignorer pour ce chapitre
            </button>
          </div>
        </article>
      ))}
    </div>
  );
};
