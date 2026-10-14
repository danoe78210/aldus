import { invokeCommand } from "./tauri";

/**
 * Lit le **texte brut** d'un chapitre du projet (`read_chapter_file`).
 *
 * Le fichier est résolu côté Rust dans le dossier « Mes sources » du projet
 * persistant ; nom seul ou sous-dossier relatif accepté.
 */
export const readChapterFile = (filename: string): Promise<string> =>
  invokeCommand<string>("read_chapter_file", { filename });

/**
 * Sauvegarde le **texte brut** d'un chapitre (`write_chapter_file`).
 *
 * Écriture **atomique** côté Rust (`.tmp` + `rename`) : le fichier source n'est
 * jamais corrompu si l'application est fermée pendant la sauvegarde.
 */
export const saveChapterFile = (filename: string, content: string): Promise<void> =>
  invokeCommand<void>("save_chapter_file", { filename, content });

/** Alias conservé pour les modules historiques. */
export const writeChapterFile = saveChapterFile;

/** Liste les fichiers Markdown du dossier source configuré côté projet. */
export const listSourceFiles = (): Promise<string[]> =>
  invokeCommand<string[]>("list_source_files");

/** Alias conservé pour les modules historiques. */
export const listChapterFiles = listSourceFiles;

/** Crée un nouveau fichier Markdown sans écraser un fichier existant. */
export const createChapterFile = (filename: string): Promise<string> =>
  invokeCommand<string>("create_chapter_file", { filename });
