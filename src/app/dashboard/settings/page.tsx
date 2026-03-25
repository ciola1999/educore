"use client";

import {
  AlertTriangle,
  BellRing,
  CheckCircle,
  ClipboardCopy,
  Cloud,
  CloudDownload,
  CloudUpload,
  Download,
  Filter,
  Loader2,
  LogOut,
  RefreshCw,
  ShieldCheck,
  ShieldMinus,
  ShieldOff,
  Siren,
  Trash2,
  XCircle,
} from "lucide-react";
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
import { runFullSync, runPullSync, runPushSync } from "@/lib/sync/actions";
import type { SyncResult } from "@/lib/sync/client";
import {
  readDesktopSyncStorageConfig,
  writeDesktopSyncStorageConfig,
} from "@/lib/sync/storage";
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

const dashboardOutlineButtonClass = outlineButtonStyles.neutral;
const TRACE_STORAGE_KEY = "settings-auth-trace-v1";
const TRACE_RETENTION_MS = 24 * 60 * 60 * 1000;
const TRACE_STORAGE_LIMIT = 100;
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
  const formattedLastSyncAt = lastSyncAt ? lastSyncAt.toLocaleString() : "-";
  const formattedLastSessionRefreshAt = lastSessionRefreshAt
    ? lastSessionRefreshAt.toLocaleString()
    : "-";
  const visibleTraceEvents = showErrorTraceOnly
    ? traceEvents.filter((event) => event.status === "error")
    : traceEvents;
  const recentErrorCount = traceEvents.filter((event) => {
    if (event.status !== "error") {
      return false;
    }
    const eventAt = new Date(event.at).getTime();
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
    return eventAt >= tenMinutesAgo;
  }).length;
  const hasRecentErrorBurst = recentErrorCount >= 3;
  const recentRecoveryErrorCount = traceEvents.filter((event) => {
    if (event.status !== "error") {
      return false;
    }
    if (event.action !== "session-refresh" && event.action !== "logout") {
      return false;
    }
    const eventAt = new Date(event.at).getTime();
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
    return eventAt >= tenMinutesAgo;
  }).length;
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
        setLastSessionRefreshAt(new Date());
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
      toast.success("Debug report berhasil disalin.");
      appendTrace(
        "session-refresh",
        "info",
        "Debug report copied to clipboard.",
      );
    } catch {
      toast.error("Gagal menyalin debug report.");
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
      toast.success("Trace report berhasil diekspor.");
      appendTrace(
        "session-refresh",
        "success",
        "Trace report exported to local JSON file.",
      );
    } catch (error) {
      toast.error("Gagal mengekspor trace report.");
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
    toast.success("Trace event berhasil dibersihkan.");
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
  }, [user?.id]);

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

    const fallback = readDesktopSyncStorageConfig();
    if (fallback) {
      setSyncConfig({
        url: fallback.url,
        authToken: fallback.authToken,
      });
    }

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
      if (!fallback) {
        const message =
          error instanceof Error
            ? error.message
            : "Gagal memuat konfigurasi sync desktop";
        setConfigError(message);
        appendTrace("sync-config-load", "error", message);
      } else {
        appendTrace(
          "sync-config-load",
          "warning",
          "Native keyring read failed, using local fallback.",
        );
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

    const fallback = readDesktopSyncStorageConfig();
    if (fallback) {
      setSyncConfig({
        url: fallback.url,
        authToken: fallback.authToken,
      });
    }

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
        if (!fallback) {
          const message =
            error instanceof Error
              ? error.message
              : "Gagal memuat konfigurasi sync desktop";
          setConfigError(message);
        }
      } finally {
        setConfigLoading(false);
      }
    })();
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
      writeDesktopSyncStorageConfig({
        url: syncConfig.url.trim(),
        authToken: syncConfig.authToken.trim(),
      });

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
      const message =
        error instanceof Error
          ? error.message
          : "Gagal menyimpan konfigurasi sync desktop";
      setConfigError(
        `${message}. Fallback lokal desktop tetap tersimpan dan akan dipakai saat sync.`,
      );
      appendTrace(
        "sync-config-save",
        "warning",
        `Native keyring write failed: ${message}. Local fallback active.`,
      );
      toast.warning(
        "Native command gagal, fallback lokal desktop tetap tersimpan.",
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
      await apiPost<{ changed: true }>("/api/auth/change-password", {
        currentPassword,
        newPassword,
        confirmPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      appendTrace(
        "change-password",
        "success",
        "Password changed successfully.",
      );
      toast.success("Password berhasil diperbarui.");
    } catch (error) {
      appendTrace(
        "change-password",
        "error",
        error instanceof Error ? error.message : "Failed to change password.",
      );
      toast.error(
        error instanceof Error ? error.message : "Gagal mengubah password",
      );
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
        setLastSessionRefreshAt(new Date());
        appendTrace("session-refresh", "success", "Session refreshed.");
        toast.success("State session berhasil diperbarui.");
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
      if (typeof window !== "undefined") {
        window.location.assign("/");
      } else {
        router.replace("/");
        router.refresh();
      }
      setLoggingOut(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="bg-linear-to-r from-gray-300 to-gray-500 bg-clip-text text-3xl font-bold tracking-tight text-transparent">
          <span data-testid="settings-page-title">Pengaturan</span>
        </h2>
        <p className="mt-1 text-zinc-400">
          {canManageSettings
            ? "Kelola pengaturan akun dan sinkronisasi runtime."
            : "Mode read-only aktif untuk role ini. Aksi manajemen disembunyikan."}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-zinc-700 bg-zinc-900/40 p-5">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-zinc-300" />
            <div>
              <p className="text-sm font-semibold text-white">Runtime Aktif</p>
              <p className="text-sm text-zinc-400">
                {runtime === "desktop"
                  ? "Desktop/Tauri (offline-first)"
                  : "Web/Next.js (online)"}
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-sky-500/20 bg-sky-500/5 p-5">
          <div className="flex items-center gap-3">
            {canManageSettings ? (
              <ShieldCheck className="h-5 w-5 text-sky-300" />
            ) : (
              <ShieldMinus className="h-5 w-5 text-sky-300" />
            )}
            <div>
              <p className="text-sm font-semibold text-sky-200">
                {canManageSettings ? "Akses Manajemen Aktif" : "Mode Read Only"}
              </p>
              <p className="text-sm text-sky-100/80">
                {canManageSettings
                  ? "Aksi sinkronisasi dan pengelolaan credential desktop tersedia."
                  : "Role aktif tidak memiliki permission settings:manage."}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card
          className="col-span-2 border-zinc-800 bg-zinc-900 text-white"
          data-testid="settings-incident-playbook"
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {incidentLevel === "critical" ? (
                <Siren className="h-5 w-5 text-red-400" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-amber-400" />
              )}
              Incident Playbook (Auth/Sync)
            </CardTitle>
            <CardDescription className="text-zinc-400">
              Prosedur pemulihan cepat ketika auth/session/sync mulai tidak
              stabil pada runtime aktif.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {incidentLevel === "critical" ? (
              <InlineState
                title="Status: Critical"
                description={`Error burst terdeteksi (${recentErrorCount} error/10 menit). Jalankan recovery sekarang dan kirim incident report.`}
                variant="error"
              />
            ) : incidentLevel === "warning" ? (
              <InlineState
                title="Status: Warning"
                description={`Recovery risk terdeteksi (${recentRecoveryErrorCount} error session-refresh/logout). Disarankan jalankan langkah pemulihan.`}
                variant="warning"
              />
            ) : (
              <InlineState
                title="Status: Normal"
                description="Belum ada sinyal anomali signifikan. Playbook tetap siap jika dibutuhkan."
                variant="info"
              />
            )}

            <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-4 text-sm text-zinc-200">
              <p className="mb-2 font-medium text-zinc-100">
                Langkah Recovery Disarankan:
              </p>
              <ol className="list-inside list-decimal space-y-1 text-zinc-300">
                <li>Jalankan session recovery.</li>
                <li>Jalankan full sync health check.</li>
                <li>Jika gagal berulang, logout lalu login ulang.</li>
                <li>Kirim incident report untuk investigasi lanjutan.</li>
              </ol>
            </div>

            <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-4 text-xs text-zinc-400">
              Runtime guide:
              {webRuntime
                ? " Web menggunakan boundary /api/sync/*, jadi fokus cek session + API response."
                : " Desktop menggunakan local sync path + keyring, jadi cek credential desktop dan status keyring."}
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-4 text-xs text-zinc-400">
              Last escalation ping: {formattedLastIncidentEscalationAt}
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-4 text-xs text-zinc-300">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-medium text-zinc-100">
                  Incident Summary (24h)
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className={dashboardOutlineButtonClass}
                  disabled={telemetrySummaryLoading}
                  onClick={() => {
                    void loadTelemetrySummary();
                  }}
                >
                  {telemetrySummaryLoading ? (
                    <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-3.5 w-3.5" />
                  )}
                  Refresh
                </Button>
              </div>
              {telemetrySummaryError ? (
                <p className="text-red-300">{telemetrySummaryError}</p>
              ) : telemetrySummary ? (
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  <p>Total events: {telemetrySummary.totalEvents}</p>
                  <p>Total errors: {telemetrySummary.totalErrors}</p>
                  <p>Total warnings: {telemetrySummary.totalWarnings}</p>
                  <p>Total escalations: {telemetrySummary.totalEscalations}</p>
                  <p>Web events: {telemetrySummary.runtimeBreakdown.web}</p>
                  <p>
                    Desktop events: {telemetrySummary.runtimeBreakdown.desktop}
                  </p>
                </div>
              ) : (
                <p className="text-zinc-400">
                  Belum ada data incident summary.
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                className={dashboardOutlineButtonClass}
                disabled={runningIncidentAction !== null}
                onClick={() => {
                  void runIncidentRecovery();
                }}
              >
                {runningIncidentAction === "recovery" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Run Recovery
              </Button>
              <Button
                variant="outline"
                className={dashboardOutlineButtonClass}
                disabled={runningIncidentAction !== null}
                onClick={() => {
                  setRunningIncidentAction("sync");
                  void runSync("full").finally(() => {
                    setRunningIncidentAction(null);
                  });
                }}
              >
                {runningIncidentAction === "sync" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Cloud className="mr-2 h-4 w-4" />
                )}
                Full Sync Check
              </Button>
              <Button
                variant="outline"
                className={dashboardOutlineButtonClass}
                onClick={() => {
                  void copyTraceReport();
                }}
                disabled={traceEvents.length === 0}
              >
                <ClipboardCopy className="mr-2 h-4 w-4" />
                Copy Incident Report
              </Button>
              <Button
                variant="outline"
                className={dashboardOutlineButtonClass}
                onClick={() => {
                  const level = hasRecentErrorBurst ? "critical" : "warning";
                  const escalated = emitIncidentEscalation({
                    source: "manual",
                    level,
                  });
                  if (escalated) {
                    appendTrace(
                      "session-refresh",
                      level === "critical" ? "error" : "warning",
                      `Incident escalation emitted (${level}, manual).`,
                    );
                    toast.success("Incident escalation ping terkirim.");
                  } else {
                    toast.warning(
                      "Escalation cooldown aktif. Coba lagi beberapa menit.",
                    );
                  }
                }}
                disabled={incidentLevel === "normal"}
              >
                <BellRing className="mr-2 h-4 w-4" />
                Trigger Escalation
              </Button>
              <Button
                className="bg-red-600 hover:bg-red-500"
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

        <Card className="col-span-2 border-zinc-800 bg-zinc-900 text-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-blue-400" />
              Status Session & Akun Aktif
            </CardTitle>
            <CardDescription className="text-zinc-400">
              Menampilkan source of truth auth/session untuk runtime saat ini.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
                <p className="text-xs uppercase tracking-wide text-zinc-500">
                  Session Status
                </p>
                <p className="mt-1 font-medium text-zinc-100">
                  {isLoading ? "loading" : sessionStatus}
                </p>
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
                <p className="text-xs uppercase tracking-wide text-zinc-500">
                  Auth Source
                </p>
                <p
                  className="mt-1 font-medium text-zinc-100"
                  data-testid="settings-auth-source"
                >
                  {authSource}
                </p>
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
                <p className="text-xs uppercase tracking-wide text-zinc-500">
                  Role Aktif
                </p>
                <p
                  className="mt-1 font-medium text-zinc-100"
                  data-testid="settings-active-role"
                >
                  {userRole || "-"}
                </p>
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
                <p className="text-xs uppercase tracking-wide text-zinc-500">
                  Email Aktif
                </p>
                <p
                  className="mt-1 truncate font-mono text-xs text-zinc-100"
                  data-testid="settings-active-email"
                >
                  {userEmail || "-"}
                </p>
              </div>
            </div>
            <div className="grid gap-2 text-sm sm:grid-cols-2">
              <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
                <p className="text-xs uppercase tracking-wide text-zinc-500">
                  Last Session Refresh
                </p>
                <p
                  className="mt-1 text-zinc-100"
                  data-testid="settings-last-session-refresh"
                >
                  {formattedLastSessionRefreshAt}
                </p>
              </div>
              <div className="rounded-lg border border-zinc-800 bg-zinc-950/50 p-3">
                <p className="text-xs uppercase tracking-wide text-zinc-500">
                  Last Sync Success
                </p>
                <p className="mt-1 text-zinc-100">{formattedLastSyncAt}</p>
              </div>
            </div>

            {hasSessionMismatch ? (
              <InlineState
                title="State session dan state client tidak sinkron"
                description="Deteksi mismatch pada runtime web. Muat ulang sesi untuk revalidasi source of truth dari NextAuth."
                variant="warning"
                actionLabel="Muat Ulang Session"
                onAction={() => {
                  void handleSessionRefresh();
                }}
              />
            ) : (
              <InlineState
                title="State auth sinkron"
                description="Tidak ada mismatch role/email antara session dan state client."
                variant="info"
                className="text-sm"
              />
            )}
            {hasRecoveryRisk ? (
              <InlineState
                title="Risiko kegagalan pemulihan sesi terdeteksi"
                description={`Terdapat ${recentRecoveryErrorCount} kegagalan session-refresh/logout dalam 10 menit terakhir. Rekomendasi: logout ulang, login kembali, lalu jalankan refresh session.`}
                variant="warning"
                className="text-sm"
              />
            ) : null}

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={refreshingSession}
                data-testid="settings-refresh-session"
                onClick={() => {
                  void handleSessionRefresh();
                }}
                className={dashboardOutlineButtonClass}
              >
                {refreshingSession ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                Refresh Session
              </Button>
              <Button
                disabled={loggingOut}
                data-testid="settings-logout-button"
                onClick={() => {
                  void handleLogout();
                }}
                className="bg-red-600 hover:bg-red-500"
              >
                {loggingOut ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <LogOut className="mr-2 h-4 w-4" />
                )}
                Logout
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-2 border-zinc-800 bg-zinc-900 text-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cloud className="h-5 w-5 text-blue-400" />
              Sinkronisasi Cloud (Turso)
            </CardTitle>
            <CardDescription className="text-zinc-400">
              Boundary runtime: web melalui `/api/sync/*`, desktop via local
              sync path.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {canManageSettings ? (
              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={() => {
                    void runSync("full");
                  }}
                  disabled={isSyncing}
                  className="gap-2 bg-blue-600 hover:bg-blue-500"
                >
                  {syncAction === "full" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  Sinkron Penuh
                </Button>

                <Button
                  onClick={() => {
                    void runSync("push");
                  }}
                  disabled={isSyncing || webRuntime}
                  variant="outline"
                  className={`gap-2 ${dashboardOutlineButtonClass}`}
                >
                  {syncAction === "push" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CloudUpload className="h-4 w-4" />
                  )}
                  Push Sync
                </Button>

                <Button
                  onClick={() => {
                    void runSync("pull");
                  }}
                  disabled={isSyncing || webRuntime}
                  variant="outline"
                  className={`gap-2 ${dashboardOutlineButtonClass}`}
                >
                  {syncAction === "pull" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CloudDownload className="h-4 w-4" />
                  )}
                  Pull Sync
                </Button>
              </div>
            ) : (
              <InlineState
                title="Sinkronisasi terkunci"
                description="Role aktif tidak memiliki permission settings:manage. Status sinkronisasi tetap dapat dipantau."
                variant="info"
                className="text-sm"
              />
            )}

            {webRuntime ? (
              <InlineState
                title="Runtime web: push/pull direct dinonaktifkan"
                description="Web menjalankan sinkronisasi aman via route `/api/sync/*`, tanpa credential Turso di browser."
                variant="info"
                className="text-xs"
              />
            ) : (
              <InlineState
                title="Runtime desktop: local sync path aktif"
                description="Desktop menggunakan konfigurasi sync lokal + keyring untuk akses cloud."
                variant="info"
                className="text-xs"
              />
            )}

            {syncError ? (
              <InlineState
                title="Aksi sinkronisasi gagal"
                description={syncError}
                actionLabel="Coba lagi"
                onAction={() => {
                  void runSync("full");
                }}
                variant={
                  syncError.includes("izin") || syncError.includes("login")
                    ? "warning"
                    : "error"
                }
              />
            ) : null}

            {lastResult ? (
              <div
                className={`rounded-lg border p-4 ${
                  lastResult.status === "success"
                    ? "border-emerald-800 bg-emerald-950/50 text-emerald-300"
                    : "border-red-800 bg-red-950/50 text-red-300"
                }`}
              >
                <div className="flex items-center gap-2">
                  {lastResult.status === "success" ? (
                    <CheckCircle className="h-5 w-5" />
                  ) : (
                    <XCircle className="h-5 w-5" />
                  )}
                  <span className="font-medium">{lastResult.message}</span>
                </div>
              </div>
            ) : null}
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
              <span className="text-zinc-400">Boundary Sync</span>
              <span className="font-mono text-blue-400">
                {desktopRuntime ? "Desktop Path" : "/api/sync/*"}
              </span>
            </div>
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

        <Card className="col-span-2 border-zinc-800 bg-zinc-900 text-white">
          <CardHeader>
            <CardTitle>Ganti Password</CardTitle>
            <CardDescription className="text-zinc-400">
              Perbarui password akun login aktif dengan validasi client-side +
              server-side.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="current-password">Password Saat Ini</Label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                className="border-zinc-800 bg-zinc-950"
                autoComplete="current-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">Password Baru</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                className="border-zinc-800 bg-zinc-950"
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Konfirmasi Password Baru</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="border-zinc-800 bg-zinc-950"
                autoComplete="new-password"
              />
            </div>
            {isPasswordTooShort ? (
              <InlineState
                title="Password baru terlalu pendek"
                description="Minimal 8 karakter."
                variant="warning"
                className="md:col-span-2"
              />
            ) : null}
            {isPasswordMismatch ? (
              <InlineState
                title="Konfirmasi password tidak cocok"
                description="Pastikan password baru dan konfirmasi sama."
                variant="warning"
                className="md:col-span-2"
              />
            ) : null}
            {isPasswordReuse ? (
              <InlineState
                title="Password baru sama dengan password lama"
                description="Gunakan password baru yang berbeda."
                variant="warning"
                className="md:col-span-2"
              />
            ) : null}
            <div className="md:col-span-2">
              <Button
                onClick={() => {
                  void handleChangePassword();
                }}
                disabled={
                  changingPassword ||
                  !currentPassword ||
                  !newPassword ||
                  !confirmPassword ||
                  isPasswordMismatch ||
                  isPasswordReuse ||
                  isPasswordTooShort
                }
                className="bg-blue-600 hover:bg-blue-500"
              >
                {changingPassword ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Simpan Password Baru
              </Button>
            </div>
          </CardContent>
        </Card>

        {!webRuntime && canManageSettings ? (
          <Card className="col-span-2 border-zinc-800 bg-zinc-900 text-white">
            <CardHeader>
              <CardTitle>Desktop Sync Credentials</CardTitle>
              <CardDescription className="text-zinc-400">
                Kredensial hanya untuk runtime desktop dan tidak tersedia pada
                browser/web runtime.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {configError ? (
                <InlineState
                  title="Konfigurasi sync desktop belum siap"
                  description={configError}
                  variant="warning"
                  className="text-xs"
                />
              ) : null}
              <div className="space-y-2">
                <Label htmlFor="sync-url">Sync URL</Label>
                <Input
                  id="sync-url"
                  value={syncConfig.url}
                  onChange={(event) =>
                    setSyncConfig((prev) => ({
                      ...prev,
                      url: event.target.value,
                    }))
                  }
                  placeholder="https://xxxx.turso.io"
                  className="border-zinc-800 bg-zinc-950"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sync-token">Sync Auth Token</Label>
                <Input
                  id="sync-token"
                  type="password"
                  value={syncConfig.authToken}
                  onChange={(event) =>
                    setSyncConfig((prev) => ({
                      ...prev,
                      authToken: event.target.value,
                    }))
                  }
                  placeholder="eyJ..."
                  className="border-zinc-800 bg-zinc-950"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  disabled={configLoading || configSaving}
                  onClick={() => {
                    void loadSyncConfig();
                  }}
                  className={dashboardOutlineButtonClass}
                >
                  {configLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 h-4 w-4" />
                  )}
                  Muat Ulang
                </Button>
                <Button
                  disabled={configSaving}
                  onClick={() => {
                    void saveSyncConfig();
                  }}
                  className="bg-blue-600 hover:bg-blue-500"
                >
                  {configSaving ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Simpan ke Keyring
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        <Card className="col-span-2 border-zinc-800 bg-zinc-900 text-white">
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>Auth/Sync Event Trace</CardTitle>
              <CardDescription className="text-zinc-400">
                Jejak event frontend untuk debug cepat lintas runtime.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="flex items-center gap-2 rounded-lg border border-zinc-800 px-3 py-1.5 text-xs text-zinc-300">
                <ShieldOff className="h-3.5 w-3.5 text-zinc-400" />
                <span>Redact Email</span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={dashboardOutlineButtonClass}
                  onClick={() => {
                    setRedactSensitiveTraceData((prev) => !prev);
                  }}
                >
                  {redactSensitiveTraceData ? "On" : "Off"}
                </Button>
              </div>
              <Button
                variant="outline"
                className={dashboardOutlineButtonClass}
                onClick={() => {
                  setShowErrorTraceOnly((prev) => !prev);
                }}
                disabled={traceEvents.length === 0}
              >
                <Filter className="mr-2 h-4 w-4" />
                {showErrorTraceOnly ? "All Events" : "Error Only"}
              </Button>
              <Button
                variant="outline"
                className={dashboardOutlineButtonClass}
                onClick={() => {
                  clearTraceEvents();
                }}
                disabled={traceEvents.length === 0}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Clear
              </Button>
              <Button
                variant="outline"
                className={dashboardOutlineButtonClass}
                onClick={() => {
                  void copyTraceReport();
                }}
                disabled={traceEvents.length === 0}
              >
                <ClipboardCopy className="mr-2 h-4 w-4" />
                Copy Report
              </Button>
              {desktopRuntime ? (
                <Button
                  variant="outline"
                  className={dashboardOutlineButtonClass}
                  onClick={() => {
                    void exportTraceReportAsJson();
                  }}
                  disabled={traceEvents.length === 0}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export JSON
                </Button>
              ) : null}
            </div>
          </CardHeader>
          <CardContent>
            {hasRecentErrorBurst ? (
              <InlineState
                title="Anomali auth/sync terdeteksi"
                description={`Terdapat ${recentErrorCount} error dalam 10 menit terakhir. Tinjau trace dan kirim report untuk investigasi.`}
                variant="warning"
                actionLabel="Copy Report"
                onAction={() => {
                  void copyTraceReport();
                }}
                className="mb-4"
              />
            ) : null}
            {visibleTraceEvents.length === 0 ? (
              <p className="text-sm text-zinc-400">
                {showErrorTraceOnly
                  ? "Tidak ada trace dengan status error."
                  : "Belum ada event. Jalankan aksi auth/sync untuk menghasilkan trace."}
              </p>
            ) : (
              <div className="space-y-2">
                {visibleTraceEvents.map((event) => (
                  <div
                    key={event.id}
                    className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3"
                  >
                    <div className="mb-1 flex flex-wrap items-center gap-2 text-xs">
                      <Badge
                        variant="secondary"
                        className="bg-zinc-800 text-zinc-100"
                      >
                        {event.action}
                      </Badge>
                      <Badge
                        variant="secondary"
                        className={
                          event.status === "success"
                            ? "bg-emerald-900 text-emerald-200"
                            : event.status === "error"
                              ? "bg-red-900 text-red-200"
                              : event.status === "warning"
                                ? "bg-amber-900 text-amber-200"
                                : "bg-zinc-800 text-zinc-100"
                        }
                      >
                        {event.status}
                      </Badge>
                      <span className="font-mono text-zinc-500">
                        {event.runtime}
                      </span>
                      <span className="font-mono text-zinc-500">
                        {new Date(event.at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm text-zinc-200">{event.detail}</p>
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
