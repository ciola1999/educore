import { isTauri } from "@/core/env";

export const DESKTOP_SYNC_URL_KEY = "educore.sync.url";
export const DESKTOP_SYNC_TOKEN_KEY = "educore.sync.token";

export type DesktopSyncStorageConfig = {
  url: string;
  authToken: string;
};

export function readDesktopSyncStorageConfig(): DesktopSyncStorageConfig | null {
  if (typeof window === "undefined" || !isTauri()) {
    return null;
  }

  const url = window.localStorage.getItem(DESKTOP_SYNC_URL_KEY) || "";
  const authToken = window.localStorage.getItem(DESKTOP_SYNC_TOKEN_KEY) || "";

  if (!url.trim() || !authToken.trim()) {
    return null;
  }

  return {
    url: url.trim(),
    authToken: authToken.trim(),
  };
}

export function writeDesktopSyncStorageConfig(
  config: DesktopSyncStorageConfig,
) {
  if (typeof window === "undefined" || !isTauri()) {
    return;
  }

  window.localStorage.setItem(DESKTOP_SYNC_URL_KEY, config.url.trim());
  window.localStorage.setItem(DESKTOP_SYNC_TOKEN_KEY, config.authToken.trim());
}
