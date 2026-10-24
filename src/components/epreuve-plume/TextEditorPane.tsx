import React, { useEffect, useRef, useState } from "react";
import { Save, X } from "lucide-react";
import type { EditTarget } from "./PlumeContext";

interface TextEditorPaneProps {
  text: string;
  target: EditTarget | null;
  onSave: (next: string) => Promise<void>;
  onCancel: () => void;
}

const TEXT_CLASS = "px-4 font-reading text-base leading-7 whitespace-pre-wrap break-words";

/** Index UTF-16 d'un offset exprimé en points de code Unicode (convention des alertes). */
const utf16Index = (text: string, codePoints: number) => Array.from(text).slice(0, codePoints).join("").length;

/**
 * Mode Retouche de l'Épreuve de Plume : Markdown brut sur fond ébène.
 * Un miroir invisible du texte, ligne par ligne, porte la numérotation : elle
 * reste alignée sur les lignes logiques même lorsque la prose s'enroule.
 */
export const TextEditorPane: React.FC<TextEditorPaneProps> = ({ text, target, onSave, onCancel }) => {
  const [draft, setDraft] = useState(text);
  const [saving, setSaving] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const areaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    area.focus({ preventScroll: true });
    if (!target) return;
    scrollRef.current?.querySelector(`[data-line="${target.line}"]`)?.scrollIntoView?.({ block: "center" });
    area.setSelectionRange(utf16Index(area.value, target.start), utf16Index(area.value, target.end));
  }, [target]);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await onSave(draft);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col border border-[#d4af37]/20 bg-[#121110]">
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto py-5">
        <div className="relative">
          <div aria-hidden className="pointer-events-none pb-8 select-none">
            {draft.split("\n").map((line, index) => (
              <div key={index} data-line={index + 1} className="flex">
                <span className="w-12 shrink-0 pr-2 text-right font-mono text-xs leading-7 text-[#6f6453]">{index + 1}</span>
                <span className={`invisible min-w-0 flex-1 ${TEXT_CLASS}`}>{line || " "}</span>
              </div>
            ))}
          </div>
          <textarea
            ref={areaRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
                event.preventDefault();
                void save();
              }
            }}
            lang="fr"
            spellCheck
            aria-label="Retouche du chapitre"
            className={`absolute inset-y-0 right-0 left-12 resize-none overflow-hidden border-0 bg-transparent text-[#f0ece1] caret-[#d4af37] outline-none selection:bg-[#d4af37]/30 ${TEXT_CLASS}`}
          />
        </div>
      </div>
      <div className="flex shrink-0 justify-end gap-2 border-t border-[#382f22] px-3 py-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="inline-flex items-center gap-1.5 border border-zinc-700 px-3 py-1.5 font-sans text-xs font-medium tracking-wide text-[#a8a29e] uppercase transition-colors hover:border-zinc-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          <X size={12} aria-hidden /> Annuler
        </button>
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="inline-flex items-center gap-1.5 border border-[#d4af37] bg-[#2a2318] px-3 py-1.5 font-sans text-xs font-medium tracking-wide text-[#d4af37] uppercase transition-colors hover:bg-[#382f20] hover:text-[#f0ece1] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Save size={12} aria-hidden /> {saving ? "Enregistrement…" : "Enregistrer & réévaluer"}
        </button>
      </div>
    </div>
  );
};
