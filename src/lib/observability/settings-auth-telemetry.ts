"use client";

type TelemetryStatus = "info" | "success" | "warning" | "error";
type TelemetryAction =
  | "sync"
  | "change-password"
  | "session-refresh"
  | "logout"
  | "sync-config-load"
  | "sync-config-save";

export type SettingsAuthTelemetryEvent = {
  id: string;
  at: string;
  action: TelemetryAction;
  status: TelemetryStatus;
  runtime: "desktop" | "web";
  detail: string;
};

type SettingsAuthTelemetryEnvelope = {
  page: "dashboard/settings";
  sessionStatus: string;
  authSource: string;
  activeRole: string | null;
  event: SettingsAuthTelemetryEvent;
};

const telemetryQueue: SettingsAuthTelemetryEnvelope[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let flushing = false;

const MAX_QUEUE = 20;
const FLUSH_DELAY_MS = 1500;

async function flushTelemetryQueue() {
  if (flushing || telemetryQueue.length === 0) {
    return;
  }

  flushing = true;
  const batch = telemetryQueue.splice(0, telemetryQueue.length);

  try {
    await fetch("/api/telemetry/settings-auth", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      keepalive: true,
      body: JSON.stringify({ events: batch }),
    });
  } catch {
    // Ignore telemetry network failures to avoid user-facing regressions.
  } finally {
    flushing = false;
  }
}

function scheduleFlush() {
  if (flushTimer) {
    return;
  }

  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushTelemetryQueue();
  }, FLUSH_DELAY_MS);
}

export function sendSettingsAuthTelemetry(
  envelope: SettingsAuthTelemetryEnvelope,
) {
  if (typeof window === "undefined") {
    return;
  }

  if (telemetryQueue.length >= MAX_QUEUE) {
    telemetryQueue.shift();
  }

  telemetryQueue.push(envelope);
  scheduleFlush();
}
