import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  setFullscreen: vi.fn<(value: boolean) => Promise<void>>(),
  isFullscreen: vi.fn<() => Promise<boolean>>(),
}));

// L'API Tauri n'existe pas hors application empaquetée : on la simule ici pour
// vérifier que le module délègue bien à `getCurrentWindow()`.
vi.mock("@tauri-apps/api/window", () => ({
  getCurrentWindow: () => ({
    setFullscreen: mocks.setFullscreen,
    isFullscreen: mocks.isFullscreen,
  }),
}));

import {
  isFullscreen,
  isFullscreenSupported,
  isTauriRuntime,
  setFullscreen,
  toggleFullscreen,
} from "../fullscreen";

const requestFullscreen = vi.fn<() => Promise<void>>();
const exitFullscreen = vi.fn<() => Promise<void>>();

const asGlobal = (): Record<string, unknown> => window as unknown as Record<string, unknown>;

const stubDomFullscreenApi = (): void => {
  Object.defineProperty(document.documentElement, "requestFullscreen", {
    value: requestFullscreen,
    configurable: true,
    writable: true,
  });
  Object.defineProperty(document, "exitFullscreen", {
    value: exitFullscreen,
    configurable: true,
    writable: true,
  });
};

const setDomFullscreenElement = (value: Element | null): void => {
  Object.defineProperty(document, "fullscreenElement", {
    value,
    configurable: true,
    writable: true,
  });
};

describe("fullscreen — repli navigateur (hors Tauri)", () => {
  beforeEach(() => {
    delete asGlobal().__TAURI_INTERNALS__;
    vi.clearAllMocks();
    stubDomFullscreenApi();
    setDomFullscreenElement(null);
  });

  afterEach(() => {
    delete asGlobal().__TAURI_INTERNALS__;
    vi.restoreAllMocks();
  });

  it("ne détecte pas le runtime Tauri et expose le support via l'API DOM", () => {
    expect(isTauriRuntime()).toBe(false);
    expect(isFullscreenSupported()).toBe(true);
  });

  it("signale l'absence de support quand l'API DOM est indisponible", () => {
    Object.defineProperty(document.documentElement, "requestFullscreen", {
      value: undefined,
      configurable: true,
      writable: true,
    });
    expect(isFullscreenSupported()).toBe(false);
  });

  it("toggleFullscreen passe en plein écran puis revient en mode fenêtré", async () => {
    requestFullscreen.mockResolvedValue();
    exitFullscreen.mockResolvedValue();

    expect(await isFullscreen()).toBe(false);

    await toggleFullscreen();
    expect(requestFullscreen).toHaveBeenCalledTimes(1);

    // Le navigateur signale alors l'élément en plein écran.
    setDomFullscreenElement(document.documentElement);
    expect(await isFullscreen()).toBe(true);

    await toggleFullscreen();
    expect(exitFullscreen).toHaveBeenCalledTimes(1);
  });

  it("n'appelle exitFullscreen que lorsque l'on est réellement en plein écran", async () => {
    exitFullscreen.mockResolvedValue();
    await setFullscreen(false);
    expect(exitFullscreen).not.toHaveBeenCalled();
  });

  it("journalise un échec sans propager d'exception", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    requestFullscreen.mockRejectedValue(new Error("refusé"));

    await expect(setFullscreen(true)).resolves.toBe(false);
    expect(errorSpy).toHaveBeenCalled();
  });
});

describe("fullscreen — application empaquetée (Tauri)", () => {
  beforeEach(() => {
    asGlobal().__TAURI_INTERNALS__ = {};
    vi.clearAllMocks();
  });

  afterEach(() => {
    delete asGlobal().__TAURI_INTERNALS__;
    vi.restoreAllMocks();
  });

  it("détecte le runtime Tauri : le support est toujours annoncé", () => {
    expect(isTauriRuntime()).toBe(true);
    expect(isFullscreenSupported()).toBe(true);
  });

  it("délègue la bascule à l'API fenêtre de Tauri", async () => {
    mocks.isFullscreen.mockResolvedValue(false);
    mocks.setFullscreen.mockResolvedValue();

    await toggleFullscreen();
    expect(mocks.setFullscreen).toHaveBeenCalledWith(true);

    mocks.isFullscreen.mockResolvedValue(true);
    await toggleFullscreen();
    expect(mocks.setFullscreen).toHaveBeenCalledWith(false);
  });

  it("renvoie false si l'API Tauri échoue, sans masquer l'erreur", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.setFullscreen.mockRejectedValue(new Error("permission refusée"));

    await expect(setFullscreen(true)).resolves.toBe(false);
    expect(errorSpy).toHaveBeenCalled();
  });
});
