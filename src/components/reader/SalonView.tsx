import { useEffect, useState } from "react";
import { BookOpen } from "lucide-react";
import type { Book, SalonTarget } from "../../types";
import { getLibraryConfig } from "../../utils/libraryApi";
import { PendingView } from "../navigation/PendingView";
import { WorkshopReaderView } from "./WorkshopReaderView";

interface SalonViewProps {
  target: SalonTarget | null;
}

export const SalonView = ({ target }: SalonViewProps) => {
  const [book, setBook] = useState<Book | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const bookId = target?.bookId;

  useEffect(() => {
    if (!bookId) return;
    let active = true;
    getLibraryConfig().then((config) => {
      if (!active) return;
      const found = config.books.find((candidate) => candidate.id === bookId) ?? null;
      setBook(found);
      setError(found ? null : "Ce livre n'est plus dans la Bibliothèque.");
    }).catch((reason: unknown) => {
      if (active) setError(reason instanceof Error ? reason.message : "Bibliothèque indisponible.");
    });
    return () => { active = false; };
  }, [bookId]);

  if (!target) {
    return <PendingView title="Salon de lecture" hint="Choisissez d'abord un livre dans la Bibliothèque, puis ouvrez-le : il sera lu ici." />;
  }

  return (
    <section aria-label="Salon de lecture" className="flex h-full w-full flex-col items-center justify-center gap-5 px-10 text-center">
      <h2 className="font-serif text-lg tracking-[0.25em] text-[#d4af37] uppercase">Salon de lecture</h2>
      {error ? (
        <p role="alert" className="font-serif text-sm text-[#d28b75]">{error}</p>
      ) : book ? (
        <>
          <p className="font-cinzel text-base text-[#f3f0ea]">{book.title}{book.tome ? ` · Tome ${book.tome}` : ""}</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button type="button" onClick={() => setReading(true)} className="flex items-center gap-2 rounded-sm border border-[#8f6e2b] bg-[#211c15] px-4 py-2 font-cinzel text-sm text-[#d4af37] hover:bg-[#302619]"><BookOpen size={16} /> Lire en pleine page</button>
            <button type="button" disabled title="En cours de composition" className="rounded-sm border border-[#3a3022] px-4 py-2 font-cinzel text-sm text-[#8c8275] opacity-60">Volume relié — en cours de composition</button>
          </div>
        </>
      ) : (
        <p role="status" className="font-serif text-sm text-[#a99a83]">Ouverture du livre…</p>
      )}
      {reading && book && <WorkshopReaderView book={book} file={target.file} onClose={() => setReading(false)} />}
    </section>
  );
};
