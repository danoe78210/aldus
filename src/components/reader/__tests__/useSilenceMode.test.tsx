import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { chromeClass, SILENCE_DELAY_MS, useSilenceMode } from "../useSilenceMode";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("useSilenceMode", () => {
  it("turns idle after 3 s without movement and wakes instantly on mouse move", () => {
    const { result } = renderHook(() => useSilenceMode());
    expect(result.current).toBe(false);
    act(() => { vi.advanceTimersByTime(SILENCE_DELAY_MS - 1); });
    expect(result.current).toBe(false);
    act(() => { vi.advanceTimersByTime(1); });
    expect(result.current).toBe(true);
    act(() => { window.dispatchEvent(new Event("mousemove")); });
    expect(result.current).toBe(false);
    act(() => { vi.advanceTimersByTime(SILENCE_DELAY_MS); });
    expect(result.current).toBe(true);
  });

  it("restarts the countdown on each movement", () => {
    const { result } = renderHook(() => useSilenceMode());
    act(() => { vi.advanceTimersByTime(2500); window.dispatchEvent(new Event("mousemove")); vi.advanceTimersByTime(2500); });
    expect(result.current).toBe(false);
  });

  it("fades the chrome with the 700 ms transition once idle", () => {
    expect(chromeClass(true)).toContain("opacity-0 transition-opacity duration-700");
    expect(chromeClass(false)).toContain("opacity-100");
  });
});
