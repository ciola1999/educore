"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/api/request";

export type QrScanResult = {
  success: boolean;
  message: string;
  type: "CHECK_IN" | "CHECK_OUT" | "ERROR";
  data?: {
    fullName: string;
    nis: string;
    grade: string;
    time: string;
    status: "on-time" | "late";
    type: "in" | "out";
    lateMinutes: number;
    photo?: string;
  };
};

export type TodayAttendanceLog = {
  id: string;
  studentId: string;
  snapshotStudentName: string | null;
  snapshotStudentNis: string | null;
  date: string;
  checkInTime: string | Date | null;
  checkOutTime: string | Date | null;
  status: "PRESENT" | "LATE" | "EXCUSED" | "ABSENT";
  lateDuration: number | null;
  syncStatus: "synced" | "pending" | "error";
};

export type QrAttendanceOptions = {
  onSuccess?: (result: QrScanResult) => void;
  onError?: (error: Error) => void;
};

export function useQrAttendance(options: QrAttendanceOptions = {}) {
  const [submitting, setSubmitting] = useState(false);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logs, setLogs] = useState<TodayAttendanceLog[]>([]);
  const [lastResult, setLastResult] = useState<QrScanResult | null>(null);

  const loadTodayLogs = useCallback(async () => {
    setLoadingLogs(true);
    try {
      const data = await apiGet<TodayAttendanceLog[]>("/api/attendance/today");
      setLogs(data);
    } finally {
      setLoadingLogs(false);
    }
  }, []);

  async function submitQrScan(qrData: string) {
    setSubmitting(true);
    try {
      const result = await apiPost<QrScanResult>("/api/attendance/scan", {
        qrData,
      });
      setLastResult(result);
      await loadTodayLogs();
      if (result.success && options.onSuccess) {
        options.onSuccess(result);
      }
      return result;
    } catch (error) {
      const fallbackResult: QrScanResult = {
        success: false,
        message:
          error instanceof Error ? error.message : "Gagal memproses QR scan",
        type: "ERROR",
      };
      setLastResult(fallbackResult);
      if (options.onError && error instanceof Error) {
        options.onError(error);
      }
      throw error;
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    void loadTodayLogs();
  }, [loadTodayLogs]);

  return {
    submitting,
    loadingLogs,
    logs,
    lastResult,
    loadTodayLogs,
    submitQrScan,
  };
}
