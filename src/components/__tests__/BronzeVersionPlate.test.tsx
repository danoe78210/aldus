import { afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { getVersion } from "@tauri-apps/api/app";
import { version as packageVersion } from "../../../package.json";
import { checkForUpdates, openExternalUrl } from "../../utils/libraryApi";
import { BronzeVersionPlate } from "../navigation/BronzeVersionPlate";

vi.mock("@tauri-apps/api/app", () => ({ getVersion: vi.fn() }));
vi.mock("../../utils/libraryApi", () => ({ checkForUpdates: vi.fn(), openExternalUrl: vi.fn() }));

beforeAll(() => {
  Object.defineProperty(HTMLDialogElement.prototype, "showModal", { configurable: true, value() { this.setAttribute("open", ""); } });
  Object.defineProperty(HTMLDialogElement.prototype, "close", { configurable: true, value() { this.removeAttribute("open"); } });
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getVersion).mockResolvedValue(packageVersion);
  vi.mocked(checkForUpdates).mockResolvedValue({ available: false, latestVersion: packageVersion, releaseUrl: null, notes: null });
  vi.mocked(openExternalUrl).mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it("shows the package version immediately and then uses Tauri's native version", async () => {
  let resolveVersion!: (version: string) => void;
  vi.mocked(getVersion).mockImplementationOnce(() => new Promise((resolve) => { resolveVersion = resolve; }));
  render(<BronzeVersionPlate />);

  expect(screen.getByText(`Aldus · v${packageVersion}`)).toBeTruthy();
  resolveVersion("9.8.7");
  expect(await screen.findByText("Aldus · v9.8.7")).toBeTruthy();
});

it("illuminates the plate and opens release notes and the release page when an update exists", async () => {
  vi.mocked(checkForUpdates).mockResolvedValueOnce({
    available: true,
    latestVersion: "1.4.3",
    releaseUrl: null,
    notes: "Corrections et améliorations.",
  });
  render(<BronzeVersionPlate />);

  const plate = await screen.findByRole("button", { name: `Aldus · v${packageVersion}` });
  expect((plate as HTMLButtonElement).disabled).toBe(false);
  expect(plate.className).toContain("plaque-update-active");
  fireEvent.click(screen.getByRole("button", { name: `Aldus · v${packageVersion}` }));
  expect(await screen.findByRole("dialog", { name: "Version 1.4.3 disponible" })).toBeTruthy();
  expect(screen.getByText("Corrections et améliorations.")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Télécharger la mise à jour" }));
  expect(openExternalUrl).toHaveBeenCalledWith("https://github.com/danoe78210/aldus/releases/latest");
  fireEvent.click(screen.getByRole("button", { name: "Fermer" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

  fireEvent.click(screen.getByRole("button", { name: `Aldus · v${packageVersion}` }));
  const escapeDialog = await screen.findByRole("dialog", { name: "Version 1.4.3 disponible" });
  fireEvent(escapeDialog, new Event("cancel", { bubbles: true, cancelable: true }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

  fireEvent.click(screen.getByRole("button", { name: `Aldus · v${packageVersion}` }));
  const backdropDialog = await screen.findByRole("dialog", { name: "Version 1.4.3 disponible" });
  fireEvent.click(backdropDialog);
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});

it("keeps the halo quiet but exposes network errors and retry in the modal", async () => {
  vi.mocked(checkForUpdates).mockRejectedValueOnce(new Error("offline"));
  render(<BronzeVersionPlate />);

  const plate = await screen.findByRole("button", { name: `Aldus · v${packageVersion}` });
  expect((plate as HTMLButtonElement).disabled).toBe(false);
  expect(plate.className).not.toContain("plaque-update-active");
  expect(screen.queryByRole("alert")).toBeNull();
  expect(screen.queryByRole("dialog")).toBeNull();
  fireEvent.click(plate);
  expect(await screen.findByRole("alert")).toHaveProperty("textContent", "offline");
  fireEvent.click(await screen.findByRole("button", { name: "Vérifier maintenant" }));
  await waitFor(() => expect(checkForUpdates).toHaveBeenCalledWith(true));
  await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  expect(screen.getByText("Aucune mise à jour disponible lors de la dernière vérification.")).toBeTruthy();
});

it("forces a fresh check from the quiet plate and illuminates it without reopening the modal", async () => {
  render(<BronzeVersionPlate />);
  fireEvent.click(screen.getByRole("button", { name: `Aldus · v${packageVersion}` }));
  await waitFor(() => expect((screen.getByRole("button", { name: "Vérifier maintenant" }) as HTMLButtonElement).disabled).toBe(false));
  let resolveCheck!: (status: Awaited<ReturnType<typeof checkForUpdates>>) => void;
  vi.mocked(checkForUpdates).mockImplementationOnce(() => new Promise((resolve) => { resolveCheck = resolve; }));
  fireEvent.click(screen.getByRole("button", { name: "Vérifier maintenant" }));
  expect(checkForUpdates).toHaveBeenLastCalledWith(true);
  expect((screen.getByRole("button", { name: "Vérification en cours…" }) as HTMLButtonElement).disabled).toBe(true);
  resolveCheck({ available: true, latestVersion: "9.9.9", releaseUrl: null, notes: "Nouvelle version." });
  expect(await screen.findByRole("dialog", { name: "Version 9.9.9 disponible" })).toBeTruthy();
  expect(screen.getByRole("button", { name: `Aldus · v${packageVersion}` }).className).toContain("plaque-update-active");
  expect(screen.getByText("Nouvelle version.")).toBeTruthy();
});

it("preserves a known update when a forced request fails and allows another attempt", async () => {
  vi.mocked(checkForUpdates).mockResolvedValueOnce({
    available: true, latestVersion: "9.9.9", releaseUrl: null, notes: "Notes conservées.",
  });
  render(<BronzeVersionPlate />);
  await waitFor(() => expect(screen.getByRole("button", { name: `Aldus · v${packageVersion}` }).className).toContain("plaque-update-active"));
  fireEvent.click(screen.getByRole("button", { name: `Aldus · v${packageVersion}` }));
  vi.mocked(checkForUpdates).mockRejectedValueOnce(new Error("timeout"));
  fireEvent.click(screen.getByRole("button", { name: "Vérifier maintenant" }));
  expect(await screen.findByRole("alert")).toHaveProperty("textContent", "timeout");
  expect(screen.getByText("Notes conservées.")).toBeTruthy();
  expect(screen.getByRole("button", { name: `Aldus · v${packageVersion}` }).className).toContain("plaque-update-active");
  expect((screen.getByRole("button", { name: "Vérifier maintenant" }) as HTMLButtonElement).disabled).toBe(false);
});