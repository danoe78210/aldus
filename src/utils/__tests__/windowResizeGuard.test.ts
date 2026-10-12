import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  RESIZING_CLASS,
  RESIZE_SETTLE_DELAY_MS,
  installWindowResizeGuard,
} from "../windowResizeGuard";

const isResizing = () => document.body.classList.contains(RESIZING_CLASS);

describe("installWindowResizeGuard", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.className = "";
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.className = "";
  });

  it("gèle les transitions au resize puis les libère après le délai de stabilisation", () => {
    const dispose = installWindowResizeGuard();

    window.dispatchEvent(new Event("resize"));
    expect(isResizing()).toBe(true);

    vi.advanceTimersByTime(RESIZE_SETTLE_DELAY_MS - 1);
    expect(isResizing()).toBe(true);

    vi.advanceTimersByTime(2);
    expect(isResizing()).toBe(false);

    dispose();
  });

  it("prolonge le gel tant que les événements s'enchaînent (debounce)", () => {
    const dispose = installWindowResizeGuard();

    window.dispatchEvent(new Event("resize"));
    vi.advanceTimersByTime(RESIZE_SETTLE_DELAY_MS - 40);
    // Nouvel événement : le compteur repart de zéro.
    window.dispatchEvent(new Event("resize"));
    vi.advanceTimersByTime(RESIZE_SETTLE_DELAY_MS - 40);
    expect(isResizing()).toBe(true);

    vi.advanceTimersByTime(45);
    expect(isResizing()).toBe(false);

    dispose();
  });

  it("est idempotent : deux installations ne doublent pas l'écouteur", () => {
    const disposeFirst = installWindowResizeGuard();
    const disposeSecond = installWindowResizeGuard(); // ignorée

    disposeFirst();
    window.dispatchEvent(new Event("resize"));
    expect(isResizing()).toBe(false);

    disposeSecond();
  });

  it("libère immédiatement le gel lors de la désinstallation", () => {
    const dispose = installWindowResizeGuard();

    window.dispatchEvent(new Event("resize"));
    expect(isResizing()).toBe(true);

    dispose();
    expect(isResizing()).toBe(false);

    // Plus aucun effet après désinstallation.
    vi.advanceTimersByTime(RESIZE_SETTLE_DELAY_MS);
    expect(isResizing()).toBe(false);
  });

});
