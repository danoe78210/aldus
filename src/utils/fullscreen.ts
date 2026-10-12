/**
 * Bascule **plein écran / mode fenêtré** de l'atelier.
 *
 * La fenêtre principale s'ouvre d'emblée en plein écran
 * (`src-tauri/tauri.conf.json` → `app.windows[0].fullscreen: true`, avec
 * `resizable: true` conservé). Ce module fournit la **porte de sortie** :
 * la touche `F11` et le bouton discret de l'en-tête du pupitre
 * (`TopBar.tsx`) s'appuient sur lui pour revenir en mode fenêtré — et
 * inversement.
 *
 * Deux chemins d'exécution :
 *  - **Tauri v2** (`window.__TAURI_INTERNALS__` présent) : API fenêtre de
 *    l'application empaquetée (`getCurrentWindow().setFullscreen()` /
 *    `isFullscreen()`), autorisée par `core:window:allow-set-fullscreen` et
 *    `core:window:allow-is-fullscreen` (`src-tauri/capabilities/default.json`) ;
 *  - **navigateur** (SPA Vite, environnement de test) : repli sur l'API DOM
 *    standard (`requestFullscreen` / `exitFullscreen`).
 */
import { getCurrentWindow } from "@tauri-apps/api/window";

/** Indique si l'application tourne dans le runtime Tauri (et non un navigateur). */
export const isTauriRuntime = (): boolean =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

/** Le plein écran est-il pilotable dans l'environnement courant ? */
export const isFullscreenSupported = (): boolean => {
  if (isTauriRuntime()) {
    return true;
  }
  if (typeof document === "undefined") {
    return false;
  }
  return typeof document.documentElement?.requestFullscreen === "function";
};

/** État courant du plein écran (`false` si indisponible ou en cas d'échec). */
export const isFullscreen = async (): Promise<boolean> => {
  if (isTauriRuntime()) {
    try {
      return await getCurrentWindow().isFullscreen();
    } catch {
      return false;
    }
  }
  return typeof document !== "undefined" && Boolean(document.fullscreenElement);
};

/**
 * Force l'état souhaité — `true` : plein écran, `false` : mode fenêtré.
 * Renvoie l'état effectivement obtenu (l'échec est journalisé, jamais propagé,
 * afin de ne jamais bloquer l'atelier).
 */
export const setFullscreen = async (enabled: boolean): Promise<boolean> => {
  if (isTauriRuntime()) {
    try {
      const appWindow = getCurrentWindow();
      await appWindow.setFullscreen(enabled);
      return await appWindow.isFullscreen();
    } catch (error) {
      console.error("Impossible de basculer en plein écran :", error);
      return false;
    }
  }

  try {
    if (enabled) {
      if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
    } else if (document.fullscreenElement && document.exitFullscreen) {
      await document.exitFullscreen();
    }
  } catch (error) {
    console.error("Impossible de basculer en plein écran :", error);
  }
  return isFullscreen();
};

/** Inverse l'état courant (raccourci `F11` et bouton de l'en-tête). */
export const toggleFullscreen = async (): Promise<boolean> => {
  const current = await isFullscreen();
  return setFullscreen(!current);
};
