import { useState } from "react";
import { AudioLines, Disc3 } from "lucide-react";
import type { AudioChapter, Book, DeckSelection } from "../../types";
import { albumCasting, albumDuration, formatClock, mixBadge } from "./burnDetails";
import { bookLabel, discTracks, pickDisc, useDiscs } from "./discs";
import { frenchCount } from "./frenchCount";

interface DiscothequeViewProps {
  currentBookTitle?: string;
  deck: DeckSelection | null;
  onPlay: (selection: DeckSelection) => void;
  onOpenStudio?: () => void;
}

const stageTitle = "font-cinzel text-xs tracking-wider text-[#d4af37] uppercase";
const badgeClass = "rounded-sm border border-[#6b5327] px-2 py-0.5 font-cinzel text-[10px] tracking-wider whitespace-nowrap text-[#d4af37] uppercase";

const Album = ({ book, active, onSelect }: { book: Book; active: boolean; onSelect: () => void }) => {
  const tracks = discTracks(book);
  const duration = albumDuration(tracks);
  const casting = albumCasting(tracks);
  return (
    <button type="button" aria-pressed={active} aria-label={`Disque ${bookLabel(book)}`} onClick={onSelect} className={`flex min-w-0 flex-col items-center gap-3 rounded-sm border-b-4 p-4 text-center transition-colors ${active ? "border-[#d4af37] bg-[#211c15]" : "border-[#3a2f1d] hover:bg-[#1a1612]"}`}>
      <span
        aria-hidden="true"
        className={`flex h-48 w-48 items-center justify-center rounded-full border-2 ${active ? "border-[#d4af37] shadow-[0_0_22px_rgb(212_175_55/30%)]" : "border-[#3a2f1d]"}`}
        style={{ background: "repeating-radial-gradient(circle, #0b0a09 0 2px, #1a1714 2px 4px)" }}
      >
        <span className="flex h-28 w-28 flex-col items-center justify-center gap-0.5 rounded-full bg-[#d4af37] px-4 text-center text-[#13110f]">
          <span className="line-clamp-3 font-cinzel text-xs leading-tight font-semibold break-words uppercase">{book.title}</span>
          {book.tome ? <span className="font-cinzel text-[10px] tracking-wider uppercase">Tome {book.tome}</span> : null}
        </span>
      </span>
      <span className="font-serif text-sm text-[#f3f0ea]">{bookLabel(book)}</span>
      <span className="font-serif text-xs text-[#c9bea9]">{[frenchCount(tracks.length, "piste gravée", "pistes gravées"), duration].filter(Boolean).join(" · ")}</span>
      {casting && <span className={badgeClass}>{casting}</span>}
    </button>
  );
};

const TrackCard = ({ entry, current, onSelect }: { entry: AudioChapter; current: boolean; onSelect: () => void }) => {
  const badge = mixBadge(entry);
  const burn = entry.burn;
  const polyphony = burn?.mode === "polyphonic" ? burn.roles.map((role) => `${role.role} ×${role.lines}`).join(", ") : null;
  return (
    <button type="button" aria-label={`${entry.index}. ${entry.title}`} aria-current={current ? "true" : undefined} onClick={onSelect} className={`flex w-full min-w-0 items-center gap-4 rounded-sm border border-l-4 px-4 py-3 text-left transition-colors ${current ? "border-[#3a2f1d] border-l-[#d4af37] bg-[#2a2216] shadow-[inset_0_0_14px_rgb(212_175_55/10%)]" : "border-[#2e261c] border-l-[#3a2f1d] hover:border-l-[#6b5327] hover:bg-[#1a1612]"}`}>
      <span aria-hidden="true" className={`w-9 shrink-0 text-center font-cinzel text-2xl ${current ? "text-[#d4af37]" : "text-[#6b5327]"}`}>{String(entry.index).padStart(2, "0")}</span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="font-serif text-sm text-[#f3f0ea]">{entry.title}</span>
        {burn && <span className="text-xs text-[#a99a83]">{new Date(burn.burnedAt).toLocaleDateString("fr-FR")}{burn.durationSeconds !== undefined ? ` · ${formatClock(burn.durationSeconds)}` : ""}</span>}
        {polyphony && <span className="text-xs text-[#8c8275]">{polyphony}</span>}
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1.5">
        {badge && <span className={badgeClass}>{badge}</span>}
        {current && <span className="font-cinzel text-[9px] tracking-widest text-[#e6c85a] uppercase">Sur la platine</span>}
      </span>
    </button>
  );
};

