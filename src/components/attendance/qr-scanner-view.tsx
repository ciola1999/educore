"use client";

import {
  AlertTriangle,
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
import { cn } from "@/lib/utils";

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
      label: "Pulang",
      className: "border-blue-500/30 bg-blue-500/10 text-blue-200",
    };
  }

  return {
    label: "Masuk",
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

function getCameraErrorMeta(message: string, isDesktopRuntime: boolean) {
  if (/notallowed|permission|denied|izin/iu.test(message)) {
    return {
      title: "Izin kamera ditolak",
      description:
        "Izinkan akses kamera untuk browser atau runtime desktop, lalu coba mulai ulang scanner.",
      tips: [
        "Periksa permission kamera di browser atau OS.",
        "Tutup aplikasi lain yang sedang memakai kamera.",
        "Jika tetap gagal, gunakan fallback input QR sementara.",
      ],
    };
  }

  if (/notfound|device|camera.*found|kamera.*tidak/iu.test(message)) {
    return {
      title: "Perangkat kamera tidak ditemukan",
      description:
        "Device ini tidak melaporkan kamera yang bisa dipakai untuk scan QR.",
      tips: [
        "Pastikan webcam atau kamera belakang tersedia dan terhubung.",
        "Reload halaman atau buka ulang app desktop setelah kamera aktif.",
        "Gunakan scanner eksternal atau input QR manual sebagai fallback.",
      ],
    };
  }

  if (/secure|https|context/iu.test(message) && !isDesktopRuntime) {
    return {
      title: "Kamera butuh secure context",
      description:
        "Di web, akses kamera hanya stabil pada HTTPS atau localhost yang valid.",
      tips: [
        "Uji di localhost atau deployment HTTPS.",
        "Hindari membuka aplikasi dari origin yang tidak aman.",
        "Gunakan fallback manual jika sedang debugging environment.",
      ],
    };
  }

  return {
    title: "Kamera tidak tersedia",
    description: message,
    tips: [
      "Coba start ulang scanner setelah beberapa detik.",
      "Pastikan tidak ada aplikasi lain yang sedang mengunci kamera.",
      isDesktopRuntime
        ? "Jika kamera tetap gagal, lanjutkan dengan scanner eksternal atau input manual di desktop."
        : "Jika kamera tetap gagal, gunakan fallback manual sampai izin kamera kembali normal.",
    ],
  };
}

function getScanSourceLabel(source: "camera" | "manual" | null) {
  if (source === "camera") {
    return "Kamera";
  }

  if (source === "manual") {
    return "Input Manual";
  }

  return "Belum ada";
}

function QrLogSkeleton() {
  const skeletonItems = ["alpha", "beta", "gamma", "delta"] as const;

  return (
    <div className="space-y-3" aria-hidden="true">
      {skeletonItems.map((item) => (
        <div
          key={`qr-log-skeleton-${item}`}
          className="rounded-2xl border border-zinc-800 bg-linear-to-br from-zinc-950/75 to-zinc-900/70 p-3 shadow-sm shadow-black/10"
        >
          <div className="animate-pulse space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-2">
                <div className="h-4 w-32 rounded-full bg-zinc-800/90" />
                <div className="h-3 w-20 rounded-full bg-zinc-900" />
              </div>
              <div className="h-6 w-20 rounded-full bg-zinc-800/90" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <div className="h-3 w-16 rounded-full bg-zinc-900" />
                <div className="h-3 w-12 rounded-full bg-zinc-800/90" />
              </div>
              <div className="space-y-2">
                <div className="h-3 w-16 rounded-full bg-zinc-900" />
                <div className="h-3 w-12 rounded-full bg-zinc-800/90" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function QRScannerView() {
  const isDesktopRuntime = isTauri();
  const scannerElementId = useId().replace(/:/g, "-");
  const manualInputRef = useRef<HTMLTextAreaElement | null>(null);
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
  const [lastScanSource, setLastScanSource] = useState<
    "camera" | "manual" | null
  >(null);
  const [lastScanAttemptAt, setLastScanAttemptAt] = useState<Date | null>(null);
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

  async function processQrPayload(
    rawQrValue: string,
    source: "camera" | "manual",
  ) {
    const normalized = rawQrValue.trim();
    if (!normalized) {
      if (source === "manual") {
        toast.error("Isi data QR terlebih dahulu");
      }
      return;
    }

    if (source === "camera" && lockRef.current) {
      return;
    }

    lockRef.current = true;
    setLastScanSource(source);
    setLastScanAttemptAt(new Date());
    if (source === "camera") {
      setScanningStatus("scanned");
    }
    try {
      const result = await submitQrScan(normalized);
      if (result.success) {
        toast.success(result.message);
        if (source === "manual") {
          setManualInput("");
        }
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
        if (source === "camera") {
          setScanningStatus("idle");
        }
      }, 1200);
    }
  }

  async function handleScan(decodedText: string) {
    await processQrPayload(decodedText, "camera");
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
    await processQrPayload(manualInput, "manual");
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
  const cameraErrorMeta = cameraError
    ? getCameraErrorMeta(cameraError, isDesktopRuntime)
    : null;
  const lastScanMetaLabel =
    lastScanAttemptAt instanceof Date
      ? formatTime(lastScanAttemptAt)
      : formatTime(new Date());

  return (
    <div className="space-y-5">
      <InlineState
        title="QR Attendance aktif dengan alur baru"
        description="Alur QR sekarang memakai route handler backend yang tervalidasi. Kamera bisa dipakai langsung, dan input manual tetap tersedia untuk desktop testing atau scanner eksternal."
        variant="info"
      />

      <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-5 rounded-3xl border border-zinc-800 bg-linear-to-br from-zinc-900/55 to-zinc-950/75 p-5 shadow-sm shadow-black/10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h3 className="flex items-center gap-2 text-lg font-semibold text-zinc-100">
                <QrCode className="h-5 w-5 text-emerald-400" />
                Scanner QR
              </h3>
              <p className="text-sm text-zinc-400">
                {scannerRuntimeDescription}
              </p>
            </div>

            <div className="flex w-full sm:w-auto items-center gap-2">
              {cameraActive ? (
                <Button
                  type="button"
                  variant="default"
                  onClick={() => {
                    void stopScanner();
                  }}
                  className="h-11 w-full sm:w-auto rounded-xl border border-red-500/35 bg-linear-to-br from-red-500/22 to-red-600/14 px-4 !text-white shadow-sm shadow-red-950/30 transition-all duration-200 hover:-translate-y-0.5 hover:border-red-400/60 hover:from-red-500/28 hover:to-red-600/18 hover:!text-white hover:shadow-md hover:shadow-red-950/40"
                >
                  <CameraOff className="mr-2 h-4 w-4 !text-red-100" />
                  <span className="!text-white">Matikan Kamera</span>
                </Button>
              ) : (
                <Button
                  type="button"
                  onClick={() => {
                    void startScanner();
                  }}
                  disabled={startingCamera || submitting}
                  className="h-11 w-full sm:w-auto rounded-xl border border-emerald-500/35 bg-linear-to-br from-emerald-500 to-emerald-600 px-4 !text-white shadow-sm shadow-emerald-950/30 transition-all duration-200 hover:-translate-y-0.5 hover:from-emerald-400 hover:to-emerald-500 hover:shadow-md hover:shadow-emerald-950/40"
                >
                  {startingCamera ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Camera className="mr-2 h-4 w-4" />
                  )}
                  <span className="!text-white">Nyalakan Kamera</span>
                </Button>
              )}
            </div>
          </div>

          <div className="grid gap-2 sm:flex sm:flex-wrap">
            <span className="inline-flex rounded-full border border-cyan-500/25 bg-cyan-500/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-100">
              {scannerRuntimeLabel}
            </span>
            <span
              className={`inline-flex rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] ${cameraStatus.className}`}
            >
              {cameraStatus.label}
            </span>
            <span className="inline-flex rounded-full border border-zinc-700 bg-zinc-900/80 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-200">
              Input manual siap
            </span>
          </div>

          {cameraErrorMeta ? (
            <div className="space-y-3">
              <InlineState
                title={cameraErrorMeta.title}
                description={cameraErrorMeta.description}
                variant="warning"
                actionLabel="Coba Lagi Kamera"
                onAction={() => {
                  void startScanner();
                }}
              />
              <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-amber-50">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-300" />
                  <div className="space-y-2">
                    <p className="font-medium text-amber-100">
                      Langkah recovery cepat
                    </p>
                    <ul className="space-y-1 text-xs leading-5 text-amber-100/80">
                      {cameraErrorMeta.tips.map((tip) => (
                        <li key={tip}>• {tip}</li>
                      ))}
                    </ul>
                    <div className="grid gap-2 pt-1 sm:flex sm:flex-wrap">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => manualInputRef.current?.focus()}
                        className="w-full sm:w-auto border-amber-400/30 bg-transparent text-amber-100 hover:bg-amber-500/10"
                      >
                        Fokus ke Input Manual
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setCameraError(null);
                          void stopScanner();
                        }}
                        className="w-full sm:w-auto border-amber-400/20 bg-transparent text-amber-100/90 hover:bg-amber-500/10"
                      >
                        Tutup Pesan Error
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
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
              <div
                className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-300"
                aria-live="polite"
              >
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
              Input QR manual
            </label>
            <textarea
              id="manual-qr-input"
              ref={manualInputRef}
              value={manualInput}
              onChange={(event) => setManualInput(event.target.value)}
              placeholder='Contoh: {"nis":"2324.10.001"} atau token kartu'
              className="min-h-24 w-full rounded-2xl border border-zinc-800 bg-zinc-950/90 px-4 py-3 text-sm text-zinc-100 outline-none transition-all duration-200 placeholder:text-zinc-600 hover:border-emerald-500/30 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
            />
            <div className="grid gap-2 sm:flex sm:flex-wrap sm:justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setManualInput("");
                  manualInputRef.current?.focus();
                }}
                disabled={submitting || manualInput.length === 0}
                className="h-11 w-full sm:w-auto rounded-xl border-zinc-700 bg-zinc-900/80 text-zinc-100 hover:bg-zinc-800"
              >
                Reset Input
              </Button>
              <Button
                type="button"
                onClick={() => {
                  void submitManualQr();
                }}
                disabled={submitting}
                className="h-11 w-full sm:w-auto rounded-xl border border-blue-400/35 bg-linear-to-br from-blue-500 to-cyan-500 px-4 !text-white shadow-sm shadow-blue-950/30 transition-all duration-200 hover:-translate-y-0.5 hover:from-blue-400 hover:to-cyan-400 hover:shadow-md hover:shadow-blue-950/40"
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
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="flex items-center gap-2 text-lg font-semibold text-zinc-100">
                <CheckCircle2 className="h-5 w-5 text-blue-400" />
                Hasil Scan Terakhir
              </h3>
            </div>

            {lastResult ? (
              <div
                className={`rounded-3xl border p-4 shadow-sm ${scanResultTone}`}
                aria-live="polite"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
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
                  <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/40 px-3 py-2 text-left text-xs text-zinc-400 sm:text-right">
                    <p className="uppercase tracking-[0.16em] text-zinc-500">
                      Pembaruan
                    </p>
                    <p className="mt-1 text-sm font-semibold text-zinc-100">
                      {lastResult.data?.time || lastScanMetaLabel}
                    </p>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/35 px-3 py-2 text-xs text-zinc-400">
                    <p className="uppercase tracking-[0.16em] text-zinc-500">
                      Sumber Scan
                    </p>
                    <p className="mt-1 text-sm font-semibold text-zinc-100">
                      {getScanSourceLabel(lastScanSource)}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-zinc-800/80 bg-zinc-950/35 px-3 py-2 text-xs text-zinc-400">
                    <p className="uppercase tracking-[0.16em] text-zinc-500">
                      Status Flow
                    </p>
                    <p
                      className={cn(
                        "mt-1 text-sm font-semibold",
                        lastResult.success
                          ? "text-emerald-200"
                          : "text-red-200",
                      )}
                    >
                      {lastResult.success
                        ? "Tersimpan dan log diperbarui"
                        : "Ditolak sebelum menulis attendance"}
                    </p>
                  </div>
                </div>
                {lastResult.data ? (
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div className="space-y-3 rounded-2xl border border-zinc-800/80 bg-zinc-950/35 p-3 text-sm text-zinc-300">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.16em] text-zinc-500">
                          Data Siswa
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
                          Detail Pemindaian
                        </p>
                        <p>
                          Jenis:{" "}
                          <span className="font-medium text-zinc-100">
                            {lastResult.data.type === "in" ? "Masuk" : "Pulang"}
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
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-lg font-semibold text-zinc-100">
                Log Hari Ini
              </h3>
              <Button
                type="button"
                variant="default"
                onClick={() => {
                  void loadTodayLogs();
                }}
                className="h-11 w-full sm:w-auto rounded-xl border border-sky-500/35 bg-linear-to-br from-sky-500/22 to-sky-600/14 px-4 !text-white shadow-sm shadow-sky-950/30 transition-all duration-200 hover:-translate-y-0.5 hover:border-sky-400/60 hover:from-sky-500/28 hover:to-sky-600/18 hover:!text-white hover:shadow-md hover:shadow-sky-950/40"
              >
                <RefreshCw className="mr-2 h-4 w-4 !text-sky-100" />
                <span className="!text-white">Muat Ulang</span>
              </Button>
            </div>

            {loadingLogs ? (
              <div className="rounded-3xl border border-dashed border-zinc-800/80 bg-zinc-950/35 p-3">
                <QrLogSkeleton />
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
                        <p className="text-zinc-500">Masuk</p>
                        <p className="mt-1 font-medium text-zinc-200">
                          {formatTime(log.checkInTime)}
                        </p>
                      </div>
                      <div>
                        <p className="text-zinc-500">Pulang</p>
                        <p className="mt-1 font-medium text-zinc-200">
                          {formatTime(log.checkOutTime)}
                        </p>
                      </div>
                      <div>
                        <p className="text-zinc-500">Durasi Terlambat</p>
                        <p className="mt-1 font-medium text-zinc-200">
                          {log.lateDuration ? `${log.lateDuration} menit` : "-"}
                        </p>
                      </div>
                      <div>
                        <p className="text-zinc-500">Sinkronisasi</p>
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
