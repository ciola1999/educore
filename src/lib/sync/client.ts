import { type Client, createClient } from "@libsql/client/web";
import { isTauri } from "@/core/env";

type SyncConfig = {
  url: string;
  authToken: string;
};

async function resolveDesktopSyncConfig(): Promise<SyncConfig> {
  const { invoke } = await import("@tauri-apps/api/core");
  const config = await invoke<{ url: string; auth_token: string }>(
    "get_sync_config",
  );

  const url = config.url?.trim() ?? "";
  const authToken = config.auth_token?.trim() ?? "";

  if (!url || !authToken) {
    throw new Error(
      "Konfigurasi sync desktop tidak lengkap. Simpan URL dan auth token melalui runtime native desktop.",
    );
  }

  return {
    url,
    authToken,
  };
}

function resolveWebSyncConfig(): SyncConfig {
  throw new Error(
    "Browser runtime must not initialize direct sync client credentials. Gunakan route handler /api/sync/* di web runtime.",
  );
}

let tursoCloudClient: Client | null = null;
let tursoCloudClientPromise: Promise<Client> | null = null;

export async function getTursoCloudClient(): Promise<Client> {
  if (tursoCloudClient) {
    return tursoCloudClient;
  }

  if (!tursoCloudClientPromise) {
    tursoCloudClientPromise = (async () => {
      const config = isTauri()
        ? await resolveDesktopSyncConfig()
        : resolveWebSyncConfig();
      tursoCloudClient = createClient({
        url: config.url,
        authToken: config.authToken,
      });

      return tursoCloudClient;
    })();
  }

  return tursoCloudClientPromise;
}

export type SyncStatus = "idle" | "syncing" | "success" | "error";

export interface SyncResult {
  status: SyncStatus;
  message: string;
  uploaded?: number;
  downloaded?: number;
}
