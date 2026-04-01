"use client";

import { apiPost } from "@/lib/api/request";
import { ensureAppWarmup } from "@/lib/runtime/app-bootstrap";

type AttendanceProjectionSyncResult = {
  classCreated: number;
  studentUpserted: number;
  settingsSeeded: number;
};

const ATTENDANCE_PROJECTION_LAST_SYNC_KEY = "attendance_projection_last_sync";
const ATTENDANCE_PROJECTION_SYNC_COOLDOWN_MS = 5 * 60 * 1000;

let inflightProjectionSync: Promise<AttendanceProjectionSyncResult> | null =
  null;

function getLastProjectionSyncAt() {
  if (typeof window === "undefined") {
    return null;
  }

  const rawValue = window.sessionStorage.getItem(
    ATTENDANCE_PROJECTION_LAST_SYNC_KEY,
  );
  const timestamp = Number(rawValue);

  return Number.isFinite(timestamp) ? timestamp : null;
}

export function hasRecentAttendanceProjectionSync(options?: {
  force?: boolean;
  now?: number;
  cooldownMs?: number;
}) {
  if (typeof window === "undefined") {
    return true;
  }

  if (options?.force) {
    return false;
  }

  const lastSyncAt = getLastProjectionSyncAt();
  if (lastSyncAt === null) {
    return false;
  }

  const now = options?.now ?? Date.now();
  const cooldownMs =
    options?.cooldownMs ?? ATTENDANCE_PROJECTION_SYNC_COOLDOWN_MS;

  return now - lastSyncAt <= cooldownMs;
}

export async function ensureAttendanceProjectionSync(options?: {
  force?: boolean;
  timeoutMs?: number;
}) {
  if (typeof window === "undefined") {
    return null;
  }

  if (hasRecentAttendanceProjectionSync(options)) {
    return null;
  }

  if (inflightProjectionSync) {
    return inflightProjectionSync;
  }

  window.sessionStorage.setItem(
    ATTENDANCE_PROJECTION_LAST_SYNC_KEY,
    Date.now().toString(),
  );

  inflightProjectionSync = ensureAppWarmup()
    .then(() =>
      apiPost<AttendanceProjectionSyncResult>(
        "/api/attendance/projection-sync",
        undefined,
        {
          timeoutMs: options?.timeoutMs,
        },
      ),
    )
    .catch((error) => {
      window.sessionStorage.removeItem(ATTENDANCE_PROJECTION_LAST_SYNC_KEY);
      throw error;
    })
    .finally(() => {
      inflightProjectionSync = null;
    });

  return inflightProjectionSync;
}
