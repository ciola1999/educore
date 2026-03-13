// src\components\attendance\qr-scanner-view.tsx

"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Html5Qrcode } from "html5-qrcode";
import { Loader2, Scan, User } from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  processQRScan,
  type ScanResult,
} from "@/core/services/attendance-service";

export function QRScannerView() {
  const [result, setResult] = useState<ScanResult | null>(null);
  const [processing, setProcessing] = useState(false);
  const [isScannerReady, setIsScannerReady] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isProcessingRef = useRef(false);

  const handleScan = useCallback(async (decodedText: string) => {
    if (isProcessingRef.current) return;

    isProcessingRef.current = true;
    setProcessing(true);

    try {
      const res = await processQRScan(decodedText);
      setResult(res);
      if (res.success) {
        toast.success(res.message);
      } else {
        toast.error(res.message);
      }
    } catch (_) {
      toast.error("Terjadi kesalahan sistem");
    } finally {
      // Artificial delay to prevent instant re-scans
      setTimeout(() => {
        setProcessing(false);
        isProcessingRef.current = false;
      }, 2500);

      // Clear display after 5 seconds
      setTimeout(() => setResult(null), 5000);
    }
  }, []);

  useEffect(() => {
    const startScanner = async () => {
      try {
        // Create new instance
        const html5QrCode = new Html5Qrcode("reader");
        scannerRef.current = html5QrCode;

        const config = {
          fps: 15,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
        };

        await html5QrCode.start(
          { facingMode: "user" }, // Usually front cam for laptop
          config,
          handleScan,
          () => {}, // silent on errors
        );

        setIsScannerReady(true);
      } catch (err) {
        console.error("Scanner init failed:", err);
        // Fallback for cases where front camera is not exactly "user"
        try {
          if (scannerRef.current) {
            await scannerRef.current.start(
              { facingMode: "environment" },
              { fps: 15, qrbox: { width: 250, height: 250 } },
              handleScan,
              () => {},
            );
            setIsScannerReady(true);
          }
        } catch (_) {
          toast.error("Gagal mengakses kamera");
        }
      }
    };

    startScanner();

    return () => {
      if (scannerRef.current?.isScanning) {
        scannerRef.current
          .stop()
          .then(() => {
            scannerRef.current?.clear();
          })
          .catch((err) => console.error("Failed to stop scanner", err));
      }
    };
  }, [handleScan]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start py-6">
      {/* Scanner UI */}
      <div className="space-y-6">
        <div className="relative rounded-[2rem] overflow-hidden border-2 border-zinc-800 shadow-[0_0_50px_rgba(0,0,0,0.5)] bg-black aspect-square max-w-[450px] mx-auto group ring-1 ring-zinc-700/50">
          {/* Internal Camera Container */}
          <div id="reader" className="w-full h-full object-cover"></div>

          {/* Precision Overlay */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            {/* Dark corners / mask Effect */}
            <div
              className="absolute inset-0 bg-black/40 z-10"
              style={{
                clipPath:
                  "polygon(0% 0%, 0% 100%, 50% 100%, 50% 50%, 50% 50%, 50% 100%, 100% 100%, 100% 0%)",
              }}
            ></div>

            {/* Scan Box Frame - Matched with 250px qrbox */}
            <div className="w-[250px] h-[250px] border-2 border-emerald-500/50 rounded-3xl relative z-20 transition-all duration-500 group-hover:scale-105">
              {/* Corner Accents */}
              <div className="absolute -top-1 -left-1 w-6 h-6 border-t-4 border-l-4 border-emerald-500 rounded-tl-xl" />
              <div className="absolute -top-1 -right-1 w-6 h-6 border-t-4 border-r-4 border-emerald-500 rounded-tr-xl" />
              <div className="absolute -bottom-1 -left-1 w-6 h-6 border-b-4 border-l-4 border-emerald-500 rounded-bl-xl" />
              <div className="absolute -bottom-1 -right-1 w-6 h-6 border-b-4 border-r-4 border-emerald-500 rounded-br-xl" />

              {/* Moving Line */}
              <div className="absolute top-0 left-0 w-full h-1 bg-linear-to-r from-transparent via-emerald-400 to-transparent animate-scan shadow-[0_0_15px_rgba(52,211,153,0.5)]" />
            </div>
          </div>

          {!isScannerReady && (
            <div className="absolute inset-0 bg-zinc-950 flex flex-col items-center justify-center z-40">
              <Loader2 className="h-10 w-10 animate-spin text-zinc-500 mb-4" />
              <p className="text-zinc-500 font-mono text-xs uppercase tracking-widest">
                Initialising Camera...
              </p>
            </div>
          )}

          {processing && (
            <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-md flex flex-col items-center justify-center z-50 animate-in fade-in duration-300">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex flex-col items-center"
              >
                <div className="relative mb-6">
                  <div className="absolute inset-0 bg-blue-500/20 blur-2xl rounded-full" />
                  <Loader2 className="h-16 w-16 animate-spin text-blue-500 relative" />
                </div>
                <p className="text-white font-black uppercase tracking-[0.3em] text-xs">
                  Authenticating...
                </p>
              </motion.div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-4 justify-center py-2 px-6 rounded-2xl bg-zinc-900/50 border border-zinc-800 w-fit mx-auto">
          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
            Scanner Active & Waiting
          </p>
        </div>
      </div>

      {/* Feedback Display */}
      <div className="min-h-[450px] flex flex-col items-center justify-center">
        <AnimatePresence mode="wait">
          {!result ? (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="text-center space-y-10"
            >
              <div className="relative group">
                <div className="absolute inset-0 bg-zinc-400/5 blur-3xl rounded-full group-hover:bg-blue-400/10 transition-colors duration-700" />
                <div className="w-56 h-56 rounded-[3rem] bg-zinc-900/40 border border-zinc-800/50 flex items-center justify-center mx-auto relative backdrop-blur-sm shadow-inner transition-transform duration-500 group-hover:rotate-3">
                  <Scan className="h-24 w-24 text-zinc-700 group-hover:text-zinc-500 transition-colors" />
                </div>
              </div>
              <div className="space-y-4 px-6">
                <h2 className="text-4xl font-black text-white tracking-tighter">
                  READY
                </h2>
                <p className="text-zinc-500 text-lg leading-relaxed max-w-[280px] mx-auto">
                  Position your card QR code within the frame to scan.
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="result"
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 1.1 }}
              transition={{ type: "spring", damping: 20 }}
              className={`w-full max-w-sm p-1 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.7)] rounded-[3rem] overflow-hidden ${
                result.success
                  ? "bg-linear-to-b from-emerald-500/20 to-transparent"
                  : "bg-linear-to-b from-red-500/20 to-transparent"
              }`}
            >
              <div className="bg-zinc-900/90 backdrop-blur-2xl p-10 rounded-[2.9rem] space-y-8 relative border border-white/5">
                {/* Status Badge */}
                <div
                  className={`absolute top-6 right-6 px-4 py-1.5 rounded-full text-[10px] font-black tracking-[0.2em] border ${
                    result.success
                      ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                      : "bg-red-500/10 border-red-500/20 text-red-400"
                  }`}
                >
                  {result.success ? "SUCCESS" : "DENIED"}
                </div>

                <div className="space-y-6">
                  {/* Photo & Name & Grade */}
                  <div className="flex flex-col items-center gap-6">
                    <div className="relative">
                      <div
                        className={`w-36 h-36 rounded-[2.5rem] p-1 border-2 ${result.success ? "border-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.2)]" : "border-red-500/50 shadow-[0_0_30px_rgba(239,68,68,0.2)]"}`}
                      >
                        <div className="w-full h-full rounded-[2.2rem] bg-zinc-800 flex items-center justify-center overflow-hidden">
                          {result.data?.photo ? (
                            <Image
                              src={result.data?.photo}
                              className="w-full h-full object-cover"
                              alt="User"
                              width={144}
                              height={144}
                            />
                          ) : (
                            <User
                              className={`h-16 w-16 ${result.success ? "text-emerald-500/30" : "text-red-500/30"}`}
                            />
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-center space-y-1">
                      <p className="text-zinc-500 text-[10px] font-black tracking-[0.3em] uppercase">
                        {result.data?.nis || "ID-UNSET"} •{" "}
                        {result.data?.grade || "KELAS UNSET"}
                      </p>
                      <h2 className="text-3xl font-black text-white tracking-tight">
                        {result.data?.fullName || "UNKNOWN"}
                      </h2>
                    </div>
                  </div>

                  {/* Details Grid - Diubah jadi 3 Kolom untuk menambah Tipe Absen */}
                  <div className="grid grid-cols-3 gap-px bg-zinc-800/50 rounded-3xl overflow-hidden border border-zinc-800/50 shadow-inner">
                    <div className="bg-zinc-900/50 p-2 sm:p-4 space-y-1 flex flex-col items-center justify-center text-center">
                      <p className="text-zinc-500 text-[8px] sm:text-[9px] font-black uppercase tracking-widest">
                        Waktu
                      </p>
                      <p className="text-sm sm:text-lg font-mono font-bold text-white">
                        {result.data?.time || "--:--"}
                      </p>
                    </div>

                    <div className="bg-zinc-900/50 p-2 sm:p-4 space-y-1 flex flex-col items-center justify-center text-center">
                      <p className="text-zinc-500 text-[8px] sm:text-[9px] font-black uppercase tracking-widest">
                        Tipe
                      </p>
                      <p className="text-sm sm:text-lg font-bold text-blue-400">
                        {result.data?.type === "out" ? "PULANG" : "MASUK"}
                      </p>
                    </div>

                    <div className="bg-zinc-900/50 p-2 sm:p-4 space-y-1 flex flex-col items-center justify-center text-center">
                      <p className="text-zinc-500 text-[8px] sm:text-[9px] font-black uppercase tracking-widest">
                        Status
                      </p>
                      <p
                        /* Perbaikan: Menggunakan text-xs/sm di mobile agar "TERLAMBAT" tidak terpotong */
                        className={`text-xs sm:text-base font-bold tracking-tight ${result.data?.status === "late" ? "text-red-400" : "text-emerald-400"}`}
                      >
                        {result.data?.status === "on-time"
                          ? "ON-TIME"
                          : result.data?.status === "late"
                            ? "TERLAMBAT"
                            : "OK"}
                      </p>
                    </div>
                  </div>

                  {/* Message Banner */}
                  <div
                    className={`p-5 rounded-2xl text-center font-bold text-sm tracking-tight ${
                      result.success
                        ? "bg-emerald-500/20 text-emerald-300"
                        : "bg-red-500/20 text-red-300"
                    }`}
                  >
                    {result.message}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <style jsx global>{`
        #reader video {
          object-fit: cover !important;
          border-radius: 2rem !important;
        }
        #reader {
          border: none !important;
        }
        .animate-scan {
          animation: scan 2s linear infinite;
        }
        @keyframes scan {
          0%, 100% { top: 0% }
          50% { top: 100% }
        }
      `}</style>
    </div>
  );
}
