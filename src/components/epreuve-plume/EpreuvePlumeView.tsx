import React, { useState } from "react";
import { Settings2 } from "lucide-react";
import { useStudio } from "../StudioContext";
import { ChapterSelector } from "./ChapterSelector";
import { GaugeWidget } from "./GaugeWidget";
import { usePlume } from "./PlumeContext";
import { RulesManagerModal } from "./RulesManagerModal";
import { TextHighlightViewer } from "./TextHighlightViewer";

/** Pupitre gauche de l'Épreuve de Plume : jauge, micro-métriques et feuillet annoté. */
export const EpreuvePlumeView: React.FC = () => {
  const { chapterFiles, proofChapter, proofText, proofDirty, proofLoading, proofError, loadProofChapter, onNotify, sourceConfig } = useStudio();
  const { rules, setRules, rulesError, error, report, activeIssues, applyingId, hoveredId, setFocusedId } = usePlume();
  const [rulesOpen, setRulesOpen] = useState(false);

  const placeholder = proofDirty ? "En attente d'enregistrement" : proofChapter ? "Audit en cours…" : "Choisissez un chapitre";

  return (
    <section className="animate-ink-reveal flex h-full w-full min-h-0 flex-col px-2 pr-1">
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
          <TextHighlightViewer
            text={proofText}
            issues={report ? activeIssues : []}
            hoveredId={hoveredId}
            onSelect={setFocusedId}
          />
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
