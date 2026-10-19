import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { open } from "@tauri-apps/plugin-dialog";
import { invokeCommand, isInvokeAvailable } from "../../utils/tauri";
import { ErrorLogPage } from "../settings/ErrorLogPage";

vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn() }));
vi.mock("../../utils/tauri", () => ({ isInvokeAvailable: vi.fn(), invokeCommand: vi.fn() }));

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(isInvokeAvailable).mockReturnValue(true);
  vi.mocked(invokeCommand).mockResolvedValue(undefined);
});
afterEach(cleanup);

const show = () => {
  const onDirectoryChange = vi.fn();
  const onOpenLog = vi.fn();
  render(<ErrorLogPage
    config={{ directory: "E:\\Erreurs", level: "standard" }}
    onDirectoryChange={onDirectoryChange}
    onOpenLog={onOpenLog}
    onLevelChange={vi.fn()}
    onBack={vi.fn()}
  />);
  return { onDirectoryChange, onOpenLog };
};

it("uses the native directory picker and routes the journal button", async () => {
  vi.mocked(open).mockResolvedValue("E:\\Nouveau journal");
  const callbacks = show();
  fireEvent.click(screen.getByRole("button", { name: /Parcourir/ }));
  await waitFor(() => expect(callbacks.onDirectoryChange).toHaveBeenCalledWith("E:\\Nouveau journal"));
  expect(open).toHaveBeenCalledWith({
    directory: true, multiple: false, title: "Choisir le dossier du journal",
  });
  fireEvent.click(screen.getByRole("button", { name: /Ouvrir le fichier de bord/ }));
  expect(callbacks.onOpenLog).toHaveBeenCalledOnce();
});

it("keeps preferences unchanged on cancellation and surfaces picker errors", async () => {
  vi.mocked(open).mockResolvedValueOnce(null).mockRejectedValueOnce(new Error("Accès refusé"));
  const callbacks = show();
  fireEvent.click(screen.getByRole("button", { name: /Parcourir/ }));
  await waitFor(() => expect(open).toHaveBeenCalledOnce());
  expect(callbacks.onDirectoryChange).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: /Parcourir/ }));
  expect((await screen.findByRole("alert")).textContent).toContain("Accès refusé");
  expect(invokeCommand).toHaveBeenCalledWith("log_frontend", {
    level: "error", message: expect.stringContaining("Accès refusé"),
  });
});
