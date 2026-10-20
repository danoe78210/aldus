import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { BookOpen, Check, CircleHelp, Feather, FilePlus2, Loader2, X } from "lucide-react";
import { useStudio } from "./StudioContext";

const TYPOGRAPHIC_INSERTIONS = [
  { label: "« »", title: "Insérer des guillemets français", before: "«\u00a0", after: "\u00a0»" },
  { label: "—", title: "Insérer un cadratin de dialogue", before: "—\u00a0", after: "" },
  { label: "NBSP", title: "Insérer une espace insécable", before: "\u00a0", after: "" },
  { label: "’", title: "Insérer une apostrophe courbe", before: "’", after: "" },
  { label: "œ", title: "Insérer la ligature œ", before: "œ", after: "" },
  { label: "Œ", title: "Insérer la ligature Œ", before: "Œ", after: "" },
  { label: "æ", title: "Insérer la ligature æ", before: "æ", after: "" },
] as const;

const MarkdownManual: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="scribe-manual-title"
        className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-sm border border-[#806b3e] bg-[#171411] p-6 text-[#e2dbce] shadow-2xl"
      >
        <header className="mb-5 flex items-start gap-3 border-b border-[#3a3022] pb-4">
          <BookOpen className="mt-1 shrink-0 text-[#d4af37]" size={20} />
          <div className="min-w-0 flex-1">
            <h2 id="scribe-manual-title" className="font-serif text-xl text-[#e6c878]">Le Manuel du Scribe</h2>
            <p className="mt-1 text-xs text-[#a89f91]">Repères Markdown pour le manuscrit.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fermer le manuel" title="Fermer" className="rounded-sm p-1.5 text-[#bda888] hover:bg-white/5 hover:text-white">
            <X size={17} />
          </button>
        </header>
        <div className="space-y-5 text-sm leading-relaxed">
          <section>
            <h3 className="mb-2 font-serif text-base text-[#d4af37]">Titres et sections</h3>
            <pre className="overflow-x-auto rounded-sm border border-[#3a3022] bg-[#0f0d0b] p-3 text-xs text-[#eee5d5]">{`# Titre du chapitre\n\n## Une section\n\n### Un intertitre`}</pre>
            <p className="mt-2 text-[#c6bcad]">Un seul titre de niveau 1 par chapitre ; les niveaux suivants structurent les scènes ou les parties.</p>
          </section>
          <section>
            <h3 className="mb-2 font-serif text-base text-[#d4af37]">Dialogues et paragraphes</h3>
            <pre className="overflow-x-auto rounded-sm border border-[#3a3022] bg-[#0f0d0b] p-3 text-xs text-[#eee5d5]">{`— Vous êtes venu, dit-elle.\n— Je vous l'avais promis.\n\nIl referma la porte.`}</pre>
            <p className="mt-2 text-[#c6bcad]">Commencez chaque réplique par un cadratin. Laissez une ligne vide entre deux paragraphes.</p>
          </section>
          <section>
            <h3 className="mb-2 font-serif text-base text-[#d4af37]">Mise en relief</h3>
            <p className="text-[#c6bcad]">Entourez un mot d’un astérisque pour l’italique (<code className="text-[#e6c878]">*mot*</code>) ou de deux pour le gras (<code className="text-[#e6c878]">**mot**</code>).</p>
          </section>
          <section>
            <h3 className="mb-2 font-serif text-base text-[#d4af37]">Exergues</h3>
            <pre className="overflow-x-auto rounded-sm border border-[#3a3022] bg-[#0f0d0b] p-3 text-xs text-[#eee5d5]">{`> « Il faut cultiver notre jardin. »\n> — Voltaire`}</pre>
            <p className="mt-2 text-[#c6bcad]">Le chevron en début de ligne compose une citation ou une épigraphe en retrait.</p>
          </section>
          <section>
            <h3 className="mb-2 font-serif text-base text-[#d4af37]">Notes de bas de page</h3>
            <pre className="overflow-x-auto rounded-sm border border-[#3a3022] bg-[#0f0d0b] p-3 text-xs text-[#eee5d5]">{`Une phrase annotée[^archive].\n\n[^archive]: Référence ou précision destinée à la note.`}</pre>
          </section>
          <section>
            <h3 className="mb-2 font-serif text-base text-[#d4af37]">Séparateurs de scène</h3>
            <pre className="overflow-x-auto rounded-sm border border-[#3a3022] bg-[#0f0d0b] p-3 text-xs text-[#eee5d5]">{`La scène s'achève.\n\n* * *\n\nQuelques heures plus tard…`}</pre>
            <p className="mt-2 text-[#c6bcad]">Le séparateur peut aussi s’écrire <code className="text-[#e6c878]">---</code> sur une ligne isolée.</p>
          </section>
        </div>
      </section>
    </div>,
    document.body,
  );
};

