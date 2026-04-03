"use client";

import {
  AlertTriangle,
  CheckCircle,
  ClipboardCopy,
  Cloud,
  CloudDownload,
  CloudUpload,
  Filter,
  Loader2,
  Lock,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Siren,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { InlineState } from "@/components/common/inline-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isTauri } from "@/core/env";
import { useAuth } from "@/hooks/use-auth";
import { apiGet, apiPost } from "@/lib/api/request";
import { checkPermission } from "@/lib/auth/rbac";
import { sendSettingsAuthTelemetry } from "@/lib/observability/settings-auth-telemetry";
import {
  type DesktopRuntimeBootstrapConfig,
  type DesktopRuntimeBootstrapEnsureResult,
  type DesktopRuntimeBootstrapHealth,
  ensureDesktopRuntimeBootstrapReady,
} from "@/lib/runtime/desktop-bootstrap-config";
import { runFullSync, runPullSync, runPushSync } from "@/lib/sync/actions";
import type { SyncResult } from "@/lib/sync/types";
import { outlineButtonStyles } from "@/lib/ui/outline-button-styles";

type DesktopSyncConfig = {
  url: string;
  authToken: string;
};

type SyncAction = "full" | "push" | "pull";
type TraceStatus = "info" | "success" | "warning" | "error";
type TraceAction =
  | "sync"
  | "change-password"
  | "session-refresh"
  | "logout"
  | "sync-config-load"
  | "sync-config-save";

type SettingsTraceEvent = {
  id: string;
  at: string;
  action: TraceAction;
  status: TraceStatus;
  runtime: "desktop" | "web";
  detail: string;
};

type TelemetrySummary = {
  hours: number;
  totalEvents: number;
  totalErrors: number;
  totalWarnings: number;
  totalEscalations: number;
  runtimeBreakdown: {
    web: number;
    desktop: number;
  };
};

function extractUnknownErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }

  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }

  if (typeof error === "object" && error !== null) {
    const record = error as Record<string, unknown>;
    const message = record.message;
    if (typeof message === "string" && message.trim()) {
      return message.trim();
    }
  }

  return fallback;
}

function isDesktopSyncConfigMissingMessage(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes(
      "sync_database_url/turso_database_url belum dikonfigurasi",
    ) ||
    normalized.includes(
      "sync_database_auth_token/turso_auth_token belum dikonfigurasi",
    ) ||
    normalized.includes("keyring/file/env")
  );
}

const TRACE_STORAGE_KEY = "settings-auth-trace-v1";
const SESSION_REFRESH_STORAGE_KEY = "settings-auth-last-refresh-v1";
const TRACE_RETENTION_MS = 24 * 60 * 60 * 1000;
const TRACE_STORAGE_LIMIT = 100;
const TRACE_RECENT_WINDOW_MS = 10 * 60 * 1000;
const INCIDENT_ESCALATION_COOLDOWN_MS = 5 * 60 * 1000;
const INCIDENT_ESCALATION_STORAGE_KEY = "settings-auth-incident-escalation-v1";

function sanitizeTraceDetail(input: string): string {
  const normalized = input.trim();
  const redactedBearer = normalized.replace(
    /bearer\s+[a-z0-9\-._~+/]+=*/gi,
    "bearer [redacted]",
  );
  const redactedJwt = redactedBearer.replace(
    /\beyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\b/g,
    "[jwt-redacted]",
  );
  return redactedJwt.slice(0, 400);
}

function pruneTraceEvents(events: SettingsTraceEvent[]): SettingsTraceEvent[] {
  const now = Date.now();
  const retained = events.filter((event) => {
    const timestamp = new Date(event.at).getTime();
    if (!Number.isFinite(timestamp)) {
      return false;
    }
    return now - timestamp <= TRACE_RETENTION_MS;
  });

  return retained.slice(0, TRACE_STORAGE_LIMIT);
}

function buildTraceInsights(
  events: SettingsTraceEvent[],
  showErrorOnly: boolean,
): {
  visibleTraceEvents: SettingsTraceEvent[];
  recentErrorCount: number;
  recentRecoveryErrorCount: number;
} {
  const visibleTraceEvents: SettingsTraceEvent[] = [];
  const recentThreshold = Date.now() - TRACE_RECENT_WINDOW_MS;
  let recentErrorCount = 0;
  let recentRecoveryErrorCount = 0;

  for (const event of events) {
    const isError = event.status === "error";
    if (!showErrorOnly || isError) {
      visibleTraceEvents.push(event);
    }

    if (!isError) {
      continue;
    }

    const eventAt = new Date(event.at).getTime();
    if (!Number.isFinite(eventAt) || eventAt < recentThreshold) {
      continue;
    }

    recentErrorCount += 1;
    if (event.action === "session-refresh" || event.action === "logout") {
      recentRecoveryErrorCount += 1;
    }
  }

  return {
    visibleTraceEvents,
    recentErrorCount,
    recentRecoveryErrorCount,
  };
}

