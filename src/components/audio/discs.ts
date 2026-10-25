import { useEffect, useState } from "react";
import type { AudioChapter, Book } from "../../types";
import { getLibraryConfig } from "../../utils/libraryApi";

const normalize = (value: string): string => value.trim().toLocaleLowerCase("fr");

export const discTracks = (book: Book): AudioChapter[] => [...(book.audio?.chapters ?? [])].sort((a, b) => a.index - b.index);

export const bookLabel = (book: Book): string => `${book.title}${book.tome ? ` · Tome ${book.tome}` : ""}`;

/** Disque demandé, à défaut celui du livre en cours d'atelier, à défaut le premier. */
export const pickDisc = (discs: Book[], bookId: string | undefined, currentBookTitle: string | undefined): Book | undefined =>
  discs.find((book) => book.id === bookId)
  ?? discs.find((book) => currentBookTitle && normalize(book.title) === normalize(currentBookTitle))
  ?? discs[0];

/** Livres possédant au moins une piste gravée ; `ready` dès que le registre est lu. */
export const useDiscs = () => {
  const [discs, setDiscs] = useState<Book[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getLibraryConfig()
      .then((loaded) => { if (active) setDiscs(loaded.books.filter((book) => discTracks(book).length > 0)); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : typeof reason === "string" ? reason : "Registre du livre indisponible."); });
    return () => { active = false; };
  }, []);

  return { discs: discs ?? [], ready: discs !== null, error };
};
