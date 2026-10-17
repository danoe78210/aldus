import { useEffect, useState } from "react";
import { ArrowLeft, AudioLines, BookOpen, Trash2 } from "lucide-react";
import type { AudioChapterChoice, AudioGenerationProgress, AudioVoice, Book, Shelf } from "../types";
import { acceptAudioModelTerms, libraryCoverUrl, listAudioVoices, listBookAudioChapters, openLibraryResource } from "../utils/libraryApi";
import { LibraryDeleteDialog } from "./LibraryDeleteDialog";
import { AudioTrackPlayer } from "./AudioTrackPlayer";
import { AudioSetupDialog } from "./AudioSetupDialog";

interface LibraryBookDetailProps {
  book: Book;
  initialFormat?: "epub" | "pdf" | "docx" | "audio";
  exportDirectory?: string | null;
  shelves: Shelf[];
  busy: boolean;
  onBack: () => void;
  onMove: (bookId: string, shelfId: string) => void;
  onDelete: (bookId: string) => Promise<boolean>;
  onGenerateAudio?: (bookId: string, voiceId: string, chapterIndex: number | null, onProgress: (progress: AudioGenerationProgress) => void) => Promise<boolean>;
  operationError?: string | null;
}

const INACTIVE_TTS_MESSAGE = "Le moteur vocal local est inactif. Veuillez lancer le wrapper TTS sur le port 8020 ou configurer ALDUS_TTS_URL.";