export default function SettingsPage() {
  const router = useRouter();
  const {
    user,
    session,
    sessionStatus,
    authSource,
    logout,
    refreshSession,
    isLoading,
  } = useAuth();
  const canManageSettings = checkPermission(user, "settings:manage");
  const desktopRuntime = isTauri();
  const webRuntime = !desktopRuntime;
  const runtime = desktopRuntime ? "desktop" : "web";
  const sessionRole = (session?.user as { role?: string } | undefined)?.role;
  const sessionEmail = session?.user?.email || "";
  const userRole = user?.role || "";
  const userEmail = user?.email || "";
  const hasSessionMismatch =
    webRuntime &&
    ((sessionStatus === "authenticated" && !user) ||
      (sessionStatus === "unauthenticated" && !!user) ||
      (sessionRole && userRole && sessionRole !== userRole) ||
      (sessionEmail &&
        userEmail &&
        sessionEmail.toLowerCase() !== userEmail.toLowerCase()));

  const [syncAction, setSyncAction] = useState<SyncAction | null>(null);
  const [lastResult, setLastResult] = useState<SyncResult | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [syncConfig, setSyncConfig] = useState<DesktopSyncConfig>({
    url: "",
    authToken: "",
  });
  const [desktopBootstrapConfig, setDesktopBootstrapConfig] =
    useState<DesktopRuntimeBootstrapConfig | null>(null);
  const [desktopBootstrapHealth, setDesktopBootstrapHealth] =
    useState<DesktopRuntimeBootstrapHealth | null>(null);
  const [desktopBootstrapEnsureResult, setDesktopBootstrapEnsureResult] =
    useState<DesktopRuntimeBootstrapEnsureResult | null>(null);
  const [desktopBootstrapLoading, setDesktopBootstrapLoading] = useState(false);
  const [desktopBootstrapError, setDesktopBootstrapError] = useState<
    string | null
  >(null);
  const [configLoading, setConfigLoading] = useState(false);
  const [configSaving, setConfigSaving] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [changingPassword, setChangingPassword] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [refreshingSession, setRefreshingSession] = useState(false);
  const [runningIncidentAction, setRunningIncidentAction] = useState<
    "recovery" | "sync" | null
  >(null);
  const [telemetrySummary, setTelemetrySummary] =
    useState<TelemetrySummary | null>(null);
  const [telemetrySummaryLoading, setTelemetrySummaryLoading] = useState(false);
  const [telemetrySummaryError, setTelemetrySummaryError] = useState<
    string | null
  >(null);
  const [lastIncidentEscalationAt, setLastIncidentEscalationAt] =
    useState<Date | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [lastSessionRefreshAt, setLastSessionRefreshAt] = useState<Date | null>(
    null,
  );
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [traceEvents, setTraceEvents] = useState<SettingsTraceEvent[]>([]);
  const [showErrorTraceOnly, setShowErrorTraceOnly] = useState(false);
  const [redactSensitiveTraceData, setRedactSensitiveTraceData] =
    useState(true);
  const syncConfigInitializedRef = useRef(false);

  const isSyncing = syncAction !== null;
  const isPasswordMismatch = newPassword !== confirmPassword;
  const isPasswordReuse =
    Boolean(currentPassword) &&
    Boolean(newPassword) &&
    currentPassword === newPassword;
  const isPasswordTooShort = Boolean(newPassword) && newPassword.length < 8;
  const latestSessionRefreshTraceAt =
    traceEvents.find(
      (event) =>
        event.action === "session-refresh" && event.status === "success",
    )?.at ?? null;
  const effectiveLastSessionRefreshAt =
    lastSessionRefreshAt ??
    (latestSessionRefreshTraceAt
      ? new Date(latestSessionRefreshTraceAt)
      : null);
  const formattedLastSyncAt = lastSyncAt ? lastSyncAt.toLocaleString() : "-";
  const formattedLastSessionRefreshAt = effectiveLastSessionRefreshAt
    ? effectiveLastSessionRefreshAt.toLocaleString()
    : "-";
  const { visibleTraceEvents, recentErrorCount, recentRecoveryErrorCount } =
    buildTraceInsights(traceEvents, showErrorTraceOnly);
  const hasRecentErrorBurst = recentErrorCount >= 3;
  const hasRecoveryRisk = recentRecoveryErrorCount >= 2;
  const incidentLevel = hasRecentErrorBurst
    ? "critical"
    : hasRecoveryRisk
      ? "warning"
      : "normal";
  const formattedLastIncidentEscalationAt = lastIncidentEscalationAt
    ? lastIncidentEscalationAt.toLocaleString()
    : "-";

  async function runIncidentRecovery() {
    setRunningIncidentAction("recovery");
    try {
      const refreshed = await refreshSession();
      if (refreshed) {
        const nextRefreshAt = new Date();
        setLastSessionRefreshAt(nextRefreshAt);
        persistLastSessionRefreshAt(nextRefreshAt);
        toast.success("Recovery berhasil: session aktif dan sinkron.");
        appendTrace(
          "session-refresh",
          "success",
          "Incident recovery succeeded.",
        );
      } else {
        toast.warning("Recovery butuh login ulang. Session tidak valid.");
        appendTrace(
          "session-refresh",
          "warning",
          "Incident recovery requires re-login.",
        );
      }
      router.refresh();
    } catch {
      toast.error("Recovery gagal diproses.");
      appendTrace("session-refresh", "error", "Incident recovery failed.");
    } finally {
      setRunningIncidentAction(null);
    }
  }

  async function loadTelemetrySummary() {
    if (desktopRuntime || authSource === "desktop-store") {
      setTelemetrySummary(null);
      setTelemetrySummaryError(
        "Telemetry summary server hanya tersedia untuk runtime web.",
      );
      setTelemetrySummaryLoading(false);
      return;
    }

    setTelemetrySummaryLoading(true);
    setTelemetrySummaryError(null);
    try {
      const summary = await apiGet<TelemetrySummary>(
        "/api/telemetry/settings-auth?hours=24",
      );
      setTelemetrySummary(summary);
    } catch (error) {
      setTelemetrySummaryError(
        error instanceof Error
          ? error.message
          : "Gagal memuat telemetry summary.",
      );
    } finally {
      setTelemetrySummaryLoading(false);
    }
  }

  function canEscalateIncident(now: number): boolean {
    if (!lastIncidentEscalationAt) {
      return true;
    }
    return (
      now - lastIncidentEscalationAt.getTime() >=
      INCIDENT_ESCALATION_COOLDOWN_MS
    );
  }

  function emitIncidentEscalation(params: {
    source: "auto" | "manual";
    level: "warning" | "critical";
  }) {
    const { source, level } = params;
    const now = Date.now();
    if (!canEscalateIncident(now)) {
      return false;
    }

    const timestamp = new Date(now);
    const status = level === "critical" ? "error" : "warning";
    const escalationDetail = `[incident-escalation:${source}] level=${level} recentErrorCount=${recentErrorCount} recoveryErrorCount=${recentRecoveryErrorCount}`;
    const event: SettingsTraceEvent = {
      id: crypto.randomUUID(),
      at: timestamp.toISOString(),
      action: "session-refresh",
      status,
      runtime,
      detail: sanitizeTraceDetail(escalationDetail),
    };

    sendSettingsAuthTelemetry({
      page: "dashboard/settings",
      sessionStatus,
      authSource,
      activeRole: userRole || null,
      event,
    });
    setLastIncidentEscalationAt(timestamp);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        INCIDENT_ESCALATION_STORAGE_KEY,
        timestamp.toISOString(),
      );
    }

    if (desktopRuntime) {
      void (async () => {
        try {
          const { BaseDirectory, writeTextFile } = await import(
            "@tauri-apps/plugin-fs"
          );
          const payload = JSON.stringify({
            source: "settings-auth-incident-escalation",
            at: timestamp.toISOString(),
            level,
            runtime,
            sessionStatus,
            authSource,
            activeRole: userRole || null,
            recentErrorCount,
            recentRecoveryErrorCount,
          });

          // Write as JSONL for lightweight desktop postmortem timeline.
          await writeTextFile(
            "settings-auth-incident-escalation.log",
            `${payload}\n`,
            {
              append: true,
              create: true,
              baseDir: BaseDirectory.AppLog,
            },
          );
        } catch {
          // Ignore desktop mirror failures to avoid blocking user flows.
        }
      })();
    }
    return true;
  }

  function maskEmail(email: string | null): string | null {
    if (!email) {
      return null;
    }

    const normalized = email.trim().toLowerCase();
    const [local, domain] = normalized.split("@");
    if (!local || !domain) {
      return "***";
    }

    const localPrefix = local.slice(0, 2);
    return `${localPrefix}${"*".repeat(Math.max(local.length - 2, 1))}@${domain}`;
  }

  function buildTraceReportPayload() {
    const activeEmail = redactSensitiveTraceData
      ? maskEmail(userEmail)
      : userEmail;

    return {
      generatedAt: new Date().toISOString(),
      page: "dashboard/settings",
      runtime,
      authSource,
      sessionStatus,
      showErrorTraceOnly,
      redactSensitiveTraceData,
      activeRole: userRole || null,
      activeEmail: activeEmail || null,
      traces: traceEvents,
    };
  }

  function appendTrace(
    action: TraceAction,
    status: TraceStatus,
    detail: string,
  ) {
    const event: SettingsTraceEvent = {
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      action,
      status,
      runtime,
      detail: sanitizeTraceDetail(detail),
    };

    setTraceEvents((prev) => pruneTraceEvents([event, ...prev]));

    if (status !== "info") {
      sendSettingsAuthTelemetry({
        page: "dashboard/settings",
        sessionStatus,
        authSource,
        activeRole: userRole || null,
        event,
      });
    }
  }

  async function copyTraceReport() {
    const payload = buildTraceReportPayload();

    try {
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      toast.success("Laporan debug berhasil disalin.");
      appendTrace(
        "session-refresh",
        "info",
        "Debug report copied to clipboard.",
      );
    } catch {
      toast.error("Gagal menyalin laporan debug.");
      appendTrace("session-refresh", "error", "Failed to copy debug report.");
    }
  }

  async function exportTraceReportAsJson() {
    if (!desktopRuntime) {
      toast.error("Export trace ke file hanya tersedia di desktop runtime.");
      appendTrace(
        "session-refresh",
        "warning",
        "Blocked trace export: desktop runtime only.",
      );
      return;
    }

    try {
      const payload = buildTraceReportPayload();
      const serialized = JSON.stringify(payload, null, 2);
      const defaultFileName = `settings-auth-trace-${new Date().toISOString().replaceAll(":", "-")}.json`;

      const [{ save }, { writeTextFile }] = await Promise.all([
        import("@tauri-apps/plugin-dialog"),
        import("@tauri-apps/plugin-fs"),
      ]);

      const target = await save({
        defaultPath: defaultFileName,
        filters: [{ name: "JSON", extensions: ["json"] }],
      });

      if (!target) {
        appendTrace(
          "session-refresh",
          "info",
          "Trace export canceled by user.",
        );
        return;
      }

      await writeTextFile(target, serialized);
      toast.success("Laporan jejak berhasil diekspor.");
      appendTrace(
        "session-refresh",
        "success",
        "Trace report exported to local JSON file.",
      );
    } catch (error) {
      toast.error("Gagal mengekspor laporan jejak.");
      appendTrace(
        "session-refresh",
        "error",
        error instanceof Error
          ? `Trace export failed: ${error.message}`
          : "Trace export failed.",
      );
    }
  }

  function clearTraceEvents() {
    setTraceEvents([]);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(TRACE_STORAGE_KEY);
    }
    toast.success("Jejak event berhasil dibersihkan.");
  }

  function persistLastSessionRefreshAt(nextValue: Date | null) {
    if (typeof window === "undefined") {
      return;
    }

    if (!nextValue) {
      window.localStorage.removeItem(SESSION_REFRESH_STORAGE_KEY);
      return;
    }

    window.localStorage.setItem(
      SESSION_REFRESH_STORAGE_KEY,
      nextValue.toISOString(),
    );
  }

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const raw = window.localStorage.getItem(TRACE_STORAGE_KEY);
      if (!raw) {
        return;
      }

      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed)) {
        return;
      }

      const hydrated = parsed
        .filter(
          (item): item is SettingsTraceEvent =>
            !!item &&
            typeof item === "object" &&
            typeof (item as SettingsTraceEvent).id === "string" &&
            typeof (item as SettingsTraceEvent).at === "string" &&
            typeof (item as SettingsTraceEvent).action === "string" &&
            typeof (item as SettingsTraceEvent).status === "string" &&
            typeof (item as SettingsTraceEvent).runtime === "string" &&
            typeof (item as SettingsTraceEvent).detail === "string",
        )
        .map((item) => ({
          ...item,
          detail: sanitizeTraceDetail(item.detail),
        }));

      setTraceEvents(pruneTraceEvents(hydrated));
    } catch {
      window.localStorage.removeItem(TRACE_STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const raw = window.localStorage.getItem(SESSION_REFRESH_STORAGE_KEY);
    if (!raw) {
      return;
    }

    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) {
      window.localStorage.removeItem(SESSION_REFRESH_STORAGE_KEY);
      return;
    }

    setLastSessionRefreshAt(parsed);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      const nextValue = JSON.stringify(pruneTraceEvents(traceEvents));
      window.localStorage.setItem(TRACE_STORAGE_KEY, nextValue);
    } catch {
      // Ignore local persistence failures.
    }
  }, [traceEvents]);

  useEffect(() => {
    if (!user?.id) {
      return;
    }

    if (desktopRuntime || authSource === "desktop-store") {
      setTelemetrySummary(null);
      setTelemetrySummaryError(
        "Telemetry summary server hanya tersedia untuk runtime web.",
      );
      setTelemetrySummaryLoading(false);
      return;
    }

    setTelemetrySummaryLoading(true);
    setTelemetrySummaryError(null);
    void (async () => {
      try {
        const summary = await apiGet<TelemetrySummary>(
          "/api/telemetry/settings-auth?hours=24",
        );
        setTelemetrySummary(summary);
      } catch (error) {
        setTelemetrySummaryError(
          error instanceof Error
            ? error.message
            : "Gagal memuat telemetry summary.",
        );
      } finally {
        setTelemetrySummaryLoading(false);
      }
    })();
  }, [user?.id, desktopRuntime, authSource]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const raw = window.localStorage.getItem(INCIDENT_ESCALATION_STORAGE_KEY);
    if (!raw) {
      return;
    }
    const timestamp = new Date(raw);
    if (Number.isNaN(timestamp.getTime())) {
      window.localStorage.removeItem(INCIDENT_ESCALATION_STORAGE_KEY);
      return;
    }
    setLastIncidentEscalationAt(timestamp);
  }, []);

  useEffect(() => {
    if (incidentLevel === "normal") {
      return;
    }
    const now = Date.now();
    const canEscalate =
      !lastIncidentEscalationAt ||
      now - lastIncidentEscalationAt.getTime() >=
        INCIDENT_ESCALATION_COOLDOWN_MS;
    if (!canEscalate) {
      return;
    }

    const escalationLevel =
      incidentLevel === "critical" ? "critical" : "warning";
    const timestamp = new Date(now);
    const event: SettingsTraceEvent = {
      id: crypto.randomUUID(),
      at: timestamp.toISOString(),
      action: "session-refresh",
      status: escalationLevel === "critical" ? "error" : "warning",
      runtime,
      detail: sanitizeTraceDetail(
        `[incident-escalation:auto] level=${escalationLevel} recentErrorCount=${recentErrorCount} recoveryErrorCount=${recentRecoveryErrorCount}`,
      ),
    };

    sendSettingsAuthTelemetry({
      page: "dashboard/settings",
      sessionStatus,
      authSource,
      activeRole: userRole || null,
      event,
    });
    setLastIncidentEscalationAt(timestamp);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(
        INCIDENT_ESCALATION_STORAGE_KEY,
        timestamp.toISOString(),
      );
    }
  }, [
    incidentLevel,
    lastIncidentEscalationAt,
    recentErrorCount,
    recentRecoveryErrorCount,
    runtime,
    sessionStatus,
    authSource,
    userRole,
  ]);

  async function runSync(action: SyncAction) {
    appendTrace("sync", "info", `Starting ${action} sync.`);
    setSyncAction(action);
    setLastResult(null);
    setSyncError(null);

    try {
      const result =
        action === "full"
          ? await runFullSync()
          : action === "push"
            ? await runPushSync()
            : await runPullSync();

      setLastResult(result);

      if (result.status === "error") {
        setSyncError(result.message);
        appendTrace("sync", "error", `${action} failed: ${result.message}`);
        toast.error(result.message);
      } else {
        setLastSyncAt(new Date());
        appendTrace(
          "sync",
          "success",
          `${action} succeeded: ${result.message}`,
        );
        toast.success(result.message);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Sinkronisasi gagal diproses";
      setLastResult({ status: "error", message });
      setSyncError(message);
      appendTrace("sync", "error", `${action} exception: ${message}`);
      toast.error(message);
    } finally {
      setSyncAction(null);
    }
  }

  async function loadSyncConfig() {
    appendTrace("sync-config-load", "info", "Loading desktop sync config.");
    setConfigLoading(true);
    setConfigError(null);

    if (!desktopRuntime) {
      setConfigLoading(false);
      appendTrace(
        "sync-config-load",
        "warning",
        "Skipped: desktop sync config only available in desktop runtime.",
      );
      return;
    }

    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const result = await invoke<{ url: string; auth_token: string }>(
        "get_sync_config",
      );
      setSyncConfig({
        url: result.url || "",
        authToken: result.auth_token || "",
      });
      appendTrace(
        "sync-config-load",
        "success",
        "Loaded desktop sync config from native keyring.",
      );
    } catch (error) {
      const message = extractUnknownErrorMessage(
        error,
        "Gagal memuat konfigurasi sync desktop",
      );

      if (isDesktopSyncConfigMissingMessage(message)) {
        setSyncConfig({ url: "", authToken: "" });
        setConfigError(null);
        appendTrace(
          "sync-config-load",
          "info",
          "Konfigurasi sync desktop belum diisi. Masukkan URL dan token untuk setup awal.",
        );
      } else {
        setConfigError(message);
        appendTrace("sync-config-load", "error", message);
      }
    } finally {
      setConfigLoading(false);
    }
  }

  useEffect(() => {
    if (syncConfigInitializedRef.current) {
      return;
    }

    syncConfigInitializedRef.current = true;
    if (!desktopRuntime) {
      return;
    }

    setConfigLoading(true);
    setConfigError(null);

    (async () => {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const result = await invoke<{ url: string; auth_token: string }>(
          "get_sync_config",
        );
        setSyncConfig({
          url: result.url || "",
          authToken: result.auth_token || "",
        });
      } catch (error) {
        const message = extractUnknownErrorMessage(
          error,
          "Gagal memuat konfigurasi sync desktop",
        );
        if (isDesktopSyncConfigMissingMessage(message)) {
          setSyncConfig({ url: "", authToken: "" });
          setConfigError(null);
        } else {
          setConfigError(message);
        }
      } finally {
        setConfigLoading(false);
      }
    })();
  }, [desktopRuntime]);

  useEffect(() => {
    if (!desktopRuntime) {
      setDesktopBootstrapEnsureResult(null);
      setDesktopBootstrapConfig(null);
      setDesktopBootstrapHealth(null);
      setDesktopBootstrapError(null);
      return;
    }

    setDesktopBootstrapLoading(true);
    setDesktopBootstrapError(null);

    void ensureDesktopRuntimeBootstrapReady()
      .then((result) => {
        setDesktopBootstrapEnsureResult(result);
        setDesktopBootstrapConfig(result?.config ?? null);
        setDesktopBootstrapHealth(result?.health ?? null);
      })
      .catch((error) => {
        const message = extractUnknownErrorMessage(
          error,
          "Gagal membaca status bootstrap desktop runtime",
        );
        setDesktopBootstrapEnsureResult(null);
        setDesktopBootstrapConfig(null);
        setDesktopBootstrapHealth(null);
        setDesktopBootstrapError(message);
      })
      .finally(() => {
        setDesktopBootstrapLoading(false);
      });
  }, [desktopRuntime]);

  async function saveSyncConfig() {
    if (!desktopRuntime) {
      toast.error("Konfigurasi sync credential hanya tersedia di desktop.");
      appendTrace(
        "sync-config-save",
        "warning",
        "Blocked save: desktop sync credential only.",
      );
      return;
    }

    if (!syncConfig.url.trim() || !syncConfig.authToken.trim()) {
      toast.error("URL dan auth token sync wajib diisi.");
      appendTrace(
        "sync-config-save",
        "warning",
        "Validation failed: sync URL or auth token missing.",
      );
      return;
    }

    appendTrace("sync-config-save", "info", "Saving desktop sync config.");
    setConfigSaving(true);
    setConfigError(null);
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("set_sync_config", {
        request: {
          url: syncConfig.url.trim(),
          auth_token: syncConfig.authToken.trim(),
        },
      });
      appendTrace(
        "sync-config-save",
        "success",
        "Desktop sync config saved to keyring.",
      );
      toast.success("Konfigurasi sync desktop berhasil disimpan ke keyring.");
    } catch (error) {
      const message = extractUnknownErrorMessage(
        error,
        "Gagal menyimpan konfigurasi sync desktop",
      );
      setConfigError(
        `${message}. Simpan ulang konfigurasi native desktop sebelum menjalankan sync.`,
      );
      appendTrace(
        "sync-config-save",
        "warning",
        `Native keyring/file write failed: ${message}. Sync tetap diblok sampai konfigurasi valid tersedia.`,
      );
      toast.warning(
        "Native command gagal. Konfigurasi sync desktop belum siap.",
      );
    } finally {
      setConfigSaving(false);
    }
  }

  async function handleChangePassword() {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("Semua field password wajib diisi.");
      appendTrace(
        "change-password",
        "warning",
        "Validation failed: required password fields missing.",
      );
      return;
    }

    if (isPasswordTooShort) {
      toast.error("Password baru minimal 8 karakter.");
      appendTrace(
        "change-password",
        "warning",
        "Validation failed: new password too short.",
      );
      return;
    }

    if (isPasswordMismatch) {
      toast.error("Konfirmasi password baru tidak cocok.");
      appendTrace(
        "change-password",
        "warning",
        "Validation failed: password confirmation mismatch.",
      );
      return;
    }

    if (isPasswordReuse) {
      toast.error("Password baru tidak boleh sama dengan password saat ini.");
      appendTrace(
        "change-password",
        "warning",
        "Validation failed: new password equals current password.",
      );
      return;
    }

    appendTrace("change-password", "info", "Submitting change password.");
    setChangingPassword(true);
    try {
      const result = await apiPost<{
        changed: true;
        syncStatus?: "synced" | "pending";
        syncMessage?: string;
      }>("/api/auth/change-password", {
        currentPassword,
        newPassword,
        confirmPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");

      if (result.syncStatus === "pending") {
        appendTrace(
          "change-password",
          "warning",
          result.syncMessage ||
            "Password changed locally, but cloud sync is still pending.",
        );
        toast.warning(
          "Password desktop berubah lokal, tetapi sinkronisasi ke cloud masih pending.",
        );
      } else {
        appendTrace(
          "change-password",
          "success",
          result.syncMessage || "Password changed successfully.",
        );
        toast.success("Password berhasil diperbarui.");
      }
    } catch (error) {
      appendTrace(
        "change-password",
        "error",
        extractUnknownErrorMessage(error, "Failed to change password."),
      );
      toast.error(extractUnknownErrorMessage(error, "Gagal mengubah password"));
    } finally {
      setChangingPassword(false);
    }
  }

  async function handleSessionRefresh() {
    appendTrace("session-refresh", "info", "Refreshing session state.");
    setRefreshingSession(true);
    try {
      const refreshed = await refreshSession();
      if (refreshed) {
        const nextRefreshAt = new Date();
        setLastSessionRefreshAt(nextRefreshAt);
        persistLastSessionRefreshAt(nextRefreshAt);
        appendTrace("session-refresh", "success", "Session refreshed.");
        toast.success("Status sesi berhasil diperbarui.");
      } else {
        appendTrace(
          "session-refresh",
          "warning",
          "Session invalid during refresh.",
        );
        toast.warning("Sesi tidak lagi valid. Silakan login ulang.");
      }
      router.refresh();
    } catch {
      appendTrace("session-refresh", "error", "Failed to refresh session.");
      toast.error("Gagal memuat ulang state session.");
    } finally {
      setRefreshingSession(false);
    }
  }

  async function handleLogout() {
    appendTrace("logout", "info", "Logout requested.");
    setLoggingOut(true);
    try {
      await logout();
      appendTrace("logout", "success", "Logout completed.");
    } catch {
      appendTrace("logout", "error", "Logout failed.");
      toast.error("Gagal logout. Coba lagi.");
    } finally {
      if (desktopRuntime && typeof window !== "undefined") {
        window.location.assign("/");
      } else if (desktopRuntime) {
        router.replace("/");
        router.refresh();
      }
      setLoggingOut(false);
    }
  }

  return (
    <div className="min-h-full space-y-10 p-1 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* 🚀 Hero Section */}
      <section className="relative overflow-hidden rounded-[2.5rem] border border-zinc-800/80 bg-zinc-950/40 p-6 shadow-2xl backdrop-blur-md md:p-10 lg:p-12">
        {/* Animated Background Elements */}
        <div className="absolute inset-y-0 right-0 w-full lg:w-1/2">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(99,102,241,0.15),transparent_65%)]" />
          <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-indigo-500/10 blur-[100px]" />
          <div className="absolute top-1/2 -right-48 h-96 w-96 rounded-full bg-violet-500/5 blur-[120px]" />
        </div>
        
        <div className="relative flex flex-col gap-10 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-3xl space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[0.25em] text-indigo-300">
              <Sparkles className="h-3.5 w-3.5" />
              <span>System Control</span>
            </div>
            
            <div className="space-y-4">
              <h1 className="bg-linear-to-r from-white via-indigo-200 to-zinc-500 bg-clip-text text-5xl font-black tracking-tighter text-transparent sm:text-6xl lg:text-7xl">
                Pengaturan
              </h1>
              <p className="max-w-2xl text-base leading-relaxed text-zinc-400 md:text-lg">
                Pusat kendali akun dan preferensi sistem. Konfigurasi sinkronisasi data, keunanan sesi, 
                dan pantau kesehatan runtime EDUCORE Anda dalam satu dasbor terpadu.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-2.5 rounded-2xl border border-indigo-500/20 bg-indigo-500/5 px-4 py-2 text-xs font-bold uppercase tracking-wider text-indigo-300">
                <ShieldCheck className="h-4 w-4" />
                {canManageSettings ? "Otoritas Pengelola" : "Mode Read Only"}
              </div>
              <div className="flex items-center gap-2.5 rounded-2xl border border-zinc-800 bg-zinc-900/40 px-4 py-2 text-xs font-bold uppercase tracking-wider text-zinc-400">
                <Lock className="h-4 w-4" />
                {desktopRuntime ? "Desktop Local" : "Cloud Native"}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-1 lg:w-[240px]">
            {[
              { label: "Runtime", value: desktopRuntime ? "Tauri Active" : "Web Online", icon: RefreshCw },
              { label: "Sync Status", value: lastSyncAt ? "Synced" : "Initial", icon: RefreshCw },
              { label: "Session", value: sessionStatus === "authenticated" ? "Verified" : "Pending", icon: Users },
            ].map((item) => (
              <div 
                key={item.label}
                className="group relative overflow-hidden rounded-2xl border border-zinc-800/50 bg-zinc-900/30 p-4 transition-all hover:border-zinc-700 hover:bg-zinc-900/50"
              >
                <div className="absolute inset-x-0 bottom-0 h-[2px] w-0 bg-indigo-500 transition-all duration-300 group-hover:w-full" />
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600">
                  {item.label}
                </p>
                <p className="mt-1 text-sm font-semibold text-zinc-200">
                  {item.value}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 📊 Settings Content */}
      <div className="grid gap-8 md:grid-cols-2">
        <Card
          className="col-span-2 rounded-[2rem] border-zinc-800/80 bg-zinc-950/40 shadow-2xl backdrop-blur-md text-white"
          data-testid="settings-incident-playbook"
        >
          <CardHeader className="p-8">
            <div className="flex items-center gap-4">
               <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  {incidentLevel === "critical" ? (
                    <Siren className="h-6 w-6" />
                  ) : (
                    <AlertTriangle className="h-6 w-6 text-amber-400" />
                  )}
               </div>
               <div>
                  <CardTitle className="text-xl font-bold tracking-tight">Incident Playbook (Auth/Sync)</CardTitle>
                  <CardDescription className="text-zinc-400">
                    Prosedur pemulihan cepat untuk stabilitas runtime.
                  </CardDescription>
               </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-8 p-8 pt-0">
            {incidentLevel === "critical" ? (
              <InlineState
                title="Status: Kritis"
                description={`Lonjakan error terdeteksi (${recentErrorCount} error/10 menit). Jalankan pemulihan sekarang.`}
                variant="error"
              />
            ) : incidentLevel === "warning" ? (
              <InlineState
                title="Status: Peringatan"
                description={`Risiko pemulihan terdeteksi (${recentRecoveryErrorCount} error sesi).`}
                variant="warning"
              />
            ) : (
              <InlineState
                title="Status: Normal"
                description="Kesehatan sistem terpantau stabil."
                variant="info"
              />
            )}

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-[1.5rem] border border-zinc-800 bg-zinc-900/30 p-6">
                <p className="mb-4 text-xs font-bold uppercase tracking-widest text-zinc-500">Recovery Steps</p>
                <ol className="list-inside list-decimal space-y-2 text-sm text-zinc-300">
                  <li>Jalankan session recovery primer.</li>
                  <li>Inisiasi full sync health check.</li>
                  <li>Bila persisten, lakukan re-login.</li>
                </ol>
              </div>

              <div className="rounded-[1.5rem] border border-zinc-800 bg-zinc-900/30 p-6">
                <p className="mb-4 text-xs font-bold uppercase tracking-widest text-zinc-500">Post-Mortem Logs</p>
                <div className="space-y-1.5 text-xs text-zinc-400">
                  <p>Runtime: {webRuntime ? "Next.js Boundary" : "Tauri Path"}</p>
                  <p>Last escalation: {formattedLastIncidentEscalationAt}</p>
                </div>
              </div>
            </div>

            <div className="rounded-[1.5rem] border border-zinc-800 bg-zinc-900/20 p-6">
              <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">Telemetry (24h)</span>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 rounded-xl border border-zinc-800 bg-zinc-900/50 text-xs font-bold text-zinc-400"
                  disabled={telemetrySummaryLoading}
                  onClick={() => {
                    void loadTelemetrySummary();
                  }}
                >
                  <RefreshCw className={cn("mr-2 h-3 w-3", telemetrySummaryLoading && "animate-spin")} />
                  Refresh Stats
                </Button>
              </div>
              
              {telemetrySummaryError ? (
                <p className="text-sm text-red-300">{telemetrySummaryError}</p>
              ) : telemetrySummary ? (
                <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                  {[
                    { label: "Events", value: telemetrySummary.totalEvents },
                    { label: "Errors", value: telemetrySummary.totalErrors },
                    { label: "Escalations", value: telemetrySummary.totalEscalations },
                    { label: "Web/Desktop", value: `${telemetrySummary.runtimeBreakdown.web}/${telemetrySummary.runtimeBreakdown.desktop}` },
                  ].map(stat => (
                    <div key={stat.label}>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">{stat.label}</p>
                      <p className="text-lg font-black text-white">{stat.value}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-zinc-500">Belum ada rangkuman telemetry.</p>
              )}
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                variant="outline"
                className="h-12 rounded-2xl border-zinc-800 bg-zinc-900/50 px-6 font-bold text-zinc-300 hover:bg-zinc-800"
                disabled={runningIncidentAction !== null}
                onClick={() => {
                  void runIncidentRecovery();
                }}
              >
                <RefreshCw className={cn("mr-2 h-4 w-4", runningIncidentAction === "recovery" && "animate-spin")} />
                Session Recovery
              </Button>
              <Button
                variant="outline"
                className="h-12 rounded-2xl border-zinc-800 bg-zinc-900/50 px-6 font-bold text-zinc-300 hover:bg-zinc-800"
                disabled={runningIncidentAction !== null}
                onClick={() => {
                  setRunningIncidentAction("sync");
                  void runSync("full").finally(() => {
                    setRunningIncidentAction(null);
                  });
                }}
              >
                <Cloud className={cn("mr-2 h-4 w-4", runningIncidentAction === "sync" && "animate-spin")} />
                Sync Health Check
              </Button>
              <Button
                variant="ghost"
                className="h-12 rounded-2xl border border-zinc-800 bg-zinc-900/30 px-6 font-bold text-zinc-400 hover:bg-zinc-800 hover:text-white"
                onClick={() => {
                  void copyTraceReport();
                }}
                disabled={traceEvents.length === 0}
              >
                <ClipboardCopy className="mr-2 h-4 w-4" />
                Copy Report
              </Button>
              <Button
                className="h-12 rounded-2xl bg-rose-600 px-6 font-bold text-white hover:bg-rose-500 shadow-[0_0_15px_rgba(225,29,72,0.2)] ml-auto"
                onClick={() => {
                  void handleLogout();
                }}
                disabled={loggingOut}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Force Logout
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-2 rounded-[2rem] border-zinc-800/80 bg-zinc-950/40 shadow-2xl backdrop-blur-md text-white">
          <CardHeader className="p-8">
            <div className="flex items-center gap-4">
               <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
                  <ShieldCheck className="h-6 w-6" />
               </div>
               <div>
                  <CardTitle className="text-xl font-bold tracking-tight">Status Session & Akun Aktif</CardTitle>
                  <CardDescription className="text-zinc-400">
                    Source of truth auth/session runtime saat ini.
                  </CardDescription>
               </div>
            </div>
          </CardHeader>
          <CardContent className="p-8 pt-0 space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { label: "Session Status", value: isLoading ? "loading" : sessionStatus, color: "text-emerald-400" },
                { label: "Auth Source", value: authSource.replace("-", " "), color: "text-sky-400" },
                { label: "Active Role", value: userRole || "-", color: "text-violet-400" },
                { label: "Active User", value: maskEmail(userEmail) || "-", color: "text-zinc-300" },
              ].map(stat => (
                <div key={stat.label} className="rounded-2xl border border-zinc-800/50 bg-zinc-900/30 p-4 transition-all hover:bg-zinc-900/50">
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-600 mb-1">{stat.label}</p>
                  <p className={cn("text-sm font-bold truncate", stat.color)}>{stat.value}</p>
                </div>
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
               <div className="flex flex-col gap-1 rounded-2xl border border-zinc-800 bg-zinc-900/10 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Last Session Refresh</p>
                  <p className="text-sm font-medium text-zinc-200">{formattedLastSessionRefreshAt}</p>
               </div>
               <div className="flex flex-col gap-1 rounded-2xl border border-zinc-800 bg-zinc-900/10 p-4">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-600">Last Sync Success</p>
                  <p className="text-sm font-medium text-zinc-200">{formattedLastSyncAt}</p>
               </div>
            </div>

            {hasSessionMismatch ? (
              <InlineState
                title="Status sesi dan state client tidak sinkron"
                description="Terdeteksi perbedaan pada runtime web. Muat ulang sesi untuk memvalidasi ulang."
                variant="warning"
                actionLabel="Muat Ulang Sesi"
                onAction={() => {
                  void handleSessionRefresh();
                }}
              />
            ) : (
              <InlineState
                title="Status autentikasi sinkron"
                description="Tidak ada perbedaan antara sesi dan state client."
                variant="info"
              />
            )}

            <div className="flex flex-wrap gap-3 pt-4 border-t border-zinc-800/50">
              <Button
                variant="outline"
                className="h-11 rounded-xl border-zinc-800 bg-zinc-900/50 px-6 font-bold text-zinc-300 hover:bg-zinc-800"
                disabled={refreshingSession}
                onClick={() => {
                  void handleSessionRefresh();
                }}
              >
                <RefreshCw className={cn("mr-2 h-4 w-4", refreshingSession && "animate-spin")} />
                Refresh Session
              </Button>
              <Button
                className="h-11 rounded-xl bg-rose-600 px-6 font-bold text-white hover:bg-rose-500"
                disabled={loggingOut}
                onClick={() => {
                  void handleLogout();
                }}
              >
                <LogOut className="mr-2 h-4 w-4" />
                Dikonfigurasi Logout
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-2 rounded-[2rem] border-zinc-800/80 bg-zinc-950/40 shadow-2xl backdrop-blur-md text-white">
          <CardHeader className="p-8">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
                <Cloud className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold tracking-tight">Sinkronisasi Cloud (Turso)</CardTitle>
                <CardDescription className="text-zinc-400">
                  Data bridging EDUCORE via /api/sync atau local sync line.
                </CardDescription>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-8 pt-0 space-y-8">
            {canManageSettings ? (
              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={() => {
                    void runSync("full");
                  }}
                  disabled={isSyncing}
                  className="h-12 rounded-2xl bg-blue-600 px-6 font-bold hover:bg-blue-500"
                >
                  <RefreshCw className={cn("mr-2 h-4 w-4", syncAction === "full" && "animate-spin")} />
                  Sinkron Penuh
                </Button>

                <Button
                  onClick={() => {
                    void runSync("push");
                  }}
                  disabled={isSyncing || webRuntime}
                  variant="outline"
                  className="h-12 rounded-2xl border-zinc-800 bg-zinc-900/50 px-6 font-bold text-zinc-300 hover:bg-zinc-800"
                >
                  <CloudUpload className={cn("mr-2 h-4 w-4", syncAction === "push" && "animate-spin")} />
                  Push Sync
                </Button>

                <Button
                  onClick={() => {
                    void runSync("pull");
                  }}
                  disabled={isSyncing || webRuntime}
                  variant="outline"
                  className="h-12 rounded-2xl border-zinc-800 bg-zinc-900/50 px-6 font-bold text-zinc-300 hover:bg-zinc-800"
                >
                  <CloudDownload className={cn("mr-2 h-4 w-4", syncAction === "pull" && "animate-spin")} />
                  Pull Sync
                </Button>
              </div>
            ) : (
              <InlineState
                title="Sinkronisasi terkunci"
                description="Role aktif tidak memiliki izin manajemen."
                variant="info"
              />
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-blue-500/10 bg-blue-500/5 p-4 text-xs text-blue-300/80">
                <p className="font-bold uppercase tracking-widest mb-1 opacity-50">Runtime Focus</p>
                {webRuntime ? "Web Safe Boundary Active" : "Desktop Local Line Active"}
              </div>
              <div className="rounded-2xl border border-blue-500/10 bg-blue-500/5 p-4 text-xs text-blue-300/80">
                <p className="font-bold uppercase tracking-widest mb-1 opacity-50">Sync Protocol</p>
                {webRuntime ? "REST over HTTPS" : "Direct SQLite Sync"}
              </div>
            </div>

            {desktopRuntime && (
              <div className="rounded-[1.5rem] border border-zinc-800 bg-zinc-900/30 p-6 space-y-4">
                 <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-zinc-200">Bootstrap Manager Status</p>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-9 rounded-xl border border-zinc-800 bg-zinc-900/50 text-xs font-bold text-zinc-400"
                      disabled={desktopBootstrapLoading}
                      onClick={() => {
                        setDesktopBootstrapLoading(true);
                        setDesktopBootstrapError(null);
                        void ensureDesktopRuntimeBootstrapReady()
                          .then((result) => {
                            setDesktopBootstrapEnsureResult(result);
                            setDesktopBootstrapConfig(result?.config ?? null);
                            setDesktopBootstrapHealth(result?.health ?? null);
                          })
                          .catch((error) => {
                            const message = extractUnknownErrorMessage(error, "Gagal bootstrap desktop");
                            setDesktopBootstrapEnsureResult(null);
                            setDesktopBootstrapConfig(null);
                            setDesktopBootstrapHealth(null);
                            setDesktopBootstrapError(message);
                          })
                          .finally(() => setDesktopBootstrapLoading(false));
                      }}
                    >
                      <RefreshCw className={cn("mr-2 h-3.5 w-3.5", desktopBootstrapLoading && "animate-spin")} />
                      Re-Bootstrap
                    </Button>
                 </div>
                 <InlineState
                    title={desktopBootstrapHealth?.ok ? "Runtime Siap" : "Pemeriksaan Bootstrap"}
                    description={desktopBootstrapError || desktopBootstrapHealth?.message || "Cek status bootstrap layanan lokal."}
                    variant={desktopBootstrapHealth?.ok ? "info" : "warning"}
                    className="text-xs"
                 />
              </div>
            )}

            {syncError && (
              <InlineState
                title="Kegagalan Sinkronisasi"
                description={syncError}
                variant="error"
              />
            )}

            {lastResult && (
              <div className={cn(
                "rounded-2xl border p-4 transition-all animate-in zoom-in-95",
                lastResult.status === "success" ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-400" : "border-rose-500/20 bg-rose-500/5 text-rose-400"
              )}>
                <div className="flex items-center gap-3">
                  {lastResult.status === "success" ? <CheckCircle className="h-5 w-5" /> : <XCircle className="h-5 w-5" />}
                  <span className="text-sm font-bold tracking-tight">{lastResult.message}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-zinc-800 bg-zinc-900 text-white">
          <CardHeader>
            <CardTitle>Info Aplikasi</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-zinc-400">Versi</span>
              <span className="font-mono">1.0.0</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Database</span>
              <span className="font-mono">
                {desktopRuntime ? "SQLite (Local)" : "Turso (Cloud)"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Jalur Sync</span>
              <span className="font-mono text-blue-400">
                {desktopRuntime ? "Jalur Desktop" : "/api/sync/*"}
              </span>
            </div>
            {desktopRuntime ? (
              <>
                <div className="flex justify-between gap-3">
                  <span className="text-zinc-400">Bootstrap Strategy</span>
                  <span className="truncate text-right font-mono text-zinc-100">
                    {desktopBootstrapConfig?.strategy ||
                      "embedded-local-web-server"}
                  </span>
                </div>
                <div className="flex justify-between gap-3">
                  <span className="text-zinc-400">Bootstrap Health</span>
                  <span
                    className={
                      desktopBootstrapHealth?.ok
                        ? "font-mono text-emerald-400"
                        : "font-mono text-amber-300"
                    }
                  >
                    {desktopBootstrapLoading
                      ? "checking"
                      : desktopBootstrapHealth?.ok
                        ? "reachable"
                        : "not-ready"}
                  </span>
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-zinc-800 bg-zinc-900 text-white">
          <CardHeader>
            <CardTitle>Data Diri Akun</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-zinc-400">Role</span>
              <Badge variant="secondary" className="bg-zinc-800 text-zinc-100">
                {user?.role || "-"}
              </Badge>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-zinc-400">Email Login</span>
              <span className="truncate text-right font-mono text-zinc-100">
                {user?.email || "-"}
              </span>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-400">
              Password tidak ditampilkan karena tersimpan dalam hash. Gunakan
              form ganti password untuk memperbarui.
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-2 rounded-[2rem] border-zinc-800/80 bg-zinc-950/40 shadow-2xl backdrop-blur-md text-white">
          <CardHeader className="p-8">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                <Lock className="h-6 w-6" />
              </div>
              <div>
                <CardTitle className="text-xl font-bold tracking-tight">Data Diri & Keamanan Akun</CardTitle>
                <CardDescription className="text-zinc-400">
                  Detail kredensial dan pembaruan akses login.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-8 pt-0 space-y-10">
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-4">
                 <p className="text-xs font-bold uppercase tracking-widest text-zinc-600">Active Profile</p>
                 <div className="space-y-2">
                    <div className="flex items-center justify-between px-4 py-3 rounded-xl border border-zinc-800 bg-zinc-900/30">
                       <span className="text-xs text-zinc-400">Role</span>
                       <Badge variant="secondary" className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20 font-bold uppercase text-[10px]">
                          {user?.role || "-"}
                       </Badge>
                    </div>
                    <div className="flex flex-col gap-1 px-4 py-3 rounded-xl border border-zinc-800 bg-zinc-900/30 overflow-hidden text-ellipsis">
                       <span className="text-xs text-zinc-400">Email</span>
                       <span className="text-xs font-mono text-white truncate">{userEmail || "-"}</span>
                    </div>
                 </div>
              </div>

              <div className="space-y-4">
                 <p className="text-xs font-bold uppercase tracking-widest text-zinc-600">Runtime Info</p>
                 <div className="space-y-2">
                    <div className="flex items-center justify-between px-4 py-3 rounded-xl border border-zinc-800 bg-zinc-900/30">
                       <span className="text-xs text-zinc-400">Environment</span>
                       <span className="text-xs font-bold text-zinc-200">{desktopRuntime ? "Tauri Native" : "Web Engine"}</span>
                    </div>
                    <div className="flex items-center justify-between px-4 py-3 rounded-xl border border-zinc-800 bg-zinc-900/30">
                       <span className="text-xs text-zinc-400">DB Layer</span>
                       <span className="text-xs font-mono text-sky-400">{desktopRuntime ? "SQLite" : "Turso Cloud"}</span>
                    </div>
                 </div>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-5 flex flex-col justify-center items-center text-center gap-3">
                 <div className="h-10 w-10 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
                    <ShieldCheck className="h-5 w-5 text-emerald-400" />
                 </div>
                 <p className="text-[10px] text-zinc-500 leading-relaxed italic">"Kredensial Anda dienkripsi secara aman sebelum dikirim ke server."</p>
              </div>
            </div>

            <div className="pt-8 border-t border-zinc-800/50">
               <div className="mb-6">
                  <h3 className="text-lg font-bold text-white tracking-tight">Ganti Password</h3>
                  <p className="text-sm text-zinc-500">Perbarui kata sandi untuk keamanan akun berkala.</p>
               </div>
               
               <div className="grid gap-6 md:grid-cols-2 max-w-4xl">
                  <div className="space-y-2 md:col-span-2">
                    <Label className="text-xs font-bold uppercase tracking-widest text-zinc-600 ml-1">Password Saat Ini</Label>
                    <Input
                      type="password"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      className="h-12 rounded-xl border-zinc-800 bg-zinc-900/50 focus:border-indigo-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-widest text-zinc-600 ml-1">Password Baru</Label>
                    <Input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="h-12 rounded-xl border-zinc-800 bg-zinc-900/50 focus:border-indigo-500"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs font-bold uppercase tracking-widest text-zinc-600 ml-1">Konfirmasi Password</Label>
                    <Input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="h-12 rounded-xl border-zinc-800 bg-zinc-900/50 focus:border-indigo-500"
                    />
                  </div>
                  
                  {(isPasswordTooShort || isPasswordMismatch || isPasswordReuse) && (
                    <div className="md:col-span-2 space-y-2">
                      {isPasswordTooShort && <InlineState title="Password Terlalu Pendek" description="Minimal 8 karakter." variant="warning" />}
                      {isPasswordMismatch && <InlineState title="Password Tidak Cocok" description="Konfirmasi harus sama." variant="warning" />}
                      {isPasswordReuse && <InlineState title="Password Sama" description="Gunakan password yang berbeda." variant="warning" />}
                    </div>
                  )}

                  <div className="md:col-span-2 pt-4">
                     <Button
                        className="h-12 rounded-2xl bg-indigo-600 px-8 font-bold text-white hover:bg-indigo-500 shadow-[0_0_20px_rgba(79,70,229,0.2)]"
                        onClick={() => void handleChangePassword()}
                        disabled={changingPassword || isPasswordMismatch || isPasswordTooShort || !currentPassword}
                      >
                        {changingPassword ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                        Perbarui Kredensial
                      </Button>
                  </div>
               </div>
            </div>

            {!webRuntime && canManageSettings && (
               <div className="pt-10 border-t border-zinc-800/50">
                  <div className="flex items-center gap-3 mb-6">
                    <Cloud className="h-5 w-5 text-sky-400" />
                    <h3 className="text-lg font-bold text-white tracking-tight">Kredensial Sinkronisasi Desktop</h3>
                  </div>
                  <div className="grid gap-6 max-w-4xl">
                     <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-2">
                           <Label className="text-xs font-bold uppercase tracking-widest text-zinc-600 ml-1">Sync URL</Label>
                           <Input
                             value={syncConfig.url}
                             onChange={(e) => setSyncConfig(p => ({ ...p, url: e.target.value }))}
                             placeholder="https://xxxx.turso.io"
                             className="h-11 rounded-xl border-zinc-800 bg-zinc-900/50"
                           />
                        </div>
                        <div className="space-y-2">
                           <Label className="text-xs font-bold uppercase tracking-widest text-zinc-600 ml-1">Auth Token</Label>
                           <Input
                             type="password"
                             value={syncConfig.authToken}
                             onChange={(e) => setSyncConfig(p => ({ ...p, authToken: e.target.value }))}
                             placeholder="eyJ..."
                             className="h-11 rounded-xl border-zinc-800 bg-zinc-900/50"
                           />
                        </div>
                     </div>
                     <div className="flex gap-2">
                        <Button variant="ghost" className="h-10 rounded-xl border border-zinc-800 bg-zinc-900/30 px-6 font-bold text-zinc-400 hover:text-white" onClick={() => void loadSyncConfig()}>
                           Muat Ulang
                        </Button>
                        <Button className="h-10 rounded-xl bg-sky-600 px-6 font-bold text-white hover:bg-sky-500" onClick={() => void saveSyncConfig()} disabled={configSaving}>
                           {configSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Simpan Keyring"}
                        </Button>
                     </div>
                  </div>
               </div>
            )}
          </CardContent>
        </Card>

        <Card className="col-span-2 rounded-[2rem] border-zinc-800/80 bg-zinc-950/40 shadow-2xl backdrop-blur-md text-white">
          <CardHeader className="p-8 flex flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
               <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-800/50 text-zinc-400 border border-zinc-800">
                  <Filter className="h-6 w-6" />
               </div>
               <div>
                  <CardTitle className="text-xl font-bold tracking-tight">Jejak Event Auth/Sync</CardTitle>
                  <CardDescription className="text-zinc-400">
                    Investigasi audit lintas runtime EDUCORE.
                  </CardDescription>
               </div>
            </div>
            <div className="hidden lg:flex items-center gap-2">
               <Button
                variant="outline"
                className="h-10 rounded-xl border-zinc-800 bg-zinc-900/50 text-xs font-bold text-zinc-400 hover:bg-zinc-800"
                onClick={() => {
                  setShowErrorTraceOnly((prev) => !prev);
                }}
                disabled={traceEvents.length === 0}
              >
                <Filter className="mr-2 h-3.5 w-3.5" />
                {showErrorTraceOnly ? "Lihat Semua" : "Hanya Error"}
              </Button>
              <Button
                variant="outline"
                className="h-10 rounded-xl border-zinc-800 bg-zinc-900/50 text-xs font-bold text-zinc-400 hover:border-rose-500/20 hover:text-rose-400"
                onClick={() => {
                  clearTraceEvents();
                }}
                disabled={traceEvents.length === 0}
              >
                <Trash2 className="mr-2 h-3.5 w-3.5" />
                Clear Logs
              </Button>
              <Button
                variant="ghost"
                className="h-10 rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 text-xs font-bold text-zinc-300 hover:bg-zinc-800"
                onClick={() => {
                  void copyTraceReport();
                }}
                disabled={traceEvents.length === 0}
              >
                <ClipboardCopy className="mr-2 h-3.5 w-3.5" />
                Copy JSON
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-8 pt-0">
            {hasRecentErrorBurst && (
               <InlineState
                title="Peringatan Lonjakan Error"
                description={`Terdeteksi ${recentErrorCount} kegagalan dalam jendela 10 menit.`}
                variant="warning"
                className="mb-8"
              />
            )}
            
            {visibleTraceEvents.length === 0 ? (
              <div className="py-20 text-center rounded-[1.5rem] border border-dashed border-zinc-800 bg-zinc-950/20">
                 <p className="text-sm font-bold text-zinc-600 uppercase tracking-widest">
                  {showErrorTraceOnly ? "No Error Entries Found" : "Historical Log is Empty"}
                 </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                {visibleTraceEvents.map((event) => (
                  <div
                    key={event.id}
                    className="group relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/20 p-4 transition-all hover:bg-zinc-900/40"
                  >
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                       <span className={cn(
                          "px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest",
                          event.status === "success" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : 
                          event.status === "error" ? "bg-rose-500/10 text-rose-400 border border-rose-500/20" : 
                          "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                       )}>
                          {event.action}
                       </span>
                       <span className="text-[10px] font-mono text-zinc-500">{new Date(event.at).toLocaleTimeString()}</span>
                       <span className="text-[10px] font-bold text-zinc-600 ml-auto uppercase tracking-tighter">{event.runtime}</span>
                    </div>
                    <p className="text-sm text-zinc-300 leading-relaxed font-medium">{event.detail}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
