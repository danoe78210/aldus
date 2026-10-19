import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { PaginationResult, ProjectFile } from "../../types";
import { getBookPagination } from "../projectApi";
import { useBookPagination } from "../useBookPagination";

const events = vi.hoisted(() => ({ refresh: () => {} }));
vi.mock("../projectApi", () => ({ getBookPagination: vi.fn() }));
vi.mock("../tauri", () => ({
  isInvokeAvailable: () => true,
  listenEvent: async (_name: string, callback: () => void) => { events.refresh = callback; return () => {}; },
}));

const project: ProjectFile = {
  projectVersion: "1.0",
  metadata: { sagaTitle: "", bookTitle: "Livre", subtitle: "", authorName: "", year: "", isbn: "", publisher: "", copyrightText: "", website: "", otherBooks: "" },
  layoutConfig: { trimSize: "6x9", bodyFont: "Garamond", bodySize: 11, lineSpacing: 1.15, textAlignment: "justify", dropCap: true, chapterTitleFont: "body", chapterTitleSize: 16, subtitleFont: "body", subtitleSize: 14 },
  directories: { sources: "C:\\book", logs: null },
  organization: [],
  options: { imageColorMode: "color", logLevel: "standard" },
};
beforeEach(() => vi.mocked(getBookPagination).mockReset());
afterEach(cleanup);

it("refreshes immediately after a successful PDF compilation notification", async () => {
  vi.mocked(getBookPagination).mockResolvedValue({ pageCount: 190, isMeasured: false });
  const hook = renderHook(() => useBookPagination(project, 0));
  await waitFor(() => expect(hook.result.current.result?.isMeasured).toBe(false));
  vi.mocked(getBookPagination).mockResolvedValue({ pageCount: 184, isMeasured: true });
  act(() => events.refresh());
  await waitFor(() => expect(hook.result.current.result).toEqual({ pageCount: 184, isMeasured: true }));
});

it("discards late results and never reuses an old measurement after source changes", async () => {
  let resolveOld: (result: PaginationResult) => void = () => {};
  vi.mocked(getBookPagination).mockReturnValueOnce(new Promise((resolve) => { resolveOld = resolve; }));
  const hook = renderHook(({ revision }) => useBookPagination(project, revision), { initialProps: { revision: 0 } });
  await waitFor(() => expect(getBookPagination).toHaveBeenCalledOnce());
  vi.mocked(getBookPagination).mockResolvedValue({ pageCount: 200, isMeasured: false });
  hook.rerender({ revision: 1 });
  expect(hook.result.current.result).toBeNull();
  await waitFor(() => expect(hook.result.current.result?.pageCount).toBe(200));
  await act(async () => resolveOld({ pageCount: 184, isMeasured: true }));
  expect(hook.result.current.result).toEqual({ pageCount: 200, isMeasured: false });
});

it("keeps measured pagination stable while editing only the cover or source cache", async () => {
  vi.mocked(getBookPagination).mockResolvedValue({ pageCount: 184, isMeasured: true });
  const hook = renderHook(({ value }) => useBookPagination(value, 0), { initialProps: { value: project } });
  await waitFor(() => expect(hook.result.current.result?.isMeasured).toBe(true));
  hook.rerender({ value: { ...project, fileCache: { chapters: ["new.md"], images: [] }, cover: {
    frontPath: null, backPath: null, pageCount: 120, paperType: "white", spineText: "",
    spineColorFront: null, spineColorBack: null, gradient: false,
    pageCountSnapshot: 120, structureSignature: "", blurb: "Nouveau résumé",
  } } });
  expect(hook.result.current.result).toEqual({ pageCount: 184, isMeasured: true });
  await new Promise((resolve) => setTimeout(resolve, 250));
  expect(getBookPagination).toHaveBeenCalledOnce();
});
