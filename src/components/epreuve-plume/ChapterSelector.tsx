import React from "react";
import { Loader2, ScrollText } from "lucide-react";

interface ChapterSelectorProps {
  chapters: string[];
  chapter: string;
  loading: boolean;
  disabled?: boolean;
  onChange: (chapter: string) => void;
}

export const ChapterSelector: React.FC<ChapterSelectorProps> = ({
  chapters,
  chapter,
  loading,
  disabled = false,
  onChange,
}) => (
  <label className="flex min-w-0 flex-1 items-center gap-2">
    <ScrollText size={15} className="shrink-0 text-[#8f6e2b]" aria-hidden />
    <select
      value={chapter}
      onChange={(event) => onChange(event.target.value)}
      disabled={loading || disabled}
      aria-label="Chapitre à auditer"
      className="h-10 min-w-0 flex-1 rounded-xs border border-[#3a3022] bg-[#13110f] px-3 font-serif text-sm text-[#f5efe4] focus:border-[#d4af37] focus:outline-none disabled:opacity-60"
    >
      <option value="">Choisir un chapitre…</option>
      {chapters.map((file) => (
        <option key={file} value={file}>{file}</option>
      ))}
    </select>
    {loading && <Loader2 size={15} className="animate-spin text-[#c5a059]" aria-label="Audit en cours" />}
  </label>
);
