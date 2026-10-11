/**
 * Sélecteurs **natifs** du système, via `@tauri-apps/plugin-dialog` (Tauri v2 —
 * commande IPC `plugin:dialog|open`).
 *
 * Hors application empaquetée (SPA Vite, tests jsdom), l'IPC n'existe pas : les
 * fonctions se rabattent **silencieusement** (`null` / `[]`) sans jamais lever,
 * afin que le rendu navigateur et la suite de tests restent stables.
 */
import { open } from "@tauri-apps/plugin-dialog";
import { isInvokeAvailable } from "./tauri";

/** Indique si le sélecteur natif est utilisable (application empaquetée). */
export const isNativeDialogAvailable = (): boolean => isInvokeAvailable();

/**
 * Ouvre le sélecteur de **dossier** natif (`dialog.open({ directory: true })`).
 * Renvoie le **chemin absolu** choisi, ou `null` (annulation / hors Tauri).
 */
export const openNativeDirectory = async (
  title = "Choisir un dossier",
): Promise<string | null> => {
  if (!isInvokeAvailable()) {
    return null;
  }
  try {
    const picked = await open({ directory: true, multiple: false, title });
    return typeof picked === "string" ? picked : null;
  } catch {
    return null;
  }
};

/**
 * Ouvre le sélecteur de **fichiers** natif en **sélection multiple**, restreint
 * aux extensions fournies (`filters`). Renvoie les chemins absolus choisis
 * (liste vide si annulation ou hors Tauri).
 */
export const openNativeFiles = async (
  extensions: string[],
  title = "Choisir des fichiers",
): Promise<string[]> => {
  if (!isInvokeAvailable()) {
    return [];
  }
  try {
    const picked = await open({
      multiple: true,
      title,
      filters: [{ name: "Fichiers acceptés", extensions }],
    });
    if (!picked) {
      return [];
    }
    return Array.isArray(picked) ? picked : [picked];
  } catch {
    return [];
  }
};

/**
 * Ouvre le sélecteur de **fichier unique** natif (ex. illustration de
 * couverture). Renvoie le chemin absolu, ou `null`.
 */
export const openNativeFile = async (
  extensions: string[],
  title = "Choisir un fichier",
): Promise<string | null> => {
  if (!isInvokeAvailable()) {
    return null;
  }
  try {
    const picked = await open({
      multiple: false,
      title,
      filters: [{ name: "Fichiers acceptés", extensions }],
    });
    return typeof picked === "string" ? picked : null;
  } catch {
    return null;
  }
};