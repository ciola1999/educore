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

  return (
    <div className="space-y-5">
      <InlineState
        title="QR attendance aktif dengan boundary baru"
        description="Flow QR sekarang memakai route handler backend yang tervalidasi. Kamera bisa dipakai langsung, dan fallback input manual tetap tersedia untuk desktop testing atau scanner eksternal."
        variant="info"
      />

      <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
                <QrCode className="h-5 w-5 text-emerald-400" />
                QR Scanner
              </h3>
              <p className="text-sm text-zinc-400">
                {isTauri()
                  ? "Mode desktop aktif. Kamera dan input manual sama-sama tersedia."
                  : "Mode web aktif. Pastikan browser punya izin kamera."}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {cameraActive ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    void stopScanner();
                  }}
                  className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                >
                  <CameraOff className="h-4 w-4 mr-2" />
                  Stop Camera
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={() => {
                    void startScanner();
                  }}
                  disabled={startingCamera || submitting}
                  className="bg-emerald-600 hover:bg-emerald-500"
                >
                  {startingCamera ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Camera className="h-4 w-4 mr-2" />
                  )}
                  Start Camera
                </Button>
              )}
            </div>
          </div>

          {cameraError ? (
            <InlineState
              title="Kamera tidak tersedia"
              description={cameraError}
              variant="warning"
            />
          ) : null}

          <div className="relative rounded-2xl border border-zinc-800 bg-zinc-950/70 p-3">
            <div
              id={scannerElementId}
              className="min-h-[280px] overflow-hidden rounded-xl bg-zinc-950"
            />
            {scanningStatus === "scanned" && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
                <div className="text-center p-8 border border-white/20 rounded-3xl bg-zinc-900/90 shadow-2xl">
                  <div className="w-20 h-20 rounded-full bg-emerald-500/20 border-4 border-emerald-500 flex items-center justify-center mx-auto mb-6">
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
              <div className="flex min-h-[280px] items-center justify-center rounded-xl border border-dashed border-zinc-800 bg-zinc-950/80 text-center text-zinc-500">
                <div className="space-y-2 px-6">
                  <ScanLine className="mx-auto h-10 w-10 text-zinc-600" />
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

          <div className="rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4 space-y-3">
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
              className="min-h-24 w-full rounded-xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none focus:border-emerald-500"
            />
            <div className="flex justify-end">
              <Button
                type="button"
                onClick={() => {
                  void submitManualQr();
                }}
                disabled={submitting}
                className="bg-blue-600 hover:bg-blue-500"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <QrCode className="h-4 w-4 mr-2" />
                )}
                Proses QR
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-blue-400" />
                Hasil Scan Terakhir
              </h3>
            </div>

            {lastResult ? (
              <div
                className={`rounded-2xl border p-4 ${
                  lastResult.success
                    ? "border-emerald-500/20 bg-emerald-500/5"
                    : "border-red-500/20 bg-red-500/5"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <p className="font-semibold text-zinc-100">
                    {lastResult.message}
                  </p>
                  <span
                    className={`inline-flex rounded-full border px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide ${getResultBadge(lastResult).className}`}
                  >
                    {getResultBadge(lastResult).label}
                  </span>
                </div>
                {lastResult.data ? (
                  <div className="mt-3 grid gap-3 text-sm text-zinc-300 md:grid-cols-2">
                    <div className="space-y-1">
                      <p className="font-medium text-zinc-100">
                        {lastResult.data.fullName}
                      </p>
                      <p>NIS {lastResult.data.nis}</p>
                      <p>Kelas {lastResult.data.grade}</p>
                    </div>
                    <div className="space-y-1">
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
                ) : null}
              </div>
            ) : (
              <InlineState
                title="Belum ada scan"
                description="Hasil scan terbaru akan muncul di panel ini."
                variant="info"
              />
            )}
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-lg font-semibold text-zinc-100">
                Log Hari Ini
              </h3>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  void loadTodayLogs();
                }}
                className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
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
                    className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-3 text-sm"
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
              <InlineState
                title="Belum ada scan hari ini"
                description="Log QR hari ini akan muncul setelah check-in atau check-out pertama."
                variant="info"
              />
            )}
          </div>

          <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-100">
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
