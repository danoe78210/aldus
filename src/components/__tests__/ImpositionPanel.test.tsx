import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ImpositionPanel } from "../ImpositionPanel";
import type { PaginationResult } from "../../types";
import { coverMetrics } from "../../data/coverMetrics";

const state = vi.hoisted(() => ({
  structure: [],
  cover: { pageCount: 120, paperType: "white" as const },
  bookPagination: { pageCount: 184, isMeasured: true } as PaginationResult | null,
  paginationError: null,
}));
vi.mock("../StudioContext", () => ({ useStudio: () => state }));
afterEach(cleanup);

it("uses the measured count instead of the declared cover count for the spine", () => {
  state.bookPagination = { pageCount: 184, isMeasured: true };
  render(<ImpositionPanel />);
  expect(screen.getByText("184 pages (mesurées)")).toBeTruthy();
  expect(screen.getByText("10.52 mm")).toBeTruthy();
  const metrics = coverMetrics(152.4, 228.6, 183, "white");
  expect(metrics.pagesUsed).toBe(184);
  expect(metrics.spineWidthMm).toBeCloseTo(10.5248, 4);
});

it("distinguishes a word estimate and explicitly adds parity for odd measured pages", () => {
  state.bookPagination = { pageCount: 190, isMeasured: false };
  const view = render(<ImpositionPanel />);
  expect(screen.getByText("~190 pages (estimées)")).toBeTruthy();
  expect(screen.getByText("10.87 mm")).toBeTruthy();
  view.unmount();
  state.bookPagination = { pageCount: 183, isMeasured: true };
  render(<ImpositionPanel />);
  expect(screen.getByText("183 pages (mesurées)")).toBeTruthy();
  expect(screen.getByText("Bloc relié (page blanche de parité)")).toBeTruthy();
  expect(screen.getByText("10.52 mm")).toBeTruthy();
});

it("does not show a stale declared spine while pagination is unavailable", () => {
  state.bookPagination = null;
  render(<ImpositionPanel />);
  expect(screen.getByText("Pagination en attente du calcul natif du manuscrit.")).toBeTruthy();
  expect(screen.queryByText("Épaisseur de dos")).toBeNull();
});
