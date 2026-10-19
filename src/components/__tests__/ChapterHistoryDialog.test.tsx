import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ChapterHistoryDialog } from "../proof/ChapterHistoryDialog";
import { listChapterHistory } from "../../utils/projectApi";

vi.mock("../../utils/projectApi", () => ({ listChapterHistory: vi.fn() }));
beforeEach(() => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value: function (this: HTMLDialogElement) { this.open = true; } });
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value: function (this: HTMLDialogElement) { this.open = false; } });
  vi.mocked(listChapterHistory).mockResolvedValue([{ filename: "chapter_snapshot.bak.md", createdAt: "2026-10-19T14:32:00Z", sizeBytes: 50 }]);
});
afterEach(cleanup);

it("requires confirmation, restores the selected snapshot and closes after reloading", async () => {
  const onRestore = vi.fn<() => Promise<void>>().mockResolvedValue();
  const onClose = vi.fn();
  render(<ChapterHistoryDialog workspace="C:\\book" chapter="nested/chapter.md" onRestore={onRestore} onClose={onClose} />);
  fireEvent.click(await screen.findByRole("button", { name: /50 octets/ }));
  expect(onRestore).not.toHaveBeenCalled();
  expect(screen.getByText(/remplacera le texte actuel/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Annuler" }));
  expect(onRestore).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: /50 octets/ }));
  fireEvent.click(screen.getByRole("button", { name: "Restaurer cette version" }));
  await waitFor(() => expect(onRestore).toHaveBeenCalledWith("chapter_snapshot.bak.md"));
  expect(onClose).toHaveBeenCalledOnce();
});

it("keeps the dialog open and reports restoration failures", async () => {
  const onClose = vi.fn();
  render(<ChapterHistoryDialog workspace="C:\\book" chapter="chapter.md" onRestore={vi.fn().mockRejectedValue(new Error("Accès refusé"))} onClose={onClose} />);
  fireEvent.click(await screen.findByRole("button", { name: /50 octets/ }));
  fireEvent.click(screen.getByRole("button", { name: "Restaurer cette version" }));
  expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Error: Accès refusé");
  expect(onClose).not.toHaveBeenCalled();
});
