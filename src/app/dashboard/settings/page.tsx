"use client";

import {
  CheckCircle,
  Cloud,
  CloudDownload,
  CloudUpload,
  Loader2,
  LogOut,
  RefreshCw,
  ShieldCheck,
  ShieldMinus,
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
import { isTauri, isWeb } from "@/core/env";
import { useAuth } from "@/hooks/use-auth";
import { apiPost } from "@/lib/api/request";
import { checkPermission } from "@/lib/auth/rbac";
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

const dashboardOutlineButtonClass = outlineButtonStyles.neutral;

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
  const runtime = isTauri() ? "desktop" : "web";
  const sessionRole = (session?.user as { role?: string } | undefined)?.role;
  const sessionEmail = session?.user?.email || "";
  const userRole = user?.role || "";
  const userEmail = user?.email || "";
  const hasSessionMismatch =
    isWeb() &&
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
  const [lastSyncAt, setLastSyncAt] = useState<Date | null>(null);
  const [lastSessionRefreshAt, setLastSessionRefreshAt] = useState<Date | null>(
    null,
  );
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
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

  async function runSync(action: SyncAction) {
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
        toast.error(result.message);
      } else {
        setLastSyncAt(new Date());
        toast.success(result.message);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Sinkronisasi gagal diproses";
      setLastResult({ status: "error", message });
      setSyncError(message);
      toast.error(message);
    } finally {
      setSyncAction(null);
    }
  }

  async function loadSyncConfig() {
    setConfigLoading(true);
    setConfigError(null);

    const fallback = readDesktopSyncStorageConfig();
    if (fallback) {
      setSyncConfig({
        url: fallback.url,
        authToken: fallback.authToken,
      });
    }

    if (!isTauri()) {
      setConfigLoading(false);
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
  }

  useEffect(() => {
    if (syncConfigInitializedRef.current) {
      return;
    }

    syncConfigInitializedRef.current = true;
    if (isTauri()) {
      void loadSyncConfig();
    }
  });

  async function saveSyncConfig() {
    if (!isTauri()) {
      toast.error("Konfigurasi sync credential hanya tersedia di desktop.");
      return;
    }

    if (!syncConfig.url.trim() || !syncConfig.authToken.trim()) {
      toast.error("URL dan auth token sync wajib diisi.");
      return;
    }

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
      toast.success("Konfigurasi sync desktop berhasil disimpan ke keyring.");
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Gagal menyimpan konfigurasi sync desktop";
      setConfigError(
        `${message}. Fallback lokal desktop tetap tersimpan dan akan dipakai saat sync.`,
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
      return;
    }

    if (isPasswordTooShort) {
      toast.error("Password baru minimal 8 karakter.");
      return;
    }

    if (isPasswordMismatch) {
      toast.error("Konfirmasi password baru tidak cocok.");
      return;
    }

    if (isPasswordReuse) {
      toast.error("Password baru tidak boleh sama dengan password saat ini.");
      return;
    }

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
      toast.success("Password berhasil diperbarui.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal mengubah password",
      );
    } finally {
      setChangingPassword(false);
    }
  }

  async function handleSessionRefresh() {
    setRefreshingSession(true);
    try {
      const refreshed = await refreshSession();
      if (refreshed) {
        setLastSessionRefreshAt(new Date());
        toast.success("State session berhasil diperbarui.");
      } else {
        toast.warning("Sesi tidak lagi valid. Silakan login ulang.");
      }
      router.refresh();
    } catch {
      toast.error("Gagal memuat ulang state session.");
    } finally {
      setRefreshingSession(false);
    }
  }

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
    } catch {
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
                  disabled={isSyncing || isWeb()}
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
                  disabled={isSyncing || isWeb()}
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

            {isWeb() ? (
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
                {isTauri() ? "SQLite (Local)" : "Turso (Cloud)"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Boundary Sync</span>
              <span className="font-mono text-blue-400">
                {isTauri() ? "Desktop Path" : "/api/sync/*"}
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

        {!isWeb() && canManageSettings ? (
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
      </div>
    </div>
  );
}
