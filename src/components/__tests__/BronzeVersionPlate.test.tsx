import { afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
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
    releaseUrl: "https://github.com/danoe78210/aldus/releases/tag/v1.4.3",
    notes: "Corrections et améliorations.",
  });
  render(<BronzeVersionPlate />);

  const plate = await screen.findByRole("button", { name: `Aldus · v${packageVersion}` });
  expect((plate as HTMLButtonElement).disabled).toBe(false);
  screen.getByRole("button", { name: `Aldus · v${packageVersion}` }).click();
  expect(await screen.findByRole("dialog", { name: "Version 1.4.3 disponible" })).toBeTruthy();
  expect(screen.getByText("Corrections et améliorations.")).toBeTruthy();
  screen.getByRole("button", { name: "Télécharger la mise à jour" }).click();
  expect(openExternalUrl).toHaveBeenCalledWith("https://github.com/danoe78210/aldus/releases/tag/v1.4.3");
});

it("keeps the plate quiet when the update service is unavailable", async () => {
  vi.mocked(checkForUpdates).mockRejectedValueOnce(new Error("offline"));
  render(<BronzeVersionPlate />);

  const plate = await screen.findByRole("button", { name: `Aldus · v${packageVersion}` });
  expect((plate as HTMLButtonElement).disabled).toBe(true);
  expect(screen.queryByRole("alert")).toBeNull();
  expect(screen.queryByRole("dialog")).toBeNull();
});