export const WritingEditor: React.FC = () => {
  const {
    chapterFiles,
    sourceConfig,
    onPickSourcesDirectory,
    writingChapter,
    writingText,
    writingLoading,
    writingError,
    writingSaveState,
    loadWritingChapter,
    onWritingTextChange,
    createWritingChapter,
  } = useStudio();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newChapterName, setNewChapterName] = useState("");
  const [creatingChapter, setCreatingChapter] = useState(false);

  const insertAtSelection = (before: string, after: string) => {
    const area = textareaRef.current;
    if (!area) return;
    const start = area.selectionStart;
    const end = area.selectionEnd;
    const selected = writingText.slice(start, end);
    const next = `${writingText.slice(0, start)}${before}${selected}${after}${writingText.slice(end)}`;
    onWritingTextChange(next);
    const cursor = start + before.length + selected.length;
    window.requestAnimationFrame(() => {
      area.focus();
      area.setSelectionRange(cursor, cursor);
    });
  };

  const submitNewChapter = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!newChapterName.trim() || creatingChapter) return;
    setCreatingChapter(true);
    try {
      await createWritingChapter(newChapterName);
      setNewChapterName("");
      setCreating(false);
    } finally {
      setCreatingChapter(false);
    }
  };

  return (
    <div className="animate-ink-reveal flex h-full min-h-0 w-full flex-col gap-3 text-left">
      <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[#382f22] pb-3">
        <Feather size={19} className="text-[#c5a059]" />
        <h2 className="mr-auto font-serif text-lg tracking-[0.16em] text-[#d4af37] uppercase">III. L’Écritoire</h2>
        <label className="sr-only" htmlFor="writing-chapter">Chapitre à écrire</label>
        <select
          id="writing-chapter"
          aria-label="Sélectionner un chapitre"
          value={writingChapter}
          onChange={(event) => void loadWritingChapter(event.target.value)}
          disabled={writingLoading || chapterFiles.length === 0}
          className="max-w-[11rem] rounded-sm border border-[#3a3022] bg-[#13110f] px-2 py-1.5 text-xs text-[#eee5d5] disabled:opacity-50"
        >
          <option value="">Choisir un chapitre…</option>
          {chapterFiles.map((file) => <option key={file} value={file}>{file}</option>)}
        </select>
        <button
          type="button"
          onClick={() => setCreating((value) => !value)}
          disabled={!sourceConfig.directory}
          title="Créer un chapitre Markdown"
          aria-label="Créer un chapitre Markdown"
          className="rounded-sm border border-[#806b3e]/70 p-1.5 text-[#e6c878] transition-colors hover:bg-[#806b3e]/20 disabled:opacity-40"
        >
          <FilePlus2 size={16} />
        </button>
        <button
          type="button"
          onClick={() => setManualOpen(true)}
          className="flex items-center gap-1.5 rounded-sm border border-[#806b3e]/70 px-2.5 py-1.5 text-xs text-[#e6c878] transition-colors hover:bg-[#806b3e]/20"
        >
          <CircleHelp size={15} /> Le Manuel du Scribe
        </button>
      </header>

      {!sourceConfig.directory && (
        <div className="flex shrink-0 items-center justify-between gap-3 rounded-sm border border-[#806b3e]/40 bg-[#1a1712] px-3 py-2 text-xs text-[#c6bcad]">
          <span>Associez un dossier de sources pour ouvrir ou créer des chapitres.</span>
          <button type="button" onClick={onPickSourcesDirectory} className="shrink-0 text-[#e6c878] underline underline-offset-2">Choisir un dossier</button>
        </div>
      )}

      {creating && (
        <form onSubmit={(event) => void submitNewChapter(event)} className="flex shrink-0 items-center gap-2 rounded-sm border border-[#3a3022] bg-[#171411] p-2">
          <label className="sr-only" htmlFor="new-writing-chapter">Nom du nouveau chapitre</label>
          <input
            id="new-writing-chapter"
            autoFocus
            value={newChapterName}
            onChange={(event) => setNewChapterName(event.target.value)}
            placeholder="Nom du chapitre"
            className="min-w-0 flex-1 rounded-sm border border-[#3a3022] bg-[#13110f] px-2.5 py-1.5 text-sm text-[#f5f0e6] placeholder:text-[#857b6d]"
          />
          <span className="text-xs text-[#9e9587]">.md</span>
          <button type="submit" disabled={!newChapterName.trim() || creatingChapter} className="rounded-sm border border-[#806b3e]/70 px-2.5 py-1.5 text-xs text-[#e6c878] hover:bg-[#806b3e]/20 disabled:opacity-40">Créer</button>
          <button type="button" onClick={() => setCreating(false)} aria-label="Annuler la création" title="Annuler" className="rounded-sm p-1.5 text-[#a89f91] hover:text-white"><X size={15} /></button>
        </form>
      )}

      <div className="flex shrink-0 flex-wrap items-center gap-1 rounded-sm border border-[#3a3022] bg-[#171411] px-2 py-1.5" role="toolbar" aria-label="Réglet typographique">
        <span className="mr-2 font-serif text-[10px] uppercase tracking-wider text-[#9e9587]">Réglet</span>
        {TYPOGRAPHIC_INSERTIONS.map((item) => (
          <button
            key={item.title}
            type="button"
            title={item.title}
            aria-label={item.title}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => insertAtSelection(item.before, item.after)}
            className="badge-transform min-w-8 transition-colors hover:bg-[#c5a059]/10"
          >
            {item.label}
          </button>
        ))}
        <span className="ml-auto flex items-center gap-1.5 text-[10px] text-[#9e9587]" aria-live="polite">
          {writingLoading ? <Loader2 size={13} className="animate-spin" /> : writingSaveState === "saved" ? <Check size={13} className="text-[#c5a059]" /> : null}
          {writingLoading ? "Ouverture…" : writingSaveState === "saving" ? "Consignation…" : writingSaveState === "saved" ? "Consigné" : "Enregistrement automatique"}
        </span>
      </div>

      {writingError && <p role="alert" className="shrink-0 rounded-sm border border-red-500/40 bg-red-950/30 px-3 py-2 text-xs text-[#f0b5a9]">{writingError}</p>}

      <textarea
        ref={textareaRef}
        aria-label="Texte Markdown du chapitre"
        value={writingText}
        onChange={(event) => onWritingTextChange(event.target.value)}
        disabled={!writingChapter || writingLoading}
        spellCheck
        placeholder={writingChapter ? "Commencez votre chapitre…" : "Sélectionnez ou créez un chapitre Markdown."}
        className="min-h-0 flex-1 resize-none rounded-sm border border-[#3a3022] bg-[#13110f] p-4 font-sans text-sm leading-7 text-[#f0eadf] placeholder:text-[#766d60] focus:border-[#d4af37] focus:outline-none"
      />
      {manualOpen && <MarkdownManual onClose={() => setManualOpen(false)} />}
    </div>
  );
};

