export type SyncStatus = "idle" | "syncing" | "success" | "error";

export interface SyncResult {
  status: SyncStatus;
  message: string;
  uploaded?: number;
  downloaded?: number;
}
