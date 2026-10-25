import { ArrowLeft, AudioLines, Disc3 } from "lucide-react";
import type { DeckSelection } from "../../types";
import { libraryCoverUrl } from "../../utils/libraryApi";
import { bookLabel, discTracks, pickDisc, useDiscs } from "./discs";
import { TapeDeck } from "./TapeDeck";

interface AudioReaderViewProps {
  currentBookTitle?: string;
  deck: DeckSelection | null;
  onDeckChange: (selection: DeckSelection) => void;
  onOpenStudio?: () => void;
  onOpenDiscotheque?: () => void;
}

const linkClass = "flex items-center gap-1.5 rounded-sm border border-[#6b5327] px-3 py-1.5 font-cinzel text-xs tracking-wider text-[#d4af37] uppercase hover:border-[#d4af37]";

/** Le Lecteur : la platine à bande, centrée, sur laquelle tourne le disque posé depuis la Discothèque. */
export const AudioReaderView = ({ currentBookTitle, deck, onDeckChange, onOpenStudio, onOpenDiscotheque }: AudioReaderViewProps) => {
  const { discs, ready, error } = useDiscs();
  const disc = pickDisc(discs, deck?.bookId, currentBookTitle);
  const tracks = disc ? discTracks(disc) : [];
  const onDeck = disc !== undefined && deck?.bookId === disc.id ? deck : null;
  const position = Math.max(0, tracks.findIndex((track) => track.index === onDeck?.chapterIndex));
  const track = tracks[position];

  const step = (offset: number) => (wasPlaying: boolean) => {
    const target = tracks[position + offset];
    if (disc && target) onDeckChange({ bookId: disc.id, chapterIndex: target.index, autoPlay: wasPlaying });
  };

  return (
    <section aria-labelledby="lecteur-title" className="flex h-full min-w-0 flex-col items-center gap-5 overflow-y-auto p-6">
      <h2 id="lecteur-title" className="sr-only">Le Lecteur</h2>
      {error && <p role="alert" className="text-xs text-[#d28b75]">{error}</p>}
      {!ready && !error && <p className="font-serif text-sm text-[#a99a83]">Ouverture de la discothèque…</p>}
      {ready && !disc && (
        <div className="flex flex-col items-start gap-3 font-serif text-sm text-[#a99a83]">
          <p>Aucun disque gravé dans l’atelier.</p>
          <p>Générez les pistes d’un livre depuis le Studio Audio : chaque livre gravé devient un disque.</p>
          {onOpenStudio && <button type="button" onClick={onOpenStudio} className={linkClass}><AudioLines size={14} /> Ouvrir le Studio Audio</button>}
        </div>
      )}
      {disc && track && (
        <div className="flex w-full max-w-4xl min-w-0 flex-col gap-4">
          <header className="flex flex-wrap items-center justify-between gap-3 rounded-sm border border-[#3a2f1d] bg-[#15120f] px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <Disc3 size={20} className="shrink-0 text-[#d4af37]" />
              <p className="flex min-w-0 flex-col">
                <span className="truncate font-cinzel text-xs tracking-wider text-[#d4af37] uppercase">{bookLabel(disc)}</span>
                <span className="truncate font-serif text-sm text-[#f3f0ea]">{track.index}. {track.title}</span>
              </p>
            </div>
            {onOpenDiscotheque && <button type="button" onClick={onOpenDiscotheque} className="flex items-center gap-1.5 text-xs text-[#a99a83] underline-offset-4 hover:text-[#d4af37] hover:underline"><ArrowLeft size={14} /> Retourner à la discothèque</button>}
          </header>
          <TapeDeck
            key={track.path}
            src={libraryCoverUrl(track.path)}
            title={track.title}
            autoPlay={onDeck?.autoPlay === true}
            onPrevious={position > 0 ? step(-1) : undefined}
            onNext={position < tracks.length - 1 ? step(1) : undefined}
          />
        </div>
      )}
    </section>
  );
};