export const WritingPreview: React.FC = () => {
  const { writingChapter, writingText, writingLoading, manuscriptConfig } = useStudio();
  let paragraphIndex = 0;
  const fontFamily = manuscriptConfig.bodyFont === "Garamond"
    ? '"Cormorant Garamond", Georgia, serif'
    : `"${manuscriptConfig.bodyFont}", Georgia, serif`;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="mb-3 flex shrink-0 items-center gap-2 border-b border-[#382f22] pb-3">
        <BookOpen size={18} className="text-[#c5a059]" />
        <h2 className="font-serif text-base tracking-[0.14em] text-[#d4af37] uppercase">IV. La Feuille Composée</h2>
        <span className="ml-auto max-w-[45%] truncate text-xs text-[#a89f91]" title={writingChapter}>{writingChapter || "Aucun chapitre"}</span>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto rounded-sm border border-[#4a3e2c] bg-[#f5efe4] shadow-[inset_0_0_24px_rgba(70,48,20,0.08)]">
        {writingLoading ? (
          <div className="flex h-full items-center justify-center gap-2 text-sm text-[#71644f]"><Loader2 size={16} className="animate-spin" /> Chargement du manuscrit…</div>
        ) : writingChapter ? (
          <article
            className="writing-preview mx-auto min-h-full max-w-prose px-8 py-9 text-[#29251f] sm:px-10"
            style={{
              fontFamily,
              fontSize: `${Math.max(10, manuscriptConfig.bodySize)}pt`,
              lineHeight: manuscriptConfig.lineSpacing,
              textAlign: manuscriptConfig.textAlignment,
            }}
          >
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({ children }) => <h1 className="mb-7 text-center font-serif text-2xl font-semibold leading-tight">{children}</h1>,
                h2: ({ children }) => <h2 className="mb-4 mt-8 text-center font-serif text-xl">{children}</h2>,
                h3: ({ children }) => <h3 className="mb-3 mt-6 font-serif text-lg">{children}</h3>,
                p: ({ children }) => {
                  const isFirst = paragraphIndex++ === 0;
                  return <p className={`mb-4 ${isFirst && manuscriptConfig.dropCap ? "writing-preview__drop-cap" : ""}`}>{children}</p>;
                },
                blockquote: ({ children }) => <blockquote className="my-5 border-l-2 border-[#a68b5a] pl-4 italic text-[#5d5140]">{children}</blockquote>,
                hr: () => <div aria-label="Séparateur de scène" className="my-8 text-center font-serif tracking-[0.5em] text-[#8f6e2b]">✦ • ✦ • ✦</div>,
                ul: ({ children }) => <ul className="mb-4 list-disc pl-6">{children}</ul>,
                ol: ({ children }) => <ol className="mb-4 list-decimal pl-6">{children}</ol>,
                li: ({ children }) => <li className="mb-1">{children}</li>,
                section: ({ children }) => <section aria-label="Notes de bas de page" className="mt-10 border-t border-[#b6a78e] pt-4 text-[0.85em]">{children}</section>,
                a: ({ children, href }) => <a href={href} className="text-[#765b29] underline underline-offset-2">{children}</a>,
                strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                em: ({ children }) => <em>{children}</em>,
              }}
            >
              {writingText || "_Le chapitre est encore vierge._"}
            </ReactMarkdown>
          </article>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center text-[#71644f]">
            <Feather size={25} strokeWidth={1.4} />
            <p className="font-serif text-lg">L’épreuve prendra forme ici.</p>
            <p className="max-w-xs text-sm">Choisissez un chapitre sur le feuillet III pour en suivre la composition.</p>
          </div>
        )}
      </div>
    </div>
  );
};
