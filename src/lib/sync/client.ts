import { createClient } from "@libsql/client/web";

const url = process.env.NEXT_PUBLIC_DATABASE_URL!;
const authToken = process.env.NEXT_PUBLIC_DATABASE_AUTH_TOKEN!;

// Elite 2026 Sync Client: Always connect to Turso Cloud
export const tursoCloud = createClient({
  url: url.startsWith("libsql://") ? url.replace("libsql://", "https://") : url,
  authToken: authToken,
});

export type SyncStatus = "idle" | "syncing" | "success" | "error";

export interface SyncResult {
  status: SyncStatus;
  message: string;
  uploaded?: number;
  downloaded?: number;
}
