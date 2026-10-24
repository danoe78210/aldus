import { useEffect, useState } from "react";
import { AudioLines, Disc3 } from "lucide-react";
import type { AudioChapter, Book, LibraryConfig } from "../../types";
import { getLibraryConfig, libraryCoverUrl } from "../../utils/libraryApi";
import { burnDetails } from "./burnDetails";
import { TapeDeck } from "./TapeDeck";

interface AudioReaderViewProps {
  currentBookTitle?: string;
  onOpenStudio?: () => void;
}

interface Selection {
  bookId: string;
  chapterIndex?: number;
  autoPlay: boolean;
}

const stageTitle = "font-cinzel text-xs tracking-wider text-[#d4af37] uppercase";
const normalize = (value: string): string => value.trim().toLocaleLowerCase("fr");
const discTracks = (book: Book): AudioChapter[] => [...(book.audio?.chapters ?? [])].sort((a, b) => a.index - b.index);
const label = (book: Book): string => `${book.title}${book.tome ? ` · Tome ${book.tome}` : ""}`;

const Disc = ({ book, active, onSelect }: { book: Book; active: boolean; onSelect: () => void }) => (
  <button type="button" aria-pressed={active} aria-label={`Disque ${label(book)}`} onClick={onSelect} className={`flex w-32 flex-col items-center gap-2 rounded-sm p-2 text-center transition-colors ${active ? "bg-[#211c15]" : "hover:bg-[#1a1612]"}`}>
    <span
      aria-hidden="true"
      className={`flex h-28 w-28 items-center justify-center rounded-full border ${active ? "border-[#d4af37]" : "border-[#3a2f1d]"}`}
      style={{ background: "repeating-radial-gradient(circle, #0b0a09 0 2px, #1a1714 2px 4px)" }}
    >
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[#d4af37] p-1.5 font-cinzel text-[7px] leading-tight text-[#13110f] uppercase">
        <span className="line-clamp-4 break-words">{book.title}</span>
      </span>
    </span>
    <span className="font-serif text-xs text-[#c9bea9]">{(book.audio?.chapters.length ?? 0)} piste(s)</span>
  </button>
);

/** Le Lecteur : un disque par livre gravé, lu sur la bande magnétique. */
export const AudioReaderView = ({ currentBookTitle, onOpenStudio }: AudioReaderViewProps) => {
  const [config, setConfig] = useState<LibraryConfig | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);

  useEffect(() => {
    let active = true;
    getLibraryConfig()
      .then((loaded) => { if (active) setConfig(loaded); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : typeof reason === "string" ? reason : "Registre du livre indisponible."); });
    return () => { active = false; };
  }, []);

  const discs = (config?.books ?? []).filter((book) => discTracks(book).length > 0);
  const disc = discs.find((book) => book.id === selection?.bookId)
    ?? discs.find((book) => currentBookTitle && normalize(book.title) === normalize(currentBookTitle))
    ?? discs[0];
  const tracks = disc ? discTracks(disc) : [];
  const position = Math.max(0, tracks.findIndex((track) => selection?.bookId === disc?.id && track.index === selection?.chapterIndex));
  const track = tracks[position];
  const autoPlay = selection?.bookId === disc?.id && selection?.autoPlay === true;

  const load = (bookId: string, chapterIndex: number | undefined, play: boolean) => setSelection({ bookId, chapterIndex, autoPlay: play });
  const step = (offset: number) => (wasPlaying: boolean) => {
    const target = tracks[position + offset];
    if (disc && target) load(disc.id, target.index, wasPlaying);
  };

  return (
    <section aria-labelledby="lecteur-title" className="flex h-full min-w-0 flex-col gap-5 overflow-y-auto p-6">
      <h2 id="lecteur-title" className="flex items-center gap-2 font-cinzel text-sm text-[#d4af37]"><Disc3 size={16} /> Le Lecteur</h2>
      {error && <p role="alert" className="text-xs text-[#d28b75]">{error}</p>}
      {!config && !error && <p className="font-serif text-sm text-[#a99a83]">Ouverture de la discothèque…</p>}
      {config && !disc && (
        <div className="flex flex-col items-start gap-3 font-serif text-sm text-[#a99a83]">
          <p>Aucun disque gravé dans l’atelier.</p>
          <p>Générez les pistes d’un livre depuis le Studio Audio : chaque livre gravé devient un disque.</p>
          {onOpenStudio && <button type="button" onClick={onOpenStudio} className="flex items-center gap-1.5 rounded-sm border border-[#6b5327] px-3 py-1.5 font-cinzel text-xs tracking-wider text-[#d4af37] uppercase hover:border-[#d4af37]"><AudioLines size={14} /> Ouvrir le Studio Audio</button>}
        </div>
      )}
      {disc && track && (
        <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          <section aria-labelledby="discotheque-title" className="flex min-w-0 flex-col gap-3">
            <h3 id="discotheque-title" className={stageTitle}>La Discothèque d’Atelier</h3>
            <div className="flex flex-wrap gap-2">
              {discs.map((candidate) => <Disc key={candidate.id} book={candidate} active={candidate.id === disc.id} onSelect={() => load(candidate.id, undefined, false)} />)}
            </div>
            <p className="font-serif text-sm text-[#f3f0ea]">{label(disc)}</p>
            <ol aria-label="Pistes gravées" className="flex flex-col gap-1">
              {tracks.map((entry) => {
                const details = burnDetails(entry);
                const current = entry.index === track.index;
                return (
                  <li key={entry.index}>
                    <button type="button" aria-current={current ? "true" : undefined} onClick={() => load(disc.id, entry.index, false)} className={`flex w-full min-w-0 flex-col rounded-sm border px-3 py-2 text-left font-serif transition-colors ${current ? "border-[#d4af37] bg-[#211c15]" : "border-[#2e261c] hover:border-[#6b5327]"}`}>
                      <span className="text-sm text-[#f3f0ea]">{entry.index}. {entry.title}</span>
                      {details && <span className="text-xs text-[#8c8275]">{details}</span>}
                    </button>
                  </li>
                );
              })}
            </ol>
          </section>
          <section aria-labelledby="bande-title" className="flex min-w-0 flex-col gap-3">
            <h3 id="bande-title" className={stageTitle}>Le Lecteur de Bande</h3>
            <TapeDeck
              key={track.path}
              src={libraryCoverUrl(track.path)}
              title={track.title}
              autoPlay={autoPlay}
              onPrevious={position > 0 ? step(-1) : undefined}
              onNext={position < tracks.length - 1 ? step(1) : undefined}
            />
          </section>
        </div>
      )}
    </section>
  );
};
