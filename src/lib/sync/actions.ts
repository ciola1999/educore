import { apiPost } from "@/lib/api/request";
import type { SyncResult } from "./types";

type SyncAction = "full" | "push" | "pull";

async function runSync(action: SyncAction): Promise<SyncResult> {
  return apiPost<SyncResult>(`/api/sync/${action}`);
}

export async function runFullSync(): Promise<SyncResult> {
  return runSync("full");
}

export async function runPushSync(): Promise<SyncResult> {
  return runSync("push");
}

export async function runPullSync(): Promise<SyncResult> {
  return runSync("pull");
}
