import { useCallback, useEffect, useState } from "react";
import { AudioLines, FolderOpen } from "lucide-react";
import type { AudioChapter, AudioChapterChoice, AudioGenerationProgress, LibraryConfig } from "../../types";
import { deleteLibraryAudioTrack, generateLibraryAudio, getLibraryConfig, listBookAudioChapters } from "../../utils/libraryApi";
import { AudioSetupDialog } from "../AudioSetupDialog";
import { ChapterSynthesisTable } from "./ChapterSynthesisTable";
import { SidecarConsole } from "./SidecarConsole";
import { PodcastRegie, PodcastWorkbench } from "./PodcastWorkbench";
import { useAudioEngine } from "./useAudioEngine";
import { usePodcastScript } from "./usePodcastScript";
import { useVoiceCasting } from "./useVoiceCasting";
import { VoiceChoir } from "./VoiceChoir";

interface StudioAudioViewProps {
  exportDirectory?: string | null;
  onPickExportDirectory?: () => void;
}

interface ChapterList {
  bookId: string;
  chapters: AudioChapterChoice[];
  error: string | null;
}

type AudioTab = "choeur" | "studio";

const messageOf = (reason: unknown, fallback: string): string => (reason instanceof Error ? reason.message : fallback);
const stageTitle = "font-cinzel text-xs tracking-wider text-[#d4af37] uppercase";
const selectClass ="mt-1 w-full min-w-0 rounded-sm border border-[#6b5327] bg-[#13110f] px-2 py-2 text-base text-[#f3f0ea] focus:border-[#d4af37] focus:outline-hidden disabled:opacity-50";

