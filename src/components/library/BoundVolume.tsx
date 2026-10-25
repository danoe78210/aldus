import { useEffect, useState } from "react";
import { X } from "lucide-react";
import type { Book, SalonTarget } from "../../types";
import { libraryCoverUrl } from "../../utils/libraryApi";
import { readBookContent } from "../../utils/readerApi";
import { loadPdfChapters } from "./pdfChapters";
import { ReadingSalon } from "./ReadingSalon";
import { contentToSalonChapters } from "./salonMarkdown";
import type { SalonChapter } from "./salonMarkdown";

interface BoundVolumeProps {
  book: Book;
  file: SalonTarget["file"];
  onClose: () => void;
}

/** Le volume relié : charge le livre, le recompose en Markdown et le pose ouvert sur le pupitre. */
export const BoundVolume = ({ book, file, onClose }: BoundVolumeProps) => {
  const [chapters, setChapters] = useState<SalonChapter[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const url = libraryCoverUrl(file.path);
    const loading = file.format === "pdf"
      ? url ? loadPdfChapters(url, book.title) : Promise.reject(new Error("Le Salon de lecture nécessite l'application Aldus de bureau."))
      : readBookContent(book.id, file.path).then(contentToSalonChapters);
    loading
      .then((loaded) => { if (active) setChapters(loaded); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : typeof reason === "string" ? reason : "Lecture du livre impossible."); });
    return () => { active = false; };
  }, [book.id, book.title, file.path, file.format]);

  return (
    <div className="relative h-full w-full">
      {error ? <p role="alert" className="p-10 text-center font-serif text-sm text-[#d28b75]">{error}</p>
        : !chapters ? <p role="status" className="p-10 text-center font-serif text-sm text-[#a99a83]">Ouverture du volume…</p>
        : chapters.length === 0 ? <p role="status" className="p-10 text-center font-serif text-sm text-[#a99a83]">Ce volume ne contient aucun chapitre.</p>
        : <ReadingSalon bookId={book.id} title={book.title} chapters={chapters} />}
      <button type="button" onClick={onClose} className="absolute top-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1.5 rounded-sm border border-[#6b5327] bg-[#13110f]/80 px-2.5 py-1.5 font-cinzel text-[10px] tracking-wider text-[#d4af37] uppercase hover:border-[#d4af37] hover:bg-[#211c15]"><X size={13} /> Refermer le volume</button>
    </div>
  );
};
