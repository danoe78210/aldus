import type { ErrorLogConfig } from "../types";
import { invokeCommand } from "./tauri";

interface MirrorLogConfig {
  directory: string | null;
  diagnostic: boolean;
}

const toUiConfig = (config: MirrorLogConfig): ErrorLogConfig => ({
  directory: config.directory,
  level: config.diagnostic ? "diagnostic" : "standard",
});

export const getLogConfig = async (): Promise<ErrorLogConfig | null> => {
  const config = await invokeCommand<MirrorLogConfig | null>("get_log_config");
  return config ? toUiConfig(config) : null;
};

export const setLogConfig = async (
  patch: Partial<ErrorLogConfig>,
): Promise<ErrorLogConfig> =>
  toUiConfig(await invokeCommand<MirrorLogConfig>("set_log_config", {
    ...(patch.directory != null ? { directory: patch.directory } : {}),
    ...(patch.level ? { diagnostic: patch.level === "diagnostic" } : {}),
  }));

export const openLogFile = (): Promise<string> =>
  invokeCommand<string>("open_log_file");