/** La Discothèque d'Atelier : un album par livre gravé, avec son livret de session. */
export const DiscothequeView = ({ currentBookTitle, deck, onPlay, onOpenStudio }: DiscothequeViewProps) => {
  const { discs, ready, error } = useDiscs();
  const [bookId, setBookId] = useState(deck?.bookId);
  const disc = pickDisc(discs, bookId, currentBookTitle);
  const tracks = disc ? discTracks(disc) : [];
  const onDeck = disc !== undefined && deck?.bookId === disc.id ? deck : null;
  const deckIndex = onDeck ? (tracks.find((track) => track.index === onDeck.chapterIndex) ?? tracks[0])?.index : undefined;
  const casting = albumCasting(tracks);
  const play = (chapterIndex: number | undefined) => disc && onPlay({ bookId: disc.id, chapterIndex, autoPlay: false });

  return (
    <section aria-labelledby="discotheque-title" className="flex h-full min-w-0 flex-col gap-6 overflow-y-auto p-6">
      <h2 id="discotheque-title" className="flex items-center gap-2 font-cinzel text-sm text-[#d4af37]"><Disc3 size={16} /> La Discothèque d’Atelier</h2>
      {error && <p role="alert" className="text-xs text-[#d28b75]">{error}</p>}
      {!ready && !error && <p className="font-serif text-sm text-[#a99a83]">Ouverture de la discothèque…</p>}
      {ready && !disc && (
        <div className="flex flex-col items-start gap-3 font-serif text-sm text-[#a99a83]">
          <p>Aucun disque gravé dans l’atelier.</p>
          <p>Générez les pistes d’un livre depuis le Studio Audio : chaque livre gravé devient un album sur les rayons.</p>
          {onOpenStudio && <button type="button" onClick={onOpenStudio} className="flex items-center gap-1.5 rounded-sm border border-[#6b5327] px-3 py-1.5 font-cinzel text-xs tracking-wider text-[#d4af37] uppercase hover:border-[#d4af37]"><AudioLines size={14} /> Ouvrir le Studio Audio</button>}
        </div>
      )}
      {disc && (
        <div className="mx-auto grid min-h-0 w-full max-w-6xl flex-1 gap-6 lg:grid-cols-[minmax(0,11fr)_minmax(0,9fr)] lg:grid-rows-[minmax(0,1fr)]">
          <section aria-labelledby="rayonnage-title" className="flex min-h-0 min-w-0 flex-col gap-4 rounded-sm border border-[#2e261c] bg-[#110f0d] p-5">
            <h3 id="rayonnage-title" className={stageTitle}>Le Rayonnage</h3>
            <div className="grid min-h-0 flex-1 content-start justify-center gap-4 overflow-y-auto [grid-template-columns:repeat(auto-fill,minmax(15rem,17rem))]">
              {discs.map((candidate) => <Album key={candidate.id} book={candidate} active={candidate.id === disc.id} onSelect={() => setBookId(candidate.id)} />)}
            </div>
          </section>
          <section aria-labelledby="livret-title" className="flex min-h-0 min-w-0 flex-col gap-4 rounded-sm border border-[#3a2f1d] bg-[#151518] p-5 shadow-[inset_0_1px_0_rgb(212_175_55/8%)]">
            <header className="flex flex-col gap-2 border-b border-[#2e261c] pb-4">
              <h3 id="livret-title" className={stageTitle}>Feuille de session</h3>
              <p className="font-serif text-xl text-[#f3f0ea]">{bookLabel(disc)}</p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <p className="text-xs text-[#a99a83]">{[frenchCount(tracks.length, "piste gravée", "pistes gravées"), albumDuration(tracks)].filter(Boolean).join(" · ")}</p>
                {casting && <span className={badgeClass}>{casting}</span>}
              </div>
            </header>
            <button type="button" onClick={() => play(deckIndex)} className="flex items-center justify-center gap-2 self-start rounded-sm border border-[#d4af37] bg-[#13110f] px-5 py-2 font-cinzel text-xs tracking-wider text-[#d4af37] uppercase transition-all hover:bg-[#211c15] hover:text-[#e6c85a] hover:shadow-[0_0_14px_rgb(212_175_55/30%)]"><Disc3 size={14} /> Poser sur la platine</button>
            <ol aria-label="Pistes gravées" className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto pr-1">
              {tracks.map((entry) => (
                <li key={entry.index}><TrackCard entry={entry} current={entry.index === deckIndex} onSelect={() => play(entry.index)} /></li>
              ))}
            </ol>
          </section>
        </div>
      )}
    </section>
  );
};
