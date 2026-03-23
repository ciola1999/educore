"use client";

import {
  Camera,
  CameraOff,
  Check,
  CheckCircle2,
  Loader2,
  QrCode,
  RefreshCw,
  ScanLine,
  ShieldAlert,
} from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";
import { InlineState } from "@/components/common/inline-state";
import { Button } from "@/components/ui/button";
import { isTauri } from "@/core/env";
import { useQrAttendance } from "@/hooks/use-attendance";

function formatTime(value: string | Date | null) {
  if (!value) {
    return "-";
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getResultBadge(
  result: NonNullable<ReturnType<typeof useQrAttendance>["lastResult"]>,
) {
  if (!result.success || result.type === "ERROR") {
    return {
      label: "Gagal",
      className: "border-red-500/30 bg-red-500/10 text-red-200",
    };
  }

  if (result.type === "CHECK_OUT") {
    return {
      label: "Check-out",
      className: "border-blue-500/30 bg-blue-500/10 text-blue-200",
    };
  }

  return {
    label: "Check-in",
    className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
  };
}

function getLogStatusBadge(status: "PRESENT" | "LATE" | "EXCUSED" | "ABSENT") {
  switch (status) {
    case "LATE":
      return "border-amber-500/30 bg-amber-500/10 text-amber-200";
    case "EXCUSED":
      return "border-blue-500/30 bg-blue-500/10 text-blue-200";
    case "ABSENT":
      return "border-red-500/30 bg-red-500/10 text-red-200";
    default:
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
  }
}

function getLogStatusLabel(status: "PRESENT" | "LATE" | "EXCUSED" | "ABSENT") {
  switch (status) {
    case "LATE":
      return "Terlambat";
    case "EXCUSED":
      return "Izin/Sakit";
    case "ABSENT":
      return "Alpha";
    default:
      return "Hadir";
  }
}

function getSyncStatusLabel(status: "synced" | "pending" | "error") {
  switch (status) {
    case "pending":
      return "Menunggu sync";
    case "error":
      return "Gagal sync";
    default:
      return "Tersinkron";
  }
}

export function QRScannerView() {
  const isDesktopRuntime = isTauri();
  const scannerElementId = useId().replace(/:/g, "-");
  const scannerRef = useRef<{
    stop: () => Promise<void>;
    clear: () => void | Promise<void>;
    isScanning?: boolean;
  } | null>(null);
  const lockRef = useRef(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [startingCamera, setStartingCamera] = useState(false);
  const [manualInput, setManualInput] = useState("");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanningStatus, setScanningStatus] = useState<"idle" | "scanned">(
    "idle",
  );
  const {
    submitting,
    loadingLogs,
    logs,
    lastResult,
    loadTodayLogs,
    submitQrScan,
  } = useQrAttendance({
    onSuccess: (result) => {
      if (result.type === "CHECK_IN" || result.type === "CHECK_OUT") {
        playBeep();
      }
    },
  });

  function playBeep() {
    try {
      const AudioContextCtor =
        window.AudioContext ||
        (
          window as typeof window & {
            webkitAudioContext?: typeof AudioContext;
          }
        ).webkitAudioContext;

      if (!AudioContextCtor) {
        return;
      }

      const context = new AudioContextCtor();
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(880, context.currentTime);
      gain.gain.setValueAtTime(0.001, context.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(
        0.0001,
        context.currentTime + 0.18,
      );

      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.18);
      oscillator.onended = () => {
        void context.close().catch(() => {
          // Ignore close errors from transient audio context cleanup.
        });
      };
    } catch (_e) {
      // Audio feedback is best-effort only.
    }
  }

  const stopScanner = useCallback(async () => {
    if (!scannerRef.current) {
      setCameraActive(false);
      return;
    }

    try {
      if (scannerRef.current.isScanning) {
        await scannerRef.current.stop();
      }
      await scannerRef.current.clear();
    } catch {
      // Scanner cleanup should not block UI recovery.
    } finally {
      scannerRef.current = null;
      setCameraActive(false);
    }
  }, []);

  async function handleScan(decodedText: string) {
    const normalized = decodedText.trim();
    if (!normalized || lockRef.current) {
      return;
    }

    lockRef.current = true;
    setScanningStatus("scanned");
    try {
      const result = await submitQrScan(normalized);
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal memproses QR scan",
      );
    } finally {
      window.setTimeout(() => {
        lockRef.current = false;
        setScanningStatus("idle");
      }, 1200);
    }
  }

  async function startScanner() {
    setStartingCamera(true);
    setCameraError(null);

    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error(
          "Runtime ini tidak menyediakan akses kamera. Gunakan fallback input QR atau jalankan di environment yang mengizinkan camera access.",
        );
      }

      const permissionStream = await navigator.mediaDevices.getUserMedia({
        video: true,
      });
      permissionStream.getTracks().forEach((track) => {
        track.stop();
      });

      const cameras = await Html5Qrcode.getCameras();
      const preferredCamera = cameras.find((camera) =>
        /back|rear|environment/iu.test(camera.label),
      );
      const cameraConfig = preferredCamera?.id ||
        cameras[0]?.id || { facingMode: "environment" };

      const scanner = new Html5Qrcode(scannerElementId);
      scannerRef.current = scanner;

      await scanner.start(
        cameraConfig,
        {
          fps: 10,
          qrbox: { width: 240, height: 240 },
          aspectRatio: 1,
        },
        (decodedText) => {
          void handleScan(decodedText);
        },
        undefined,
      );

      setCameraActive(true);
    } catch (error) {
      await stopScanner();
      const message =
        error instanceof Error
          ? error.message
          : "Kamera tidak bisa diakses untuk scan QR";
      setCameraError(message);
      toast.error(message);
    } finally {
      setStartingCamera(false);
    }
  }

  async function submitManualQr() {
    const normalized = manualInput.trim();
    if (!normalized) {
      toast.error("Isi data QR terlebih dahulu");
      return;
    }

    try {
      const result = await submitQrScan(normalized);
      if (result.success) {
        toast.success(result.message);
        setManualInput("");
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal memproses QR scan",
      );
    }
  }

  useEffect(() => {
    return () => {
      void stopScanner();
    };
  }, [stopScanner]);

  const scannerRuntimeLabel = isDesktopRuntime
    ? "Desktop / Tauri"
    : "Web / Browser";
  const scannerRuntimeDescription = isDesktopRuntime
    ? "Mode desktop aktif. Kamera dan input manual sama-sama tersedia."
    : "Mode web aktif. Pastikan browser punya izin kamera.";
  const cameraStatus = startingCamera
    ? {
        label: "Menyalakan kamera",
        className: "border-amber-500/30 bg-amber-500/10 text-amber-100",
      }
    : cameraActive
      ? {
          label: "Kamera aktif",
          className: "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
        }
      : {
          label: "Siap scan",
          className: "border-zinc-700 bg-zinc-800/70 text-zinc-200",
        };
  const scanResultTone = lastResult
    ? lastResult.success
      ? "border-emerald-500/20 bg-linear-to-br from-emerald-500/8 to-emerald-500/4 shadow-emerald-950/20"
      : "border-red-500/20 bg-linear-to-br from-red-500/8 to-red-500/4 shadow-red-950/20"
    : "";

  return (
    <div className="space-y-5">
      <InlineState
        title="QR attendance aktif dengan boundary baru"
        description="Flow QR sekarang memakai route handler backend yang tervalidasi. Kamera bisa dipakai langsung, dan fallback input manual tetap tersedia untuk desktop testing atau scanner eksternal."
        variant="info"
      />

      <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-5 rounded-3xl border border-zinc-800 bg-linear-to-br from-zinc-900/55 to-zinc-950/75 p-5 shadow-sm shadow-black/10">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="flex items-center gap-2 text-lg font-semibold text-zinc-100">
                <QrCode className="h-5 w-5 text-emerald-400" />
                QR Scanner
              </h3>
              <p className="text-sm text-zinc-400">
                {scannerRuntimeDescription}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {cameraActive ? (
                <Button
                  type="button"
                  variant="default"
                  onClick={() => {
                    void stopScanner();
                  }}
                  className="h-11 rounded-xl border border-red-500/35 bg-linear-to-br from-red-500/22 to-red-600/14 px-4 !text-white shadow-sm shadow-red-950/30 transition-all duration-200 hover:-translate-y-0.5 hover:border-red-400/60 hover:from-red-500/28 hover:to-red-600/18 hover:!text-white hover:shadow-md hover:shadow-red-950/40"
                >
                  <CameraOff className="mr-2 h-4 w-4 !text-red-100" />
                  <span className="!text-white">Stop Camera</span>
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={() => {
                    void startScanner();
                  }}
                  disabled={startingCamera || submitting}
                  className="h-11 rounded-xl border border-emerald-500/35 bg-linear-to-br from-emerald-500 to-emerald-600 px-4 !text-white shadow-sm shadow-emerald-950/30 transition-all duration-200 hover:-translate-y-0.5 hover:from-emerald-400 hover:to-emerald-500 hover:shadow-md hover:shadow-emerald-950/40"
                >
                  {startingCamera ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Camera className="mr-2 h-4 w-4" />
                  )}
                  <span className="!text-white">Start Camera</span>
                </Button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <span className="inline-flex rounded-full border border-cyan-500/25 bg-cyan-500/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-100">
              {scannerRuntimeLabel}
            </span>
            <span
              className={`inline-flex rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] ${cameraStatus.className}`}
            >
              {cameraStatus.label}
            </span>
            <span className="inline-flex rounded-full border border-zinc-700 bg-zinc-900/80 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-200">
              Fallback manual siap
            </span>
          </div>

          {cameraError ? (
            <InlineState
              title="Kamera tidak tersedia"
              description={cameraError}
              variant="warning"
            />
          ) : null}

          <div className="relative rounded-3xl border border-zinc-800 bg-linear-to-br from-zinc-950/90 to-zinc-900/80 p-3 shadow-inner shadow-black/20">
            <div
              id={scannerElementId}
              className="min-h-[280px] overflow-hidden rounded-2xl bg-zinc-950"
            />
            {cameraActive ? (
              <>
                <div className="pointer-events-none absolute inset-3 rounded-2xl border border-emerald-500/15" />
                <div className="pointer-events-none absolute inset-x-10 top-8 h-px bg-linear-to-r from-transparent via-emerald-400/70 to-transparent shadow-[0_0_18px_rgba(16,185,129,0.45)] animate-pulse" />
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="relative h-[220px] w-[220px] rounded-[2rem] border border-white/8">
                    <span className="absolute left-0 top-0 h-10 w-10 rounded-tl-[1.7rem] border-l-2 border-t-2 border-emerald-400/80" />
                    <span className="absolute right-0 top-0 h-10 w-10 rounded-tr-[1.7rem] border-r-2 border-t-2 border-emerald-400/80" />
                    <span className="absolute bottom-0 left-0 h-10 w-10 rounded-bl-[1.7rem] border-b-2 border-l-2 border-emerald-400/80" />
                    <span className="absolute bottom-0 right-0 h-10 w-10 rounded-br-[1.7rem] border-b-2 border-r-2 border-emerald-400/80" />
                    <div className="absolute inset-x-6 top-1/2 h-px -translate-y-1/2 bg-linear-to-r from-transparent via-emerald-300/75 to-transparent shadow-[0_0_16px_rgba(52,211,153,0.45)]" />
                  </div>
                </div>
                <div className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full border border-emerald-500/20 bg-zinc-950/75 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-100 backdrop-blur-sm">
                  Arahkan QR ke area frame
                </div>
              </>
            ) : null}
            {scanningStatus === "scanned" && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
                <div className="rounded-3xl border border-white/20 bg-zinc-900/90 p-8 text-center shadow-2xl">
                  <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full border-4 border-emerald-500 bg-emerald-500/20 shadow-[0_0_30px_rgba(16,185,129,0.25)]">
                    <Check className="h-10 w-10 text-emerald-400" />
                  </div>
                  <p className="text-xl font-bold text-white mb-2">
                    Terdeteksi!
                  </p>
                  <p className="text-zinc-400 text-sm">
                    Sedang memproses absensi...
                  </p>
                </div>
              </div>
            )}
            {!cameraActive ? (
              <div className="flex min-h-[280px] items-center justify-center rounded-2xl border border-dashed border-zinc-800 bg-zinc-950/80 text-center text-zinc-500">
                <div className="space-y-2 px-6">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900/80">
                    <ScanLine className="h-8 w-8 text-zinc-600" />
                  </div>
                  <p className="font-medium text-zinc-300">
                    Kamera belum aktif
                  </p>
                  <p className="text-sm">
                    Jalankan kamera untuk scan langsung, atau gunakan input
                    manual di bawah jika kamu memakai scanner eksternal.
                  </p>
                </div>
              </div>
            ) : null}
          </div>

          <div className="space-y-3 rounded-3xl border border-zinc-800 bg-linear-to-br from-zinc-950/70 to-zinc-900/70 p-4">
            <label
              htmlFor="manual-qr-input"
              className="text-sm font-medium text-zinc-200"
            >
              Fallback input QR
            </label>
            <textarea
              id="manual-qr-input"
              value={manualInput}
              onChange={(event) => setManualInput(event.target.value)}
              placeholder='Contoh: {"nis":"2324.10.001"} atau token kartu'
              className="min-h-24 w-full rounded-2xl border border-zinc-800 bg-zinc-950/90 px-4 py-3 text-sm text-zinc-100 outline-none transition-all duration-200 placeholder:text-zinc-600 hover:border-emerald-500/30 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
            />
            <div className="flex justify-end">
              <Button
                type="button"
                onClick={() => {
                  void submitManualQr();
                }}
                disabled={submitting}
                className="h-11 rounded-xl border border-blue-400/35 bg-linear-to-br from-blue-500 to-cyan-500 px-4 !text-white shadow-sm shadow-blue-950/30 transition-all duration-200 hover:-translate-y-0.5 hover:from-blue-400 hover:to-cyan-400 hover:shadow-md hover:shadow-blue-950/40"
              >
                {submitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <QrCode className="mr-2 h-4 w-4" />
                )}
                <span className="!text-white">Proses QR</span>
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="space-y-4 rounded-3xl border border-zinc-800 bg-linear-to-br from-zinc-900/55 to-zinc-950/75 p-5 shadow-sm shadow-black/10">
            <div className="flex items-center justify-between gap-3">
              <h3 className="flex items-center gap-2 text-lg font-semibold text-zinc-100">
                <CheckCircle2 className="h-5 w-5 text-blue-400" />
                Hasil Scan Terakhir
              </h3>
            </div>

            {lastResult ? (
              <div
                className={`rounded-3xl border p-4 shadow-sm ${scanResultTone}`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide ${getResultBadge(lastResult).className}`}
                      >
                        {getResultBadge(lastResult).label}
                      </span>
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide ${
                          lastResult.success
                            ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                            : "border-red-500/30 bg-red-500/10 text-red-100"
                        }`}
                      >
                        {lastResult.success ? "Berhasil" : "Ditolak"}
                      </span>
                    </div>
                    <p className="font-semibold text-zinc-100">
                      {lastResult.message}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/40 px-3 py-2 text-right text-xs text-zinc-400">
                    <p className="uppercase tracking-[0.16em] text-zinc-500">
                      Update
                    </p>
                    <p className="mt-1 text-sm font-semibold text-zinc-100">
                      {lastResult.data?.time || formatTime(new Date())}
                    </p>
                  </div>
                </div>
                {lastResult.data ? (
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="space-y-3 rounded-2xl border border-zinc-800/80 bg-zinc-950/35 p-3 text-sm text-zinc-300">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                          Siswa
                        </p>
                        <p className="mt-1 font-medium text-zinc-100">
                          {lastResult.data.fullName}
                        </p>
                      </div>
                      <div className="grid gap-2 text-xs text-zinc-400 sm:grid-cols-2">
                        <p>
                          NIS{" "}
                          <span className="font-medium text-zinc-200">
                            {lastResult.data.nis}
                          </span>
                        </p>
                        <p>
                          Kelas{" "}
                          <span className="font-medium text-zinc-200">
                            {lastResult.data.grade}
                          </span>
                        </p>
                      </div>
                    </div>
                    <div className="space-y-3 rounded-2xl border border-zinc-800/80 bg-zinc-950/35 p-3 text-sm text-zinc-300">
                      <div className="grid gap-2 text-xs text-zinc-400">
                        <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                          Detail Scan
                        </p>
                        <p>
                          Jenis:{" "}
                          <span className="font-medium text-zinc-100">
                            {lastResult.data.type === "in"
                              ? "Check-in"
                              : "Check-out"}
                          </span>
                        </p>
                        <p>
                          Waktu:{" "}
                          <span className="font-medium text-zinc-100">
                            {lastResult.data.time}
                          </span>
                        </p>
                        <p>
                          Status:{" "}
                          <span className="font-medium text-zinc-100">
                            {lastResult.data.status === "late"
                              ? `Terlambat (${lastResult.data.lateMinutes} menit)`
                              : "Tepat waktu"}
                          </span>
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl border border-zinc-800/80 bg-zinc-950/35 p-3 text-sm text-zinc-400">
                    Payload diproses, tetapi detail siswa tidak tersedia pada
                    respons terakhir.
                  </div>
                )}
              </div>
            ) : (
              <InlineState
                title="Belum ada scan"
                description="Hasil scan terbaru akan muncul di panel ini."
                variant="info"
              />
            )}
          </div>

          <div className="space-y-4 rounded-3xl border border-zinc-800 bg-linear-to-br from-zinc-900/55 to-zinc-950/75 p-5 shadow-sm shadow-black/10">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-zinc-100">
                Log Hari Ini
              </h3>
              <Button
                type="button"
                variant="default"
                onClick={() => {
                  void loadTodayLogs();
                }}
                className="h-11 rounded-xl border border-sky-500/35 bg-linear-to-br from-sky-500/22 to-sky-600/14 px-4 !text-white shadow-sm shadow-sky-950/30 transition-all duration-200 hover:-translate-y-0.5 hover:border-sky-400/60 hover:from-sky-500/28 hover:to-sky-600/18 hover:!text-white hover:shadow-md hover:shadow-sky-950/40"
              >
                <RefreshCw className="mr-2 h-4 w-4 !text-sky-100" />
                <span className="!text-white">Refresh</span>
              </Button>
            </div>

            {loadingLogs ? (
              <div className="flex items-center justify-center py-10 text-zinc-500">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : logs.length > 0 ? (
              <div className="space-y-3">
                {logs.slice(0, 8).map((log) => (
                  <div
                    key={log.id}
                    className="rounded-2xl border border-zinc-800 bg-linear-to-br from-zinc-950/75 to-zinc-900/70 p-3 text-sm shadow-sm shadow-black/10 transition-all duration-200 hover:-translate-y-0.5 hover:border-zinc-700 hover:shadow-md hover:shadow-black/20"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-zinc-100">
                          {log.snapshotStudentName || "Siswa"}
                        </p>
                        <p className="text-zinc-400">
                          {log.snapshotStudentNis || "-"}
                        </p>
                      </div>
                      <span
                        className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide ${getLogStatusBadge(log.status)}`}
                      >
                        {getLogStatusLabel(log.status)}
                      </span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-zinc-400">
                      <div>
                        <p className="text-zinc-500">Check-in</p>
                        <p className="mt-1 font-medium text-zinc-200">
                          {formatTime(log.checkInTime)}
                        </p>
                      </div>
                      <div>
                        <p className="text-zinc-500">Check-out</p>
                        <p className="mt-1 font-medium text-zinc-200">
                          {formatTime(log.checkOutTime)}
                        </p>
                      </div>
                      <div>
                        <p className="text-zinc-500">Late Duration</p>
                        <p className="mt-1 font-medium text-zinc-200">
                          {log.lateDuration ? `${log.lateDuration} menit` : "-"}
                        </p>
                      </div>
                      <div>
                        <p className="text-zinc-500">Sync</p>
                        <p className="mt-1 font-medium text-zinc-200">
                          {getSyncStatusLabel(log.syncStatus)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-zinc-800 bg-zinc-950/35 p-6 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-zinc-800 bg-zinc-900/80">
                  <ScanLine className="h-6 w-6 text-zinc-600" />
                </div>
                <p className="mt-4 text-sm font-semibold text-zinc-200">
                  Belum ada scan hari ini
                </p>
                <p className="mt-2 text-sm text-zinc-500">
                  Log QR hari ini akan muncul setelah check-in atau check-out
                  pertama.
                </p>
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-amber-500/20 bg-linear-to-br from-amber-500/10 to-amber-500/4 p-4 text-sm text-amber-100 shadow-sm shadow-amber-950/10">
            <div className="flex items-start gap-3">
              <ShieldAlert className="mt-0.5 h-5 w-5 text-amber-300" />
              <p>
                QR hanya memproses payload yang tervalidasi di backend. Jika
                kartu belum terdaftar, scan akan ditolak dan tidak menulis data
                liar ke attendance.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
