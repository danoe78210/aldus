import type { Ref } from "react";
import type { ReaderBookmark } from "../../types";
import type { ReaderSettings } from "./readerSettings";

export interface ReaderLocation {
  chapter: number;
  chapterTitle: string;
  position: number;
  excerpt: string;
}

/** État de la vue courante remonté par un lecteur (texte ou PDF) vers la coque. */
export interface ReaderView {
  chapter: number;
  label: string;
  markedId: string | null;
}

export interface ReaderHandle {
  next: () => void;
  prev: () => void;
  goTo: (chapter: number, position: number) => void;
  locate: () => ReaderLocation | null;
}

export interface ReaderProps {
  settings: ReaderSettings;
  bookmarks: ReaderBookmark[];
  onView: (view: ReaderView) => void;
  ref?: Ref<ReaderHandle>;
}
