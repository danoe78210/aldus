import React, { useState } from "react";
import { ArrowUpRight, Settings2 } from "lucide-react";
import { useStudio } from "../StudioContext";
import { ChapterSelector } from "./ChapterSelector";
import { GaugeWidget } from "./GaugeWidget";
import { usePlume, type PlumeMode } from "./PlumeContext";
import { RulesManagerModal } from "./RulesManagerModal";
import { TextEditorPane } from "./TextEditorPane";
import { TextHighlightViewer } from "./TextHighlightViewer";

const MODES: Array<{ id: PlumeMode; icon: string; label: string }> = [
  { id: "epreuve", icon: "👁", label: "Épreuve" },
  { id: "retouche", icon: "✏", label: "Retouche" },
];

/** Pupitre gauche de l'Épreuve de Plume : jauge, micro-métriques et feuillet annoté ou en retouche. */
export const EpreuvePlumeView: React.FC<{ onOpenCorrector?: () => void }> = ({ onOpenCorrector }) => {
  const { chapterFiles, proofChapter, proofText, proofDirty, proofLoading, proofError, loadProofChapter, onNotify, sourceConfig, saveProofRevisions } = useStudio();
  const { rules, setRules, rulesError, error, report, activeIssues, applyingId, hoveredId, setFocusedId, mode, editTarget, openEditor, closeEditor } = usePlume();
  const [rulesOpen, setRulesOpen] = useState(false);
  const editing = mode === "retouche";

  const placeholder = proofDirty ? "En attente d'enregistrement" : proofChapter ? "Audit en cours…" : "Choisissez un chapitre";

  // Le brouillon n'est quitté qu'une fois l'instantané et l'écriture atomique réussis.
  const saveRetouche = async (next: string) => {
    if (await saveProofRevisions(next)) closeEditor();
  };

  return (
    <section className="animate-ink-reveal flex h-full w-full min-h-0 flex-col px-2 pr-1">
      <header className="mb-5 shrink-0 text-center">
        <p className="font-cinzel text-[10px] tracking-[0.3em] text-[#8f6e2b] uppercase">Épreuve stylistique locale</p>
        <h1 className="mt-1 font-cinzel text-base tracking-[0.22em] text-[#d4af37] uppercase">Épreuve de Plume</h1>
      </header>
      <div className="mb-4 flex shrink-0 flex-wrap items-center gap-3">
        <ChapterSelector chapters={chapterFiles} chapter={proofChapter} loading={proofLoading || applyingId !== null} disabled={editing} onChange={(file) => void loadProofChapter(file)} />
        <button type="button" onClick={() => setRulesOpen(true)} className="inline-flex h-10 shrink-0 items-center gap-2 border border-[#3a3022] px-3 font-cinzel text-[10px] tracking-wider text-[#c9bea9] uppercase hover:border-[#8f6e2b] hover:text-[#d4af37]">
          <Settings2 size={14} /> Gérer les règles
        </button>
        {onOpenCorrector && (
          <button
            type="button"
            onClick={onOpenCorrector}
            disabled={editing}
            title={editing ? "Enregistrez ou annulez la retouche en cours" : "Travail d'écriture long, sans l'audit stylométrique"}
            className="inline-flex h-10 shrink-0 items-center gap-1 px-1 font-cinzel text-[10px] tracking-wider text-[#a89f91] uppercase hover:text-[#d4af37] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Ouvrir dans le Correcteur <ArrowUpRight size={12} aria-hidden />
          </button>
        )}
      </div>

      {!sourceConfig.directory && <p className="mb-3 border border-[#5b4621] bg-[#241c10] px-3 py-2 font-serif text-xs text-[#d8c7a2]">Configurez le dossier des sources du projet pour lancer un audit.</p>}
      {[rulesError, error, proofError].filter(Boolean).map((message) => (
        <p key={message} role="alert" className="mb-3 border border-[#7e3535] bg-[#301515] px-3 py-2 font-serif text-xs text-[#e39b91]">{message}</p>
      ))}
      {proofDirty && <p className="mb-3 border border-[#5b4621] bg-[#241c10] px-3 py-2 font-serif text-xs text-[#d8c7a2]">Enregistrez d'abord les retouches en attente dans le Correcteur pour auditer le fichier à jour.</p>}

      <GaugeWidget
        risk={report?.aiRiskPercent ?? null}
        burstiness={report?.burstinessScore ?? null}
        lexicalRichness={report?.lexicalRichness ?? null}
        placeholder={placeholder}
        alertCount={activeIssues.length}
      />

      <div className="mt-4 flex min-h-0 flex-1 flex-col">
        {proofChapter && proofText ? (
          <>
            <div role="group" aria-label="Mode du feuillet" className="mb-2 flex shrink-0 self-start rounded-xs border border-[#382f22] bg-[#141210]">
              {MODES.map(({ id, icon, label }) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={mode === id}
                  disabled={applyingId !== null}
                  onClick={() => {
                    if (id === "epreuve") closeEditor();
                    else if (!editing) openEditor();
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-1 font-cinzel text-[11px] tracking-wider uppercase transition-colors first:border-r first:border-[#382f22] disabled:opacity-50 ${
                    mode === id ? "bg-[#2d2212] text-[#f3e5ab]" : "text-[#a89f91] hover:text-[#c5a059]"
                  }`}
                >
                  <span aria-hidden className="text-xs">{icon}</span>
                  <span>{label}</span>
                </button>
              ))}
            </div>
            {editing ? (
              <TextEditorPane text={proofText} target={editTarget} onSave={saveRetouche} onCancel={closeEditor} />
            ) : (
              <TextHighlightViewer
                text={proofText}
                issues={report ? activeIssues : []}
                hoveredId={hoveredId}
                onSelect={setFocusedId}
              />
            )}
          </>
        ) : (
          <p className="text-center font-serif text-sm italic text-[#a89f91]">
            {proofChapter && proofLoading ? "Chargement du chapitre…" : "Le feuillet annoté apparaîtra ici."}
          </p>
        )}
      </div>
      {rulesOpen && <RulesManagerModal rules={rules} onRulesChange={setRules} onNotify={onNotify} onClose={() => setRulesOpen(false)} />}
    </section>
  );
};
