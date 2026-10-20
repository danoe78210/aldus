import React, { useState } from "react";
import { Plus, RotateCcw, Trash2, X } from "lucide-react";
import {
  saveStylometryRules,
  type StylometryPatternType,
  type StylometryRule,
} from "../../utils/stylometryApi";
import type { LogLevel } from "../../types";

interface RulesManagerModalProps {
  rules: StylometryRule[];
  onRulesChange: (rules: StylometryRule[]) => void;
  onNotify: (level: LogLevel, message: string) => void;
  onClose: () => void;
}

type RuleTab = "detection" | "humanisation";

const PATTERNS: { value: StylometryPatternType; label: string }[] = [
  { value: "exactMatch", label: "Texte exact" },
  { value: "regex", label: "Expression régulière" },
  { value: "authorLexicon", label: "Mot de vocabulaire noble" },
];

const ruleWeight = (rule: StylometryRule): number =>
  rule.kind.kind === "detection" ? rule.kind.penaltyWeight : rule.kind.bonusWeight;

export const RulesManagerModal: React.FC<RulesManagerModalProps> = ({
  rules,
  onRulesChange,
  onNotify,
  onClose,
}) => {
  const [tab, setTab] = useState<RuleTab>("detection");
  const [name, setName] = useState("");
  const [patternType, setPatternType] = useState<StylometryPatternType>("exactMatch");
  const [pattern, setPattern] = useState("");
  const [weight, setWeight] = useState(5);
  const [explanation, setExplanation] = useState("");
  const [suggestion, setSuggestion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const persist = async (next: StylometryRule[]) => {
    setSaving(true);
    setError(null);
    try {
      onRulesChange(await saveStylometryRules(next));
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause);
      setError(message);
      onNotify("error", `Enregistrement des règles de stylométrie impossible : ${message}`);
    } finally {
      setSaving(false);
    }
  };

  const toggle = (rule: StylometryRule) => {
    void persist(rules.map((item) => item.id === rule.id ? { ...item, enabled: !item.enabled } : item));
  };

  const remove = (rule: StylometryRule) => {
    if (!rule.isBuiltin) void persist(rules.filter((item) => item.id !== rule.id));
  };

  const reset = () => {
    void persist(rules.filter((rule) => rule.isBuiltin).map((rule) => ({ ...rule, enabled: true })));
  };

  const add = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName || !pattern.trim() || !explanation.trim()) {
      setError("Renseignez le nom, le motif et l'explication.");
      return;
    }
    const id = `${trimmedName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${Date.now()}`;
    const rule: StylometryRule = {
      id,
      name: trimmedName,
      enabled: true,
      isBuiltin: false,
      kind: tab === "detection"
        ? {
            kind: "detection",
            patternType,
            pattern: pattern.trim(),
            penaltyWeight: weight,
            category: "Règle personnalisée",
            explanation: explanation.trim(),
            defaultSuggestion: suggestion.trim() || null,
          }
        : {
            kind: "humanisation",
            patternType,
            pattern: pattern.trim(),
            bonusWeight: weight,
            category: "Règle personnalisée",
            explanation: explanation.trim(),
          },
    };
    void persist([...rules, rule]);
    setName("");
    setPattern("");
    setExplanation("");
    setSuggestion("");
  };

  const visibleRules = rules.filter((rule) =>
    tab === "detection" ? rule.kind.kind === "detection" : rule.kind.kind === "humanisation",
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <section role="dialog" aria-modal="true" aria-labelledby="stylometry-rules-title" className="flex max-h-[90vh] w-full max-w-2xl flex-col border border-[#8f6e2b]/70 bg-[#13110f] shadow-[0_20px_80px_rgba(0,0,0,0.8)]">
        <header className="flex items-center justify-between border-b border-[#3a3022] px-5 py-4">
          <h2 id="stylometry-rules-title" className="font-cinzel text-sm tracking-widest text-[#d4af37] uppercase">Gestion des règles</h2>
          <button type="button" onClick={onClose} aria-label="Fermer" className="text-[#a89f91] hover:text-[#d4af37]"><X size={18} /></button>
        </header>
        <div className="grid grid-cols-2 border-b border-[#3a3022]">
          {(["detection", "humanisation"] as const).map((value) => (
            <button key={value} type="button" onClick={() => {
              setTab(value);
              if (value === "detection" && patternType === "authorLexicon") setPatternType("exactMatch");
            }} aria-pressed={tab === value} className={`px-3 py-3 font-cinzel text-xs tracking-wider uppercase ${tab === value ? "border-b-2 border-[#d4af37] text-[#e6c96f]" : "text-[#8f8373]"}`}>
              {value === "detection" ? "Règles de détection" : "Règles d'humanisation"}
            </button>
          ))}
        </div>
        <div className="overflow-y-auto p-5">
          <ul className="mb-6 space-y-2">
            {visibleRules.map((rule) => (
              <li key={rule.id} className="flex items-start gap-3 border border-[#30291e] bg-[#171410] p-3">
                <input type="checkbox" checked={rule.enabled} onChange={() => toggle(rule)} disabled={saving} aria-label={`Activer ${rule.name}`} className="mt-1 accent-[#d4af37]" />
                <div className="min-w-0 flex-1">
                  <p className="font-serif text-sm text-[#eee5d5]">{rule.name} <span className="text-[#d4af37]">· {rule.kind.category}</span></p>
                  <p className="mt-1 font-mono text-[10px] text-[#8f8373]">
                    {rule.kind.kind === "detection" ? `Malus · ${ruleWeight(rule)} points` : `Bonus · ${ruleWeight(rule)} %`}
                  </p>
                  <p className="mt-1 font-serif text-xs text-[#938879]">{rule.kind.explanation}</p>
                  {rule.kind.pattern && <p className="mt-1 break-all font-mono text-[10px] text-[#786e60]">{rule.kind.pattern}</p>}
                </div>
                {!rule.isBuiltin && <button type="button" onClick={() => remove(rule)} disabled={saving} aria-label={`Supprimer ${rule.name}`} className="text-[#9f6156] hover:text-[#d98676] disabled:opacity-50"><Trash2 size={15} /></button>}
              </li>
            ))}
          </ul>
          <p className="mb-5 border-l border-[#5b4621] pl-3 font-serif text-[11px] italic text-[#938879]">
            L'audit fournit des indices stylistiques, pas une preuve d'origine. Les signatures de watermarking exigent une clé et un procédé connus ; aucun faux détecteur générique n'est activé.
          </p>

          <form onSubmit={add} className="space-y-3 border-t border-[#3a3022] pt-5">
            <h3 className="font-cinzel text-xs tracking-widest text-[#d4af37] uppercase">Ajouter une règle</h3>
            <input value={name} onChange={(event) => setName(event.target.value)} maxLength={100} placeholder="Nom de la règle" aria-label="Nom de la règle" className="w-full border border-[#3a3022] bg-[#0e0d0b] px-3 py-2 font-serif text-sm text-[#f5efe4] placeholder:text-[#746b5e]" />
            <div className="grid gap-3 sm:grid-cols-2">
              <select value={patternType} onChange={(event) => setPatternType(event.target.value as StylometryPatternType)} aria-label="Type de motif" className="border border-[#3a3022] bg-[#0e0d0b] px-3 py-2 font-serif text-sm text-[#f5efe4]">
                {PATTERNS.filter((item) => tab === "humanisation" || item.value !== "authorLexicon").map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
              <input value={pattern} onChange={(event) => setPattern(event.target.value)} maxLength={500} placeholder="Motif recherché" aria-label="Motif recherché" className="border border-[#3a3022] bg-[#0e0d0b] px-3 py-2 font-serif text-sm text-[#f5efe4] placeholder:text-[#746b5e]" />
            </div>
            <label className="block font-serif text-xs text-[#a89f91]">
              Impact du score : {weight}
              <input type="range" min={1} max={20} value={weight} onChange={(event) => setWeight(Number(event.target.value))} className="mt-1 block w-full accent-[#d4af37]" />
            </label>
            <textarea value={explanation} onChange={(event) => setExplanation(event.target.value)} maxLength={500} rows={2} placeholder="Explication pédagogique affichée au signalement" aria-label="Explication pédagogique" className="w-full border border-[#3a3022] bg-[#0e0d0b] px-3 py-2 font-serif text-sm text-[#f5efe4] placeholder:text-[#746b5e]" />
            {tab === "detection" && <input value={suggestion} onChange={(event) => setSuggestion(event.target.value)} maxLength={500} placeholder="Suggestion de remplacement (facultative)" aria-label="Suggestion de remplacement" className="w-full border border-[#3a3022] bg-[#0e0d0b] px-3 py-2 font-serif text-sm text-[#f5efe4] placeholder:text-[#746b5e]" />}
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 border border-[#8f6e2b] px-4 py-2 font-cinzel text-[10px] tracking-wider text-[#e6c96f] uppercase hover:border-[#d4af37] disabled:opacity-50"><Plus size={13} /> Enregistrer la règle</button>
          </form>
        </div>
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[#3a3022] px-5 py-4">
          <button type="button" onClick={reset} disabled={saving} className="inline-flex items-center gap-2 font-cinzel text-[10px] tracking-wider text-[#a89f91] uppercase hover:text-[#d4af37] disabled:opacity-50"><RotateCcw size={13} /> Rétablir les règles d'usine</button>
          <button type="button" onClick={onClose} className="border border-[#3a3022] px-4 py-2 font-cinzel text-[10px] tracking-wider text-[#c9bea9] uppercase hover:border-[#8f6e2b]">Terminer</button>
        </footer>
        {error && <p role="alert" className="border-t border-[#7e3535] bg-[#301515] px-5 py-3 font-serif text-xs text-[#e39b91]">{error}</p>}
      </section>
    </div>
  );
};
