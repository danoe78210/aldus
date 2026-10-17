import React from "react";
import type { Book, LibraryFile, Shelf } from "../types";

interface BookSpineProps {
  book: Book;
  shelves: Shelf[];
  index: number;
  disabled?: boolean;
  onInspect: (bookId: string, format?: LibraryFile["format"]) => void;
  onMove: (bookId: string, shelfId: Book["shelfId"]) => void;
}

const spineColors = ["#3d1c1c", "#26352d", "#27313d", "#49351e", "#35283a"];

export const BookSpine: React.FC<BookSpineProps> = ({ book, shelves, index, disabled = false, onMove, onInspect }) => {
  const color = book.colorHex ?? spineColors[index % spineColors.length];
  const height = 256 + (index % 4) * 8;
  const formats: LibraryFile["format"][] = (["epub", "pdf", "docx"] as const).filter((format) => book.files?.some((file) => file.format === format));
  if (book.audio?.chapters.length) formats.push("audio");

  return (
    <div className="flex h-[340px] w-[152px] shrink-0 flex-col items-center justify-end gap-1">
      <button
        type="button"
        onClick={() => onInspect(book.id)}
        aria-label={`Inspecter ${book.title}`}
        title={[book.title, book.tome].filter(Boolean).join(" · ")}
        className="group/spine relative flex w-14 shrink-0 cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-t-sm border-x border-t border-white/20 px-1.5 py-3 text-[#f3f0ea] shadow-[inset_2px_0_3px_rgba(255,255,255,0.08),inset_-3px_0_5px_rgba(0,0,0,0.48),0_8px_16px_rgba(0,0,0,0.48)] transition-all duration-300 hover:-translate-y-3 hover:shadow-[0_15px_30px_rgba(212,175,55,0.15),inset_2px_0_3px_rgba(255,255,255,0.12),inset_-3px_0_5px_rgba(0,0,0,0.42)] focus-visible:outline-2 focus-visible:outline-[#d4af37] sm:w-16"
        style={{
          height,
          backgroundColor: color,
          backgroundImage: "linear-gradient(90deg,rgba(0,0,0,0.38),rgba(255,255,255,0.08) 13%,transparent 23%,transparent 76%,rgba(255,255,255,0.06) 82%,rgba(0,0,0,0.35)),linear-gradient(180deg,rgba(212,175,55,0.09),transparent 18%,transparent 80%,rgba(0,0,0,0.34))",
        }}
      >
        <span aria-hidden="true" className="pointer-events-none absolute inset-y-2 left-2 w-px bg-linear-to-b from-transparent via-[#d4af37]/50 to-transparent" />
        <span aria-hidden="true" className="pointer-events-none absolute inset-y-2 right-2 w-px bg-linear-to-b from-transparent via-[#e0c27a]/35 to-transparent" />
        <span aria-hidden="true" className="pointer-events-none absolute inset-x-2 top-7 h-px bg-linear-to-r from-transparent via-[#d4af37]/65 to-transparent" />
        <span aria-hidden="true" className="pointer-events-none absolute inset-x-2 bottom-8 h-px bg-linear-to-r from-transparent via-[#d4af37]/55 to-transparent" />
        <span aria-hidden="true" className="pointer-events-none absolute inset-x-2 bottom-5 h-px bg-linear-to-r from-transparent via-[#b89355]/35 to-transparent" />
        <span className="relative z-10 min-h-0 flex-1 truncate font-cinzel text-xs tracking-wider text-shadow-sm" style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}>
          {book.title}
        </span>
      </button>
      {formats.length > 0 && <div role="group" aria-label={`Formats : ${formats.map((format) => format.toUpperCase()).join(", ")}`} className="flex min-h-6 w-full shrink-0 flex-wrap items-center justify-center gap-1">
        {formats.map((format) => <button key={format} type="button" title={`Inspecter ${book.title} en ${format.toUpperCase()}`} aria-label={`Inspecter ${book.title} au format ${format.toUpperCase()}`} onClick={() => onInspect(book.id, format)} className="rounded-sm border border-[#d4af37]/50 bg-[#15120f] px-1 py-0.5 font-cinzel text-[10px] leading-3 tracking-wide text-[#f3f0ea] shadow-[inset_0_1px_0_rgba(212,175,55,0.1)] transition-all duration-200 hover:border-[#d4af37] hover:bg-[#302619] hover:text-[#f3d995] hover:shadow-[0_0_10px_rgba(212,175,55,0.2)]">{format.toUpperCase()}</button>)}
      </div>}
      <label className="sr-only" htmlFor={`move-${book.id}`}>Déplacer {book.title}</label>
      <select
        id={`move-${book.id}`}
        aria-label={`Déplacer ${book.title}`}
        value={book.shelfId}
        disabled={disabled}
        onChange={(event) => onMove(book.id, event.target.value as Book["shelfId"])}
        className="w-full rounded-sm border border-[#4a3b2c] bg-[#141210] px-0.5 py-1 text-[9px] text-[#c9bea9] focus:border-[#d4af37] focus:outline-hidden"
      >
        {shelves.map((shelf) => (
          <option key={shelf.id} value={shelf.id}>{shelf.label}</option>
        ))}
      </select>
    </div>
  );
};