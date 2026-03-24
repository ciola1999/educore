"use client";

import {
  CheckCircle,
  Cloud,
  CloudDownload,
  CloudUpload,
  Loader2,
  RefreshCw,
  ShieldCheck,
  ShieldMinus,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { InlineState } from "@/components/common/inline-state";
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

type DesktopSyncConfig = {
  url: string;
  authToken: string;
};

const dashboardOutlineButtonClass =
  "border-zinc-700 bg-zinc-950/85 text-zinc-100 hover:border-zinc-600 hover:bg-zinc-800 hover:text-white";

export default function SettingsPage() {
  const { user } = useAuth();
  const canManageSettings = checkPermission(user, "settings:manage");
  const [syncing, setSyncing] = useState(false);
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
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  async function runSync(action: "full" | "push" | "pull") {
    setSyncing(true);
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
        toast.success(result.message);
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Sinkronisasi gagal diproses";
      setLastResult({ status: "error", message });
      setSyncError(message);
      toast.error(message);
    } finally {
      setSyncing(false);
    }
  }

  const loadSyncConfig = useCallback(async () => {
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
      if (fallback) {
        setConfigError(null);
      } else {
        const message =
          error instanceof Error
            ? error.message
            : "Gagal memuat konfigurasi sync desktop";
        setConfigError(message);
      }
    } finally {
      setConfigLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isTauri()) {
      return;
    }

    void loadSyncConfig();
  }, [loadSyncConfig]);

  async function saveSyncConfig() {
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

      if (!isTauri()) {
        toast.success("Konfigurasi fallback lokal berhasil disimpan.");
        return;
      }

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
        "Native command gagal, tapi fallback lokal desktop berhasil disimpan.",
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

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight bg-linear-to-r from-gray-300 to-gray-500 bg-clip-text text-transparent">
          Pengaturan
        </h2>
        <p className="text-zinc-400 mt-1">
          {canManageSettings
            ? "Kelola pengaturan aplikasi dan sinkronisasi data."
            : "Lihat status aplikasi dan konfigurasi sinkronisasi tanpa membuka aksi manajemen yang tidak diizinkan."}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-zinc-700 bg-zinc-900/40 p-5">
          <div className="flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-zinc-300" />
            <div>
              <p className="text-sm font-semibold text-white">
                Akses Baca Aktif
              </p>
              <p className="text-sm text-zinc-400">
                Halaman pengaturan dibuka untuk role{" "}
                <span className="font-semibold text-zinc-200">
                  {user?.role || "-"}
                </span>
                .
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
                  : "Tombol sinkronisasi dan penyimpanan credential disembunyikan karena role ini tidak memiliki permission settings:manage."}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="bg-zinc-900 border-zinc-800 text-white col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cloud className="h-5 w-5 text-blue-400" />
              Sinkronisasi Cloud (Turso)
            </CardTitle>
            <CardDescription className="text-zinc-400">
              Sinkronkan data lokal dengan database cloud menggunakan strategi
              Last-Write-Wins.
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {canManageSettings ? (
              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={() => void runSync("full")}
                  disabled={syncing}
                  className="bg-blue-600 hover:bg-blue-500 gap-2"
                >
                  {syncing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  Sinkron Penuh
                </Button>

                <Button
                  onClick={() => void runSync("push")}
                  disabled={syncing || isWeb()}
                  variant="outline"
                  className={`gap-2 ${dashboardOutlineButtonClass}`}
                >
                  <CloudUpload className="h-4 w-4" />
                  Kirim ke Cloud
                </Button>

                <Button
                  onClick={() => void runSync("pull")}
                  disabled={syncing || isWeb()}
                  variant="outline"
                  className={`gap-2 ${dashboardOutlineButtonClass}`}
                >
                  <CloudDownload className="h-4 w-4" />
                  Tarik dari Cloud
                </Button>
              </div>
            ) : (
              <InlineState
                title="Sinkronisasi terkunci"
                description="Role aktif tidak memiliki permission settings:manage. Status sinkronisasi tetap bisa dipantau, tetapi aksi sinkronisasi tidak dibuka."
                variant="info"
                className="text-sm"
              />
            )}

            {isWeb() ? (
              <InlineState
                title="Mode sinkronisasi web"
                description="Versi web sudah tersinkron langsung ke cloud. Tombol kirim dan tarik dinonaktifkan karena endpoint sinkronisasi fase 1 di web bersifat no-op yang aman."
                variant="info"
                className="text-xs"
              />
            ) : null}

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
                className={`p-4 rounded-lg border ${
                  lastResult.status === "success"
                    ? "bg-emerald-950/50 border-emerald-800 text-emerald-300"
                    : "bg-red-950/50 border-red-800 text-red-300"
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

        <Card className="bg-zinc-900 border-zinc-800 text-white">
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
              <span className="font-mono">SQLite (Local)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Cloud</span>
              <span className="font-mono text-blue-400">Turso Cloud</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800 text-white">
          <CardHeader>
            <CardTitle>Penyimpanan</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-zinc-400">Database Lokal</span>
              <span className="text-emerald-400">Terhubung</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Status Cloud</span>
              <span className="text-blue-400">Tersedia</span>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800 text-white col-span-2">
          <CardHeader>
            <CardTitle>Data Diri Akun</CardTitle>
            <CardDescription className="text-zinc-400">
              Informasi akun aktif untuk role yang sedang login.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-zinc-400">Role</span>
              <span className="font-medium text-zinc-100">
                {user?.role || "-"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Email Login</span>
              <span className="font-mono text-zinc-100">
                {user?.email || "-"}
              </span>
            </div>
            <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-400">
              Password tidak ditampilkan karena tersimpan aman dalam bentuk
              hash. Gunakan form "Ganti Password" untuk memperbarui.
            </div>
          </CardContent>
        </Card>

        <Card className="bg-zinc-900 border-zinc-800 text-white col-span-2">
          <CardHeader>
            <CardTitle>Ganti Password</CardTitle>
            <CardDescription className="text-zinc-400">
              Perbarui password akun yang sedang login.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="current-password">Password Saat Ini</Label>
              <Input
                id="current-password"
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                className="bg-zinc-950 border-zinc-800"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-password">Password Baru</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                className="bg-zinc-950 border-zinc-800"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Konfirmasi Password Baru</Label>
              <Input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="bg-zinc-950 border-zinc-800"
              />
            </div>
            <Button
              onClick={() => {
                void handleChangePassword();
              }}
              disabled={changingPassword}
              className="bg-blue-600 hover:bg-blue-500"
            >
              {changingPassword ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Simpan Password Baru
            </Button>
          </CardContent>
        </Card>

        {!isWeb() && canManageSettings ? (
          <Card className="bg-zinc-900 border-zinc-800 text-white col-span-2">
            <CardHeader>
              <CardTitle>Desktop Sync Credentials</CardTitle>
              <CardDescription className="text-zinc-400">
                Kredensial ini hanya dipakai runtime desktop dan disimpan ke OS
                keyring.
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
                  className="bg-zinc-950 border-zinc-800"
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
                  className="bg-zinc-950 border-zinc-800"
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
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
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
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
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
