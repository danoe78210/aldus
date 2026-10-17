import React from "react";
import { Trash2 } from "lucide-react";
import type { Book, Shelf, ShelfId } from "../types";
import { BookSpine } from "./BookSpine";

interface BookshelfProps {
  shelf: Shelf;
  books: Book[];
  shelves: Shelf[];
  onRename: (shelf: Shelf, label: string) => void;
  onDelete: (shelf: Shelf) => void;
  disabled?: boolean;
  onInspect: (bookId: string) => void;
  onMoveBook: (bookId: string, shelfId: ShelfId) => void;
}

export const Bookshelf: React.FC<BookshelfProps> = ({
  shelf,
  books,
  shelves,
  onRename,
  onDelete,
  disabled = false,
  onInspect,
  onMoveBook,
}) => (
  <section aria-label={shelf.label} className="min-w-0">
    <header className="mb-2 flex items-center gap-2">
      {shelf.isCustom ? (
        <input
          aria-label="Nom de l’étagère personnalisée"
          key={`${shelf.id}-${shelf.label}`}
          defaultValue={shelf.label}
          disabled={disabled}
          onBlur={(event) => {
            const label = event.target.value.trim();
            if (label && label !== shelf.label) onRename(shelf, label);
            event.target.value = shelf.label;
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
          }}
          className="w-56 max-w-[70%] border-b border-[#4a3b2c] bg-transparent font-cinzel text-xs uppercase tracking-wider text-[#d4af37] focus:border-[#d4af37] focus:outline-hidden"
        />
      ) : (
        <h2 id={`shelf-title-${shelf.id}`} className="font-cinzel text-xs uppercase tracking-wider text-[#d4af37]">
          {shelf.label}
        </h2>
      )}
      <span className="text-[10px] text-[#8f8373]">{books.length}</span>
      {shelf.isCustom && (
        <button
          type="button"
          onClick={() => onDelete(shelf)}
          disabled={disabled}
          title="Supprimer le rayon et replacer ses livres dans En cours"
          aria-label={`Supprimer ${shelf.label}`}
          className="ml-auto rounded-sm p-1 text-[#a99a83] hover:text-[#d4af37]"
        >
          <Trash2 size={14} />
        </button>
      )}
    </header>
    <div className="relative flex min-h-[388px] items-end gap-3 overflow-x-auto rounded-t-md border-t border-[#d4af37]/40 border-b-[7px] border-b-[#332719] bg-[radial-gradient(ellipse_at_50%_0%,rgba(212,175,55,0.13)_0%,rgba(184,147,85,0.045)_28%,transparent_55%),linear-gradient(to_bottom,#241e17,#161310)] p-4 pt-10 shadow-[0_14px_0_rgba(0,0,0,0.48),0_16px_30px_rgba(0,0,0,0.24),inset_0_1px_0_rgba(212,175,55,0.18)] sm:gap-4 sm:p-6 sm:pt-10">
      {books.map((book, index) => (
        <BookSpine key={book.id} book={book} shelves={shelves} index={index} disabled={disabled} onMove={onMoveBook} onInspect={onInspect} />
      ))}
      {books.length === 0 && (
        <p className="mb-2 self-end font-serif text-xs italic text-[#786c59]">Étagère vide</p>
      )}
    </div>
  </section>
);