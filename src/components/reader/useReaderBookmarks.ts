import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReaderBookmark } from "../../types";
import { loadReaderBookmarks, saveReaderBookmarks } from "../../utils/readerApi";
import type { ReaderLocation } from "./readerTypes";

const messageOf = (reason: unknown, fallback: string): string => (reason instanceof Error ? reason.message : fallback);

export const useReaderBookmarks = (bookId: string, format: ReaderBookmark["format"]) => {
  const [bookmarks, setBookmarks] = useState<ReaderBookmark[]>([]);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef<ReaderBookmark[]>([]);

  useEffect(() => {
    let active = true;
    loadReaderBookmarks(bookId).then((stored) => {
      if (!active) return;
      latest.current = stored;
      setBookmarks(stored);
    }).catch((reason: unknown) => {
      if (active) setError(messageOf(reason, "Signets indisponibles."));
    });
    return () => { active = false; };
  }, [bookId]);

  const persist = useCallback(async (next: ReaderBookmark[]) => {
    const previous = latest.current;
    latest.current = next;
    setBookmarks(next);
    try {
      await saveReaderBookmarks(bookId, next);
      setError(null);
    } catch (reason) {
      latest.current = previous;
      setBookmarks(previous);
      setError(messageOf(reason, "Enregistrement du signet impossible."));
    }
  }, [bookId]);

  const add = useCallback((location: ReaderLocation) => persist([...latest.current, {
    id: crypto.randomUUID(),
    bookId,
    format,
    chapter: location.chapter,
    chapterTitle: location.chapterTitle,
    position: location.position,
    excerpt: location.excerpt,
    createdAt: Math.floor(Date.now() / 1000),
  }]), [bookId, format, persist]);

  const remove = useCallback((id: string) => persist(latest.current.filter((bookmark) => bookmark.id !== id)), [persist]);

  const visible = useMemo(() => bookmarks.filter((bookmark) => bookmark.format === format), [bookmarks, format]);

  return { bookmarks: visible, error, add, remove };
};