export const LibraryBookDetail = ({ book, initialFormat, exportDirectory, shelves, busy, onBack, onMove, onDelete, onGenerateAudio, operationError }: LibraryBookDetailProps) => {
  const [error, setError] = useState<string | null>(null);
  const [failedCover, setFailedCover] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [voices, setVoices] = useState<AudioVoice[]>([]);
  const [voiceId, setVoiceId] = useState("");
  const [audioChapters, setAudioChapters] = useState<AudioChapterChoice[]>([]);
  const [chapterSelection, setChapterSelection] = useState("all");
  const [chapterError, setChapterError] = useState<string | null>(null);
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [audioProgress, setAudioProgress] = useState<AudioGenerationProgress | null>(null);
  const [audioBusy, setAudioBusy] = useState(false);
  const [checkingAudio, setCheckingAudio] = useState(false);
  const [audioSetupOpen, setAudioSetupOpen] = useState(false);
  const standardFiles = (["epub", "pdf", "docx"] as const).flatMap((format) => (book.files ?? [])
    .filter((file) => file.format === format)
    .sort((first, second) => (book.fileStatistics?.[second.path]?.lastModified ?? 0) - (book.fileStatistics?.[first.path]?.lastModified ?? 0))
    .slice(0, 1));
  const files = book.audio?.chapters[0] ? [...standardFiles, { path: book.audio.chapters[0].path, format: "audio" as const }] : standardFiles;
  const [selectedPath, setSelectedPath] = useState<string | null>(() => files.find((file) => file.format === initialFormat)?.path ?? null);
  const selectedFile = files.find((file) => file.path === selectedPath) ?? files.find((file) => file.format === "epub") ?? files[0];
  const statistics = selectedFile ? book.fileStatistics?.[selectedFile.path] : undefined;
  const legacyStatistics = !statistics && selectedFile?.format !== "docx";
  const pageCount = statistics ? statistics.pageCount : legacyStatistics ? book.pageCount : undefined;
  const chapterCount = statistics ? statistics.chapterCount : legacyStatistics && book.chapterCountAvailable !== false ? book.chapterCount : undefined;
  const lastModified = statistics ? statistics.lastModified : legacyStatistics ? book.lastModified : undefined;
  const coverUrl = book.coverPath ? libraryCoverUrl(book.coverPath) : undefined;
  const modifiedDate = lastModified != null ? new Date(lastModified) : null;
  const validDate = modifiedDate && !Number.isNaN(modifiedDate.getTime()) ? modifiedDate : null;
  const audioActionLabel = audioBusy
    ? audioProgress?.segmentIndex != null && audioProgress.segmentCount != null
      ? `Forge du chapitre ${audioProgress.chapterIndex} · segment ${audioProgress.segmentIndex}/${audioProgress.segmentCount}`
      : audioProgress?.chapterTitle
        ? `Forge du chapitre ${audioProgress.chapterIndex}…`
        : "Forge audio en cours…"
    : "Générer l’édition audio";
  const audioBlockReason = audioBusy
    ? "Génération audio en cours…"
    : busy
      ? "Une opération sur le livre est en cours."
      : voiceError
        ? null
        : !voiceId
          ? voices.length === 0 ? "Chargement des profils vocaux…" : "Choisissez un profil de voix française."
          : !exportDirectory
            ? "Choisissez un dossier d’export dans Export → Inspection Pré-Presse → Parcourir les archives. Les MP3 y seront enregistrés."
            : !onGenerateAudio
              ? "La génération audio n’est pas disponible dans cette vue."
              : chapterError ?? (audioChapters.length === 0 ? "Chargement des chapitres narratifs…" : null);
  useEffect(() => {
    let active = true;
    listAudioVoices().then((available) => {
      if (!active) return;
      if (available.length === 0) {
        setVoices([]);
        setVoiceId("");
        setVoiceError(INACTIVE_TTS_MESSAGE);
        if (!book.audio) setAudioSetupOpen(true);
        return;
      }
      setVoices(available);
      setVoiceId((current) => current || available[0]?.id || "");
      setVoiceError(null);
    }).catch((reason: unknown) => {
      if (active) {
        setVoiceError(reason instanceof Error ? reason.message : INACTIVE_TTS_MESSAGE);
        if (!book.audio) setAudioSetupOpen(true);
      }
    });
    return () => { active = false; };
  }, [book.audio]);
  useEffect(() => {
    let active = true;
    listBookAudioChapters(book.id).then((chapters) => {
      if (!active) return;
      setAudioChapters(chapters);
      setChapterError(chapters.length > 0 ? null : "Aucun chapitre narratif disponible.");
    }).catch((reason: unknown) => {
      if (!active) return;
      setAudioChapters([]);
      setChapterError(reason instanceof Error ? reason.message : "Liste des chapitres audio indisponible.");
    });
    return () => { active = false; };
  }, [book.id]);
  const retryAudioEngine = async () => {
    setCheckingAudio(true);
    try {
      const available = await listAudioVoices();
      if (available.length === 0) throw new Error(INACTIVE_TTS_MESSAGE);
      setVoices(available);
      setVoiceId((current) => available.some((voice) => voice.id === current) ? current : available[0].id);
      setVoiceError(null);
      setAudioSetupOpen(false);
    } catch (reason) {
      setVoiceError(reason instanceof Error ? reason.message : INACTIVE_TTS_MESSAGE);
    } finally {
      setCheckingAudio(false);
    }
  };
  const acceptTermsAndStartAudio = async () => {
    setCheckingAudio(true);
    try {
      await acceptAudioModelTerms();
      const available = await listAudioVoices();
      if (available.length === 0) throw new Error(INACTIVE_TTS_MESSAGE);
      setVoices(available);
      setVoiceId((current) => available.some((voice) => voice.id === current) ? current : available[0].id);
      setVoiceError(null);
      setAudioSetupOpen(false);
    } catch (reason) {
      setVoiceError(reason instanceof Error ? reason.message : INACTIVE_TTS_MESSAGE);
    } finally {
      setCheckingAudio(false);
    }
  };
  const open = async () => {
    if (opening || !selectedFile) return;
    setOpening(true);
    try {
      setError(null);
      await openLibraryResource(book.id, selectedFile.path);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setOpening(false);
    }
  };

  return (
    <section aria-labelledby="library-register-title" className="flex min-w-0 flex-col gap-5">
      <button type="button" onClick={onBack} disabled={busy} className="flex w-fit items-center gap-2 py-1 font-cinzel text-xs text-[#c5a059] hover:text-[#d4af37] disabled:opacity-40"><ArrowLeft size={16} /> Retour aux rayons</button>
      <h2 id="library-register-title" className="font-cinzel text-sm text-[#d4af37]">Le Registre du Livre</h2>
      <div className="flex flex-wrap items-start gap-6">
        <div className="aspect-[2/3] w-40 max-w-full shrink-0 overflow-hidden rounded-sm border border-[#6b5327] bg-[#181614] shadow-lg">
          {coverUrl && failedCover !== coverUrl ? (
            <img src={coverUrl} alt={`Couverture de ${book.title}`} onError={() => setFailedCover(coverUrl)} className="h-full w-full object-contain" />
          ) : (
            <div role="img" aria-label={`Couverture vierge de ${book.title}`} className="flex h-full flex-col items-center justify-center gap-5 border-l-[6px] border-[#382f22] px-4 text-center text-[#b89355]">
              <BookOpen size={28} strokeWidth={1} />
              <span className="max-w-full break-words font-cinzel text-sm">{book.title}</span>
              {book.tome && <span className="font-serif text-xs">Tome {book.tome}</span>}
            </div>
          )}
        </div>
        <div className="flex min-w-0 flex-[1_1_180px] flex-col gap-4">
          <div>
            <h3 className="break-words font-cinzel text-base text-[#f3f0ea]">{book.title}</h3>
            {book.tome && <p className="mt-1 font-serif text-sm text-[#c9bea9]">Tome {book.tome}</p>}
          </div>
          <label className="text-xs text-[#c9bea9]">Emplacement actuel
            <select value={book.shelfId} disabled={busy} onChange={(event) => onMove(book.id, event.target.value)} className="mt-2 w-full min-w-0 rounded-sm border border-[#4a3b2c] bg-[#141210] px-2 py-2 text-sm text-[#f3f0ea]">
              {shelves.map((shelf) => <option key={shelf.id} value={shelf.id}>{shelf.label}</option>)}
            </select>
          </label>
          {files.length > 0 && (
            <div role="group" aria-label="Formats disponibles" className="flex flex-wrap gap-2">
              {files.map((file) => (
                <button key={file.path} type="button" aria-pressed={selectedFile?.path === file.path} disabled={busy || opening} title={file.path} onClick={() => { setSelectedPath(file.path); setError(null); }} className={`rounded-sm border px-2.5 py-1 font-cinzel text-[10px] transition-colors disabled:opacity-40 ${selectedFile?.path === file.path ? "border-[#d4af37] bg-[#302619] text-[#d4af37]" : "border-[#4a3b2c] text-[#a99a83] hover:border-[#8f6e2b] hover:text-[#d4af37]"}`}>
                  {file.format.toUpperCase()}
                </button>
              ))}
            </div>
          )}
          <div className="flex flex-col items-start gap-3 border-t border-[#382f22] pt-4">
            <button type="button" disabled={busy || opening || !selectedFile} onClick={() => void open()} className="flex max-w-full items-center gap-2 rounded-sm border border-[#8f6e2b] bg-[#211c15] px-3 py-2 text-left font-cinzel text-xs text-[#d4af37] hover:bg-[#302619] disabled:opacity-40"><BookOpen size={16} className="shrink-0" /> Ouvrir le livre</button>
          </div>
          <section aria-labelledby="audio-studio-title" className="flex flex-col gap-3 border-t border-[#382f22] pt-4">
            <h3 id="audio-studio-title" className="flex items-center gap-2 font-cinzel text-xs text-[#d4af37]"><AudioLines size={15} /> Studio Audio</h3>
            {book.audio && (
              <div aria-label="Pupitre de lecture audio" className="flex flex-col gap-3 rounded-sm border border-[#3a3228] bg-[#15120f] p-3">
                <p className="font-serif text-xs text-[#a99a83]">Édition audio · {book.audio.voiceName} · {book.audio.chapters.length} chapitre(s)</p>
                  <ol className="flex flex-col gap-3">
                    {book.audio.chapters.map((chapter) => (
                      <li key={chapter.path} className="flex min-w-0 flex-col gap-1.5 border-t border-[#3a3228] pt-2 font-serif text-xs text-[#c9bea9]">
                        <span>{chapter.index}. {chapter.title}</span>
                        <AudioTrackPlayer title={chapter.title} src={libraryCoverUrl(chapter.path)} />
                      </li>
                    ))}
                  </ol>
              </div>
            )}
            <>
                <label className="text-xs text-[#c9bea9]">Profil de voix
                  <select value={voiceId} disabled={busy || audioBusy || voices.length === 0} onChange={(event) => setVoiceId(event.target.value)} className="mt-1 w-full min-w-0 rounded-sm border border-[#6b5327] bg-[#15120f] px-2 py-2 text-sm text-[#f3f0ea] shadow-[inset_0_1px_0_rgba(212,175,55,0.08)] focus:border-[#d4af37] focus:outline-hidden disabled:opacity-50">
                    {voices.length === 0 && <option value="">{voiceError ? "Moteur vocal inactif" : "Chargement des voix…"}</option>}
                    {voices.map((voice) => <option key={voice.id} value={voice.id}>{voice.name}{voice.language ? ` · ${voice.language}` : ""}</option>)}
                  </select>
                </label>
                <label className="text-xs text-[#c9bea9]">Chapitre à synthétiser
                  <select aria-label="Chapitre à synthétiser" value={chapterSelection} disabled={busy || audioBusy || audioChapters.length === 0} onChange={(event) => setChapterSelection(event.target.value)} className="mt-1 w-full min-w-0 rounded-sm border border-[#d4af37] bg-[#13110f] px-2 py-2 text-sm text-[#f3f0ea] focus:border-[#d4af37] focus:outline-hidden disabled:opacity-50">
                    <option value="all">Tous les chapitres</option>
                    {audioChapters.map((chapter) => <option key={chapter.index} value={chapter.index}>{chapter.index}. {chapter.title}</option>)}
                  </select>
                </label>
                {voiceError && <aside role="status" className="flex flex-wrap items-center justify-between gap-2 rounded-sm border border-[#8f6e2b]/40 bg-[#241e17] px-3 py-2.5 font-serif text-xs leading-relaxed text-[#c5a059]"><span>{voiceError}</span><button type="button" onClick={() => setAudioSetupOpen(true)} className="shrink-0 border-b border-[#8f6e2b]/60 font-cinzel text-[10px] text-[#d4af37] hover:text-[#f3d995]">Ouvrir l’assistant</button></aside>}
                <button type="button" aria-busy={audioBusy} aria-label={audioActionLabel} disabled={busy || audioBusy || !voiceId || !exportDirectory || !onGenerateAudio || audioChapters.length === 0} onClick={() => {
                  if (!onGenerateAudio) return;
                  const chapterIndex = chapterSelection === "all" ? null : Number(chapterSelection);
                  setAudioBusy(true);
                  setVoiceError(null);
                  setAudioProgress(null);
                  void onGenerateAudio(book.id, voiceId, chapterIndex, setAudioProgress).then((success) => {
                    if (success) {
                      const chapterTitle = audioChapters.find((chapter) => chapter.index === chapterIndex)?.title;
                      setAudioProgress((progress) => progress ? {
                        ...progress,
                        progress: 100,
                        chapterTitle: chapterTitle ?? "",
                        status: chapterIndex == null ? "Édition audio terminée" : `Piste du chapitre ${chapterIndex} mise à jour`,
                      } : progress);
                    }
                  }).catch((reason: unknown) => setVoiceError(reason instanceof Error ? reason.message : "Génération audio impossible."))
                    .finally(() => setAudioBusy(false));
                }} className={`flex w-fit items-center gap-2 rounded-sm border px-3 py-2 font-cinzel text-[10px] transition-all disabled:cursor-not-allowed ${audioBusy ? "animate-pulse border-[#d4af37] bg-[#2b2112] text-[#f3d995] opacity-100 shadow-[0_0_18px_rgba(212,175,55,0.3)]" : "border-[#8f6e2b] bg-[#211c15] text-[#d4af37] hover:bg-[#302619] disabled:opacity-40"}`}><AudioLines size={15} className={audioBusy ? "animate-pulse" : undefined} /> {audioActionLabel}</button>
                {audioBlockReason && <p role="status" className="max-w-xl font-serif text-xs leading-relaxed text-[#c5a059]">{audioBlockReason}</p>}
            </>
          </section>
          <section aria-label="Statistiques de l’ouvrage" className="border-t border-[#382f22] pt-4">
            <dl className="space-y-3 font-serif text-xs text-[#8c8275]">
              <div className="flex flex-wrap justify-between gap-x-3 gap-y-1"><dt>Nbre de pages :</dt><dd>{pageCount ?? "Non disponible"}</dd></div>
              <div className="flex flex-wrap justify-between gap-x-3 gap-y-1"><dt>Nbre de chapitres :</dt><dd>{chapterCount != null && Number.isFinite(chapterCount) ? chapterCount : "\u2014"}</dd></div>
              {selectedFile?.format === "docx" && <div className="flex flex-wrap justify-between gap-x-3 gap-y-1"><dt>Nbre de mots :</dt><dd>{statistics?.wordCount?.toLocaleString("fr-FR") ?? "\u2014"}</dd></div>}
              <div className="flex flex-wrap justify-between gap-x-3 gap-y-1"><dt>Date de dernière modification :</dt><dd>{validDate ? <time dateTime={validDate.toISOString()}>{validDate.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}</time> : "Non disponible"}</dd></div>
            </dl>
          </section>
          <div className="border-t border-[#382f22] pt-4">
            <button type="button" disabled={busy || opening} onClick={() => setConfirmDelete(true)} className="flex items-center gap-2 py-1 font-serif text-xs text-[#b17b64] hover:text-[#d7a18d] disabled:opacity-40"><Trash2 size={14} /> Supprimer l’ouvrage</button>
          </div>
        </div>
      </div>
      {error && <p role="alert" className="text-xs text-[#d28b75]">{error}</p>}
      {operationError && !confirmDelete && <p role="alert" className="text-xs text-[#d28b75]">{operationError}</p>}
      {confirmDelete && <LibraryDeleteDialog title={book.title} busy={busy} error={operationError} onCancel={() => setConfirmDelete(false)} onConfirm={() => { void onDelete(book.id); }} />}
      {audioSetupOpen && <AudioSetupDialog checking={checkingAudio} onRetry={() => { void retryAudioEngine(); }} onAcceptTerms={() => { void acceptTermsAndStartAudio(); }} onClose={() => setAudioSetupOpen(false)} />}
    </section>
  );
};