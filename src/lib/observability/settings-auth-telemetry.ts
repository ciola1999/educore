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
let lifecycleHandlersBound = false;

const MAX_QUEUE = 20;
const FLUSH_DELAY_MS = 1500;
const FAST_FLUSH_DELAY_MS = 400;
const RETRY_DELAY_MS = 2500;

function trimQueue() {
  if (telemetryQueue.length <= MAX_QUEUE) {
    return;
  }
  telemetryQueue.splice(0, telemetryQueue.length - MAX_QUEUE);
}

function requeueBatch(batch: SettingsAuthTelemetryEnvelope[]) {
  if (batch.length === 0) {
    return;
  }

  telemetryQueue.unshift(...batch);
  trimQueue();
}

function scheduleRetry() {
  if (flushTimer) {
    return;
  }
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushTelemetryQueue();
  }, RETRY_DELAY_MS);
}

function postWithBeacon(batch: SettingsAuthTelemetryEnvelope[]): boolean {
  if (typeof navigator === "undefined" || !navigator.sendBeacon) {
    return false;
  }

  try {
    const payload = JSON.stringify({ events: batch });
    const blob = new Blob([payload], { type: "application/json" });
    return navigator.sendBeacon("/api/telemetry/settings-auth", blob);
  } catch {
    return false;
  }
}

async function flushTelemetryQueue(preferBeacon = false) {
  if (flushing || telemetryQueue.length === 0) {
    return;
  }

  flushing = true;
  const batch = telemetryQueue.splice(0, telemetryQueue.length);

  try {
    if (preferBeacon && postWithBeacon(batch)) {
      return;
    }

    const response = await fetch("/api/telemetry/settings-auth", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      keepalive: true,
      body: JSON.stringify({ events: batch }),
    });

    if (!response.ok) {
      throw new Error(`Telemetry flush failed with status ${response.status}`);
    }
  } catch {
    // Retry quietly and preserve queue to avoid telemetry event loss.
    requeueBatch(batch);
    scheduleRetry();
  } finally {
    flushing = false;
  }
}

function bindLifecycleFlushHandlers() {
  if (lifecycleHandlersBound || typeof window === "undefined") {
    return;
  }

  lifecycleHandlersBound = true;

  const flushNow = () => {
    void flushTelemetryQueue(true);
  };

  window.addEventListener("pagehide", flushNow);
  window.addEventListener("beforeunload", flushNow);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      flushNow();
    }
  });
}

function scheduleFlush() {
  if (flushTimer) {
    return;
  }

  const delay =
    telemetryQueue.length >= 10 ? FAST_FLUSH_DELAY_MS : FLUSH_DELAY_MS;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushTelemetryQueue();
  }, delay);
}

export function sendSettingsAuthTelemetry(
  envelope: SettingsAuthTelemetryEnvelope,
) {
  if (typeof window === "undefined") {
    return;
  }

  bindLifecycleFlushHandlers();

  if (telemetryQueue.length >= MAX_QUEUE) {
    telemetryQueue.shift();
  }

  telemetryQueue.push(envelope);
  scheduleFlush();
}
