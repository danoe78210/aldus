import { useEffect, useState } from "react";
import { AudioLines, FolderOpen } from "lucide-react";
import type { AudioChapter, AudioChapterChoice, AudioGenerationProgress, LibraryConfig } from "../../types";
import { deleteLibraryAudioTrack, generateLibraryAudio, getLibraryConfig, listBookAudioChapters } from "../../utils/libraryApi";
import { AudioSetupDialog } from "../AudioSetupDialog";
import { ChapterSynthesisTable } from "./ChapterSynthesisTable";
import { SidecarConsole } from "./SidecarConsole";
import { useAudioEngine } from "./useAudioEngine";

interface StudioAudioViewProps {
  exportDirectory?: string | null;
  onPickExportDirectory?: () => void;
}

interface ChapterList {
  bookId: string;
  chapters: AudioChapterChoice[];
  error: string | null;
}

const messageOf = (reason: unknown, fallback: string): string => (reason instanceof Error ? reason.message : fallback);
const selectClass = "mt-1 w-full min-w-0 rounded-sm border border-[#6b5327] bg-[#13110f] px-2 py-2 text-base text-[#f3f0ea] focus:border-[#d4af37] focus:outline-hidden disabled:opacity-50";

export const StudioAudioView = ({ exportDirectory, onPickExportDirectory }: StudioAudioViewProps) => {
  const engine = useAudioEngine();
  const [config, setConfig] = useState<LibraryConfig | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [chapterList, setChapterList] = useState<ChapterList | null>(null);
  const [generatingIndex, setGeneratingIndex] = useState<number | null>(null);
  const [progress, setProgress] = useState<AudioGenerationProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  const books = config?.books ?? [];
  const book = books.find((candidate) => candidate.id === selectedId) ?? books[0];
  const bookId = book?.id;
  const loadedChapters = chapterList?.bookId === bookId ? chapterList : null;
  const chapters = loadedChapters?.chapters ?? [];
  const tracks: AudioChapter[] = book?.audio?.chapters ?? [];
  const generating = generatingIndex !== null;

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

  const generate = (chapterIndex: number) => {
    if (!bookId || !exportDirectory || !engine.voiceId || generating) return;
    setGeneratingIndex(chapterIndex);
    setProgress(null);
    setError(null);
    generateLibraryAudio(bookId, exportDirectory, engine.voiceId, chapterIndex, setProgress)
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
      ? engine.voices.length === 0 ? (engine.voiceError ? null : "Chargement des profils vocaux…") : "Choisissez un profil de voix française."
      : !exportDirectory
        ? "Choisissez un dossier d’export dans Export → Inspection Pré-Presse → Parcourir les archives. Les MP3 y seront enregistrés."
        : loadedChapters?.error ?? (loadedChapters ? null : "Chargement des chapitres narratifs…");
  const canGenerate = !generating && Boolean(engine.voiceId) && Boolean(exportDirectory) && chapters.length > 0;

  return (
    <section aria-labelledby="studio-audio-title" className="flex h-full min-w-0 flex-col gap-5 overflow-y-auto p-6">
      <h2 id="studio-audio-title" className="flex items-center gap-2 font-cinzel text-sm text-[#d4af37]"><AudioLines size={16} /> Studio Audio</h2>
      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(16rem,22rem)_1fr]">
        <div className="flex min-w-0 flex-col gap-4">
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
          <div className="flex items-start gap-2 font-serif text-xs text-[#8c8275]">
            <span className="min-w-0 flex-1 break-words">{exportDirectory ? `Pistes MP3 enregistrées dans ${exportDirectory}` : "Aucun dossier d’export choisi."}</span>
            {onPickExportDirectory && <button type="button" aria-label="Choisir le dossier d’export" onClick={onPickExportDirectory} className="shrink-0 p-1 text-[#c5a059] hover:text-[#d4af37]"><FolderOpen size={16} /></button>}
          </div>
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          {books.length === 0 ? (
            <p className="font-serif text-sm text-[#a99a83]">Aucun livre au Registre : ajoutez-en un depuis la Bibliothèque.</p>
          ) : (
            <>
              <label className="text-sm text-[#c9bea9]">Livre à enregistrer
                <select value={book?.id ?? ""} disabled={generating} onChange={(event) => setSelectedId(event.target.value)} className={selectClass}>
                  {books.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.title}{candidate.tome ? ` · Tome ${candidate.tome}` : ""}</option>)}
                </select>
              </label>
              {book?.audio && <p className="font-serif text-sm text-[#a99a83]">Édition audio · {book.audio.voiceName} · {book.audio.chapters.length} piste(s)</p>}
              <ChapterSynthesisTable chapters={chapters} tracks={tracks} generatingIndex={generatingIndex} progress={progress} canGenerate={canGenerate} onGenerate={generate} onDelete={remove} />
              {blockReason && <p role="status" className="max-w-xl font-serif text-sm leading-relaxed text-[#c5a059]">{blockReason}</p>}
            </>
          )}
          {error && <p role="alert" className="text-xs text-[#d28b75]">{error}</p>}
        </div>
      </div>
      {engine.setupOpen && <AudioSetupDialog checking={engine.checking} engineMode={engine.engineMode} onRetry={() => { void engine.retry(); }} onAcceptAndStart={() => { void engine.acceptAndStart(); }} onClose={() => engine.setSetupOpen(false)} />}
    </section>
  );
};