export const StudioAudioView = ({ exportDirectory, onPickExportDirectory }: StudioAudioViewProps) => {
  const engine = useAudioEngine();
  const [config, setConfig] = useState<LibraryConfig | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [chapterList, setChapterList] = useState<ChapterList | null>(null);
  const [generatingIndex, setGeneratingIndex] = useState<number | null>(null);
  const [progress, setProgress] = useState<AudioGenerationProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<AudioTab>("choeur");
  const [adaptIndex, setAdaptIndex] = useState<number | null>(null);

  const books = config?.books ?? [];
  const book = books.find((candidate) => candidate.id === selectedId) ?? books[0];
  const bookId = book?.id;
  const loadedChapters = chapterList?.bookId === bookId ? chapterList : null;
  const chapters = loadedChapters?.chapters ?? [];
  const tracks: AudioChapter[] = book?.audio?.chapters ?? [];
  const generating = generatingIndex !== null;
  const adaptChapter = chapters.find((chapter) => chapter.index === adaptIndex) ?? chapters[0];
  const podcast = usePodcastScript(bookId, adaptChapter?.index ?? null);
  const casting = useVoiceCasting(bookId, book?.audio?.casting, useCallback((saved: LibraryConfig) => setConfig(saved), []));

  useEffect(() => {
    let active = true;
    getLibraryConfig().then((loaded) => {
      if (active) setConfig(loaded);
    }).catch((reason: unknown) => {
      if (active) setError(messageOf(reason, "Registre du livre indisponible."));
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!bookId) return;
    let active = true;
    listBookAudioChapters(bookId).then((list) => {
      if (active) setChapterList({ bookId, chapters: list, error: list.length > 0 ? null : "Aucun chapitre narratif disponible." });
    }).catch((reason: unknown) => {
      if (active) setChapterList({ bookId, chapters: [], error: messageOf(reason, "Liste des chapitres audio indisponible.") });
    });
    return () => { active = false; };
  }, [bookId]);

  const polyphonicLines = podcast.script?.lines ?? [];
  const generate = (chapterIndex: number) => {
    if (!bookId || !exportDirectory || !engine.voiceId || generating) return;
    setGeneratingIndex(chapterIndex);
    setProgress(null);
    setError(null);
    const script = chapterIndex === adaptChapter?.index && polyphonicLines.length > 0
      ? polyphonicLines.map(({ role, kind, text }) => ({ role, kind, text }))
      : undefined;
    generateLibraryAudio(bookId, exportDirectory, engine.voiceId, chapterIndex, setProgress, script)
      .then(setConfig)
      .catch((reason: unknown) => setError(messageOf(reason, "Génération audio impossible.")))
      .finally(() => setGeneratingIndex(null));
  };

  const remove = (track: AudioChapter) => {
    if (!bookId || !exportDirectory || generating) return;
    if (!window.confirm(`Supprimer définitivement la piste audio « ${track.title} » ?`)) return;
    deleteLibraryAudioTrack(bookId, track.index, exportDirectory)
      .then(setConfig)
      .catch((reason: unknown) => setError(messageOf(reason, "Suppression de la piste impossible.")));
  };

  const blockReason = generating
    ? "Génération audio en cours…"
    : !engine.voiceId
      ? engine.voices.length === 0 ? (engine.voiceError ? null : "Chargement des profils vocaux…") : "Choisissez un profil de voix française dans Le Chœur."
      : !exportDirectory
        ? "Choisissez un dossier d’export dans Export → Inspection Pré-Presse → Parcourir les archives. Les MP3 y seront enregistrés."
        : loadedChapters?.error ?? (loadedChapters ? null : "Chargement des chapitres narratifs…");
  const canGenerate = !generating && Boolean(engine.voiceId) && Boolean(exportDirectory) && chapters.length > 0;

  const tabClass = (tab: AudioTab) => `border-b-2 px-4 py-2 font-cinzel text-xs tracking-wider uppercase transition-colors ${activeTab === tab ? "border-[#d4af37] text-[#d4af37]" : "border-transparent text-[#a99a83] hover:text-[#d4af37]"}`;

  return (
    <section aria-labelledby="studio-audio-title" className="flex h-full min-w-0 flex-col gap-5 overflow-y-auto p-6">
      <h2 id="studio-audio-title" className="flex items-center gap-2 font-cinzel text-sm text-[#d4af37]"><AudioLines size={16} /> Studio Audio</h2>
      {books.length > 0 && (
        <label className="max-w-md text-sm text-[#c9bea9]">Livre à enregistrer
          <select value={book?.id ?? ""} disabled={generating} onChange={(event) => setSelectedId(event.target.value)} className={selectClass}>
            {books.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.title}{candidate.tome ? ` · Tome ${candidate.tome}` : ""}</option>)}
          </select>
        </label>
      )}
      <div role="tablist" aria-label="Pages du Studio Audio" className="flex gap-1 border-b border-[#2e261c]">
        <button type="button" role="tab" id="audio-tab-choeur" aria-selected={activeTab === "choeur"} aria-controls="audio-panel-choeur" onClick={() => setActiveTab("choeur")} className={tabClass("choeur")}>Le Chœur</button>
        <button type="button" role="tab" id="audio-tab-studio" aria-selected={activeTab === "studio"} aria-controls="audio-panel-studio" onClick={() => setActiveTab("studio")} className={tabClass("studio")}>Le Studio</button>
      </div>
      {/* Les deux pages restent montées : le moteur et la progression survivent au changement d'onglet. */}
      <div role="tabpanel" id="audio-panel-choeur" aria-labelledby="audio-tab-choeur" className={`flex min-w-0 max-w-3xl flex-col gap-4 ${activeTab === "choeur" ? "" : "hidden"}`}>
        <SidecarConsole
          ready={engine.voices.length > 0}
          checking={engine.checking}
          initPercent={engine.initPercent}
          engineMode={engine.engineMode}
          cpmlAccepted={engine.cpmlAccepted}
          error={engine.voiceError}
          onRetry={() => { void engine.retry(); }}
          onOpenSetup={() => engine.setSetupOpen(true)}
        />
        <label className="text-sm text-[#c9bea9]">Profil de voix
          <select value={engine.voiceId} disabled={generating || engine.voices.length === 0} onChange={(event) => engine.setVoiceId(event.target.value)} className={selectClass}>
            {engine.voices.length === 0 && <option value="">{engine.checking
              ? `Chargement des profils vocaux (${engine.initPercent ?? 0}%)...`
              : engine.voiceError ? "Moteur vocal inactif" : "Chargement des voix…"}</option>}
            {engine.voices.map((voice) => <option key={voice.id} value={voice.id}>{voice.name}{voice.language ? ` · ${voice.language}` : ""}</option>)}
          </select>
        </label>
        <VoiceChoir voices={engine.voices} defaultVoiceId={engine.voiceId} previewingId={engine.previewingId} previewError={engine.previewError} onPreview={(id) => { void engine.preview(id); }} casting={casting} hasBook={Boolean(bookId)} />
      </div>
      <div role="tabpanel" id="audio-panel-studio" aria-labelledby="audio-tab-studio" className={`flex min-w-0 flex-col gap-4 ${activeTab === "studio" ? "" : "hidden"}`}>
        <div className="flex items-start gap-2 font-serif text-xs text-[#8c8275]">
          <span className="min-w-0 flex-1 break-words">{exportDirectory ? `Pistes MP3 enregistrées dans ${exportDirectory}` : "Aucun dossier d’export choisi."}</span>
          {onPickExportDirectory && <button type="button" aria-label="Choisir le dossier d’export" onClick={onPickExportDirectory} className="shrink-0 p-1 text-[#c5a059] hover:text-[#d4af37]"><FolderOpen size={16} /></button>}
        </div>
        {books.length === 0 ? (
          <p className="font-serif text-sm text-[#a99a83]">Aucun livre au Registre : ajoutez-en un depuis la Bibliothèque.</p>
        ) : (
          <>
            {book?.audio && book.audio.chapters.length > 0 && <p className="font-serif text-sm text-[#a99a83]">Édition audio · {book.audio.voiceName} · {book.audio.chapters.length} piste(s)</p>}
            <section aria-labelledby="stage-chapter-title" className="flex max-w-3xl flex-col gap-2">
              <h3 id="stage-chapter-title" className={stageTitle}>I. Sélection du chapitre</h3>
              <label className="text-sm text-[#c9bea9]">Chapitre à adapter
                <select value={adaptChapter?.index ?? ""} disabled={chapters.length === 0} onChange={(event) => setAdaptIndex(Number(event.target.value))} className={selectClass}>
                  {chapters.length === 0 && <option value="">Aucun chapitre disponible</option>}
                  {chapters.map((chapter) => <option key={chapter.index} value={chapter.index}>{chapter.index}. {chapter.title}</option>)}
                </select>
              </label>
            </section>
            <section aria-labelledby="stage-bench-title" className="flex max-w-3xl flex-col gap-2">
              <h3 id="stage-bench-title" className={stageTitle}>II. Banc d’adaptation &amp; Règles</h3>
              <PodcastWorkbench podcast={podcast} casting={casting} />
            </section>
            <section aria-labelledby="stage-regie-title" className="flex flex-col gap-3">
              <h3 id="stage-regie-title" className={stageTitle}>III. Régie de synthèse</h3>
              <PodcastRegie podcast={podcast} casting={casting} voices={engine.voices} defaultVoiceId={engine.voiceId} chapterTitle={adaptChapter?.title} />
              <ChapterSynthesisTable chapters={chapters} tracks={tracks} generatingIndex={generatingIndex} progress={progress} canGenerate={canGenerate} onGenerate={generate} onDelete={remove} />
              {blockReason && <p role="status" className="max-w-xl font-serif text-sm leading-relaxed text-[#c5a059]">{blockReason}</p>}
            </section>
          </>
        )}
        {error && <p role="alert" className="text-xs text-[#d28b75]">{error}</p>}
      </div>
      {engine.setupOpen && <AudioSetupDialog checking={engine.checking} engineMode={engine.engineMode} onRetry={() => { void engine.retry(); }} onAcceptAndStart={() => { void engine.acceptAndStart(); }} onClose={() => engine.setSetupOpen(false)} />}
    </section>
  );
};
