import { isTauri } from "@/core/env";
import { apiPost } from "@/lib/api/request";
import type { SyncResult } from "./client";

type SyncAction = "full" | "push" | "pull";

async function runWebSync(action: SyncAction): Promise<SyncResult> {
  return apiPost<SyncResult>(`/api/sync/${action}`);
}

async function runDesktopSync(action: SyncAction): Promise<SyncResult> {
  const syncModule = await import("./turso-sync");

  if (action === "push") {
    return syncModule.pushToCloud();
  }

  if (action === "pull") {
    return syncModule.pullFromCloud();
  }

  return syncModule.fullSync();
}

export async function runFullSync(): Promise<SyncResult> {
  return isTauri() ? runDesktopSync("full") : runWebSync("full");
}

export async function runPushSync(): Promise<SyncResult> {
  return isTauri() ? runDesktopSync("push") : runWebSync("push");
}

export async function runPullSync(): Promise<SyncResult> {
  return isTauri() ? runDesktopSync("pull") : runWebSync("pull");
}
