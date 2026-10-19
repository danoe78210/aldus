import { beforeEach, describe, expect, it, vi } from "vitest";
import { invokeCommand } from "../tauri";
import { getLogConfig, openLogFile, setLogConfig } from "../logApi";

vi.mock("../tauri", () => ({ invokeCommand: vi.fn() }));

beforeEach(() => vi.resetAllMocks());

describe("pedagogical journal API", () => {
  it("loads persisted preferences and reports an absent legacy configuration", async () => {
    vi.mocked(invokeCommand).mockResolvedValueOnce(null);
    expect(await getLogConfig()).toBeNull();
    vi.mocked(invokeCommand).mockResolvedValueOnce({ directory: "E:\\Erreurs", diagnostic: true });
    expect(await getLogConfig()).toEqual({ directory: "E:\\Erreurs", level: "diagnostic" });
  });

  it("patches only the changed preference", async () => {
    vi.mocked(invokeCommand).mockResolvedValue({ directory: "E:\\Erreurs", diagnostic: false });
    expect(await setLogConfig({ directory: "E:\\Erreurs" })).toEqual({
      directory: "E:\\Erreurs", level: "standard",
    });
    expect(invokeCommand).toHaveBeenLastCalledWith("set_log_config", { directory: "E:\\Erreurs" });
    await setLogConfig({ level: "diagnostic" });
    expect(invokeCommand).toHaveBeenLastCalledWith("set_log_config", { diagnostic: true });
  });

  it("opens the backend journal, propagating errors instead of reporting success", async () => {
    vi.mocked(invokeCommand).mockResolvedValueOnce("E:\\Erreurs\\journal_erreurs_aldus.txt");
    expect(await openLogFile()).toBe("E:\\Erreurs\\journal_erreurs_aldus.txt");
    expect(invokeCommand).toHaveBeenCalledWith("open_log_file");
    vi.mocked(invokeCommand).mockRejectedValueOnce(new Error("Accès refusé"));
    await expect(openLogFile()).rejects.toThrow("Accès refusé");
  });
});
