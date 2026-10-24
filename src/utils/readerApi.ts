import type { ReaderBookmark, ReaderContent } from "../types";
import { invokeCommand, isInvokeAvailable } from "./tauri";

const requireDesktop = (): void => {
  if (!isInvokeAvailable()) throw new Error("Le Lecteur d'Atelier nécessite l'application Aldus de bureau.");
};

export const readBookContent = async (bookId: string, resource: string): Promise<ReaderContent> => {
  requireDesktop();
  return invokeCommand<ReaderContent>("read_book_content", { bookId, resource });
};

export const loadReaderBookmarks = async (bookId: string): Promise<ReaderBookmark[]> => {
  requireDesktop();
  return invokeCommand<ReaderBookmark[]>("load_reader_bookmarks", { bookId });
};

export const saveReaderBookmarks = async (bookId: string, bookmarks: ReaderBookmark[]): Promise<void> => {
  requireDesktop();
  return invokeCommand<void>("save_reader_bookmarks", { bookId, bookmarks });
};
