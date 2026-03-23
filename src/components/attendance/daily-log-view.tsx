"use client";

import {
  CalendarRange,
  Download,
  FileText,
  Loader2,
  Printer,
  Search,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isTauri } from "@/core/env";
import { useAuth } from "@/hooks/use-auth";
import { apiGet, apiPost, apiPut } from "@/lib/api/request";
import { exportRowsToXlsx } from "@/lib/export/xlsx";
import { InlineState } from "../common/inline-state";

type TodayAttendanceLog = {
  id: string;
  studentId: string;
  snapshotStudentName: string | null;
  snapshotStudentNis: string | null;
  className?: string | null;
  date: string;
  checkInTime: string | Date | null;
  checkOutTime: string | Date | null;
  status: "PRESENT" | "LATE" | "EXCUSED" | "ABSENT";
  lateDuration: number | null;
  notes?: string | null;
  syncStatus: "synced" | "pending" | "error";
  source?: "qr" | "manual";
};

type HistoryFilterStatus =
  | "all"
  | "present"
  | "late"
  | "sick"
  | "permission"
  | "alpha";

type AttendanceHistoryResponse = {
  data: TodayAttendanceLog[];
  total: number;
  limit: number;
  offset: number;
};

type AttendanceHistorySummary = {
  total: number;
  present: number;
  late: number;
  excused: number;
  absent: number;
  qr: number;
  manual: number;
};

type AttendanceHistoryClassSummary = {
  className: string;
  total: number;
  present: number;
  late: number;
  excused: number;
  absent: number;
  qr: number;
  manual: number;
  attendanceRate: number;
};

type AttendanceHistoryStudentSummary = {
  studentId: string;
  studentName: string;
  nis: string;
  className: string;
  total: number;
  present: number;
  late: number;
  excused: number;
  absent: number;
  qr: number;
  manual: number;
  attendanceRate: number;
};

type AttendanceHistoryTrendPoint = {
  label: string;
  period: string;
  total: number;
  present: number;
  late: number;
  excused: number;
  absent: number;
  attendanceRate: number;
};

type AttendanceHistoryHeatmapPoint = {
  date: string;
  dayLabel: string;
  total: number;
  present: number;
  late: number;
  excused: number;
  absent: number;
  attendanceRate: number;
};

type AttendanceRiskSettings = {
  alphaThreshold: number;
  lateThreshold: number;
  rateThreshold: number;
};

type AttendanceRiskFollowUpHistoryItem = {
  id: string;
  judul: string;
  pesan: string;
  link: string | null;
  isRead: boolean;
  createdAt: string | Date;
};

type HistorySourceFilter = "all" | "qr" | "manual";
type HistoryGroupBy = "none" | "date" | "class";

type StudentOption = {
  id: string;
  fullName: string;
  nis: string;
  grade: string;
};

type StudentOptionsResponse = {
  data: StudentOption[];
};

type DailyLogViewProps = {
  initialTab?: "today" | "history";
  initialStudentId?: string;
  initialStartDate?: string;
  initialEndDate?: string;
};

function formatTime(value: string | Date | null) {
  if (!value) return "-";
  return new Date(value).toLocaleTimeString("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatStatusLabel(status: TodayAttendanceLog["status"]) {
  switch (status) {
    case "PRESENT":
      return "Hadir";
    case "LATE":
      return "Terlambat";
    case "EXCUSED":
      return "Izin/Sakit";
    case "ABSENT":
      return "Alpha";
    default:
      return status;
  }
}

function getTodayDateString() {
  return new Date().toISOString().slice(0, 10);
}

function getMonthStartDateString() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
}

function getDaysAgoDateString(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

export function DailyLogView({
  initialTab = "today",
  initialStudentId,
  initialStartDate,
  initialEndDate,
}: DailyLogViewProps) {
  const { user } = useAuth();
  const isStudentView = user?.role === "student";
  const isAdminView = user?.role === "admin" || user?.role === "super_admin";
  const [activeTab, setActiveTab] = useState<"today" | "history">(initialTab);
  const [todayLogs, setTodayLogs] = useState<TodayAttendanceLog[]>([]);
  const [historyLogs, setHistoryLogs] = useState<TodayAttendanceLog[]>([]);
  const [loadingToday, setLoadingToday] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historySearch, setHistorySearch] = useState("");
  const [historyStatus, setHistoryStatus] =
    useState<HistoryFilterStatus>("all");
  const [historySource, setHistorySource] =
    useState<HistorySourceFilter>("all");
  const [historyGroupBy, setHistoryGroupBy] = useState<HistoryGroupBy>("none");
  const [historySort, setHistorySort] = useState("latest");
  const [historyStudentSearch, setHistoryStudentSearch] = useState("");
  const [historyStudentOptions, setHistoryStudentOptions] = useState<
    StudentOption[]
  >([]);
  const [selectedHistoryStudentId, setSelectedHistoryStudentId] = useState(
    initialStudentId || "all",
  );
  const [loadingStudentOptions, setLoadingStudentOptions] = useState(false);
  const [historyStartDate, setHistoryStartDate] = useState(
    initialStartDate || "",
  );
  const [historyEndDate, setHistoryEndDate] = useState(initialEndDate || "");
  const [historyOffset, setHistoryOffset] = useState(0);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historySummary, setHistorySummary] =
    useState<AttendanceHistorySummary | null>(null);
  const [historyClassSummary, setHistoryClassSummary] = useState<
    AttendanceHistoryClassSummary[]
  >([]);
  const [historyStudentSummary, setHistoryStudentSummary] = useState<
    AttendanceHistoryStudentSummary[]
  >([]);
  const [historyTrend, setHistoryTrend] = useState<
    AttendanceHistoryTrendPoint[]
  >([]);
  const [historyHeatmap, setHistoryHeatmap] = useState<
    AttendanceHistoryHeatmapPoint[]
  >([]);
  const [analyticsClassFilter, setAnalyticsClassFilter] = useState("all");
  const [compareClassA, setCompareClassA] = useState("none");
  const [compareClassB, setCompareClassB] = useState("none");
  const [riskAlphaThreshold, setRiskAlphaThreshold] = useState("3");
  const [riskLateThreshold, setRiskLateThreshold] = useState("5");
  const [riskRateThreshold, setRiskRateThreshold] = useState("75");
  const [savingRiskSettings, setSavingRiskSettings] = useState(false);
  const [creatingFollowUpId, setCreatingFollowUpId] = useState<string | null>(
    null,
  );
  const [followUpNote, setFollowUpNote] = useState("");
  const [followUpDeadline, setFollowUpDeadline] = useState("");
  const [followUpHistory, setFollowUpHistory] = useState<
    AttendanceRiskFollowUpHistoryItem[]
  >([]);
  const [exportingHistory, setExportingHistory] = useState(false);
  const [exportingClassSummary, setExportingClassSummary] = useState(false);
  const [exportingStudentSummary, setExportingStudentSummary] = useState(false);
  const [exportingRiskRanking, setExportingRiskRanking] = useState(false);
  const [exportingAnalyticsReport, setExportingAnalyticsReport] =
    useState(false);
  const [exportingCompareReport, setExportingCompareReport] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [printingReport, setPrintingReport] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const historyLimit = 20;

  const dateRangeInvalid =
    Boolean(historyStartDate) &&
    Boolean(historyEndDate) &&
    historyStartDate > historyEndDate;

  const loadTodayLogs = useCallback(async () => {
    setLoadingToday(true);
    setError(null);
    try {
      const data = await apiGet<TodayAttendanceLog[]>("/api/attendance/today");
      setTodayLogs(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Gagal memuat log attendance hari ini",
      );
    } finally {
      setLoadingToday(false);
    }
  }, []);

  const loadHistoryLogs = useCallback(async () => {
    setLoadingHistory(true);
    setError(null);
    try {
      if (dateRangeInvalid) {
        setHistoryLogs([]);
        setHistoryTotal(0);
        setError("Tanggal mulai tidak boleh lebih besar dari tanggal akhir");
        return;
      }

      const params = new URLSearchParams({
        limit: String(historyLimit),
        offset: String(historyOffset),
        sortBy: historySort,
      });
      if (isStudentView && user?.id) params.set("studentId", user.id);
      if (!isStudentView && selectedHistoryStudentId !== "all") {
        params.set("studentId", selectedHistoryStudentId);
      }
      if (historySearch.trim()) params.set("searchQuery", historySearch.trim());
      if (historyStatus !== "all") params.set("status", historyStatus);
      if (historySource !== "all") params.set("source", historySource);
      if (historyStartDate) params.set("startDate", historyStartDate);
      if (historyEndDate) params.set("endDate", historyEndDate);
      const classSummaryParams = new URLSearchParams(params);
      classSummaryParams.set("classSummary", "true");
      if (analyticsClassFilter !== "all") {
        params.set("className", analyticsClassFilter);
      }
      const summaryParams = new URLSearchParams(params);
      summaryParams.set("summary", "true");
      const studentSummaryParams = new URLSearchParams(params);
      studentSummaryParams.set("studentSummary", "true");
      const trendParams = new URLSearchParams(params);
      trendParams.set("trend", "true");
      const heatmapParams = new URLSearchParams(params);
      heatmapParams.set("heatmap", "true");

      const requests: [
        Promise<AttendanceHistoryResponse>,
        Promise<AttendanceHistorySummary>,
        Promise<AttendanceHistoryClassSummary[] | null>,
        Promise<AttendanceHistoryStudentSummary[]>,
        Promise<AttendanceHistoryTrendPoint[]>,
        Promise<AttendanceHistoryHeatmapPoint[]>,
      ] = [
        apiGet<AttendanceHistoryResponse>(
          `/api/attendance/history?${params.toString()}`,
        ),
        apiGet<AttendanceHistorySummary>(
          `/api/attendance/history?${summaryParams.toString()}`,
        ),
        isAdminView && selectedHistoryStudentId === "all"
          ? apiGet<AttendanceHistoryClassSummary[]>(
              `/api/attendance/history?${classSummaryParams.toString()}`,
            )
          : Promise.resolve(null),
        apiGet<AttendanceHistoryStudentSummary[]>(
          `/api/attendance/history?${studentSummaryParams.toString()}`,
        ),
        apiGet<AttendanceHistoryTrendPoint[]>(
          `/api/attendance/history?${trendParams.toString()}`,
        ),
        apiGet<AttendanceHistoryHeatmapPoint[]>(
          `/api/attendance/history?${heatmapParams.toString()}`,
        ),
      ];

      const [result, summary, classSummary, studentSummary, trend, heatmap] =
        await Promise.all(requests);
      setHistoryLogs(result.data);
      setHistoryTotal(result.total);
      setHistorySummary(summary);
      setHistoryClassSummary(classSummary ?? []);
      setHistoryStudentSummary(studentSummary);
      setHistoryTrend(trend);
      setHistoryHeatmap(heatmap);
    } catch (err) {
      setHistorySummary(null);
      setHistoryClassSummary([]);
      setHistoryStudentSummary([]);
      setHistoryTrend([]);
      setHistoryHeatmap([]);
      setError(
        err instanceof Error ? err.message : "Gagal memuat riwayat attendance",
      );
    } finally {
      setLoadingHistory(false);
    }
  }, [
    dateRangeInvalid,
    historyEndDate,
    historyOffset,
    historySearch,
    historySort,
    historySource,
    historyStartDate,
    historyStatus,
    analyticsClassFilter,
    isAdminView,
    isStudentView,
    selectedHistoryStudentId,
    user?.id,
  ]);

  useEffect(() => {
    void loadTodayLogs();
  }, [loadTodayLogs]);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (initialStudentId) {
      setSelectedHistoryStudentId(initialStudentId);
    }
  }, [initialStudentId]);

  useEffect(() => {
    if (initialStartDate) {
      setHistoryStartDate(initialStartDate);
    }
  }, [initialStartDate]);

  useEffect(() => {
    if (initialEndDate) {
      setHistoryEndDate(initialEndDate);
    }
  }, [initialEndDate]);

  useEffect(() => {
    if (!isAdminView) {
      setHistoryStudentOptions([]);
      if (isStudentView && user?.id) {
        setSelectedHistoryStudentId(user.id);
      } else {
        setSelectedHistoryStudentId("all");
      }
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setLoadingStudentOptions(true);
      const params = new URLSearchParams({
        page: "1",
        limit: "20",
        sortBy: "fullName",
        sortDir: "asc",
      });
      if (historyStudentSearch.trim()) {
        params.set("search", historyStudentSearch.trim());
      }

      void apiGet<StudentOptionsResponse>(`/api/students?${params.toString()}`)
        .then((result) => {
          setHistoryStudentOptions(result.data);
        })
        .catch(() => {
          setHistoryStudentOptions([]);
        })
        .finally(() => {
          setLoadingStudentOptions(false);
        });
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [historyStudentSearch, isAdminView, isStudentView, user?.id]);

  useEffect(() => {
    void loadHistoryLogs();
  }, [loadHistoryLogs]);

  useEffect(() => {
    if (!isAdminView) {
      return;
    }

    void apiGet<AttendanceRiskSettings>("/api/attendance/risk-settings")
      .then((settings) => {
        setRiskAlphaThreshold(String(settings.alphaThreshold));
        setRiskLateThreshold(String(settings.lateThreshold));
        setRiskRateThreshold(String(settings.rateThreshold));
      })
      .catch(() => {
        // keep defaults if settings unavailable
      });
  }, [isAdminView]);

  useEffect(() => {
    if (!selectedHistoryStudentId || selectedHistoryStudentId === "all") {
      setFollowUpHistory([]);
      return;
    }

    void apiGet<AttendanceRiskFollowUpHistoryItem[]>(
      `/api/attendance/risk-followups/history?studentId=${selectedHistoryStudentId}`,
    )
      .then(setFollowUpHistory)
      .catch(() => {
        setFollowUpHistory([]);
      });
  }, [selectedHistoryStudentId]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset pagination whenever filters change
  useEffect(() => {
    setHistoryOffset(0);
  }, [
    historySearch,
    selectedHistoryStudentId,
    historyStatus,
    historySource,
    historySort,
    historyStartDate,
    historyEndDate,
  ]);

  async function handleExportHistory() {
    setExportingHistory(true);
    try {
      if (dateRangeInvalid) {
        toast.error("Tanggal mulai tidak boleh lebih besar dari tanggal akhir");
        return;
      }

      const params = new URLSearchParams({
        export: "true",
        offset: "0",
        sortBy: historySort,
      });
      if (isStudentView && user?.id) params.set("studentId", user.id);
      if (!isStudentView && selectedHistoryStudentId !== "all") {
        params.set("studentId", selectedHistoryStudentId);
      }
      if (historySearch.trim()) params.set("searchQuery", historySearch.trim());
      if (historyStatus !== "all") params.set("status", historyStatus);
      if (historySource !== "all") params.set("source", historySource);
      if (historyStartDate) params.set("startDate", historyStartDate);
      if (historyEndDate) params.set("endDate", historyEndDate);

      const result = await apiGet<AttendanceHistoryResponse>(
        `/api/attendance/history?${params.toString()}`,
      );

      if (result.data.length === 0) {
        toast.error("Tidak ada riwayat absensi untuk diekspor");
        return;
      }

      const rows = result.data.map((log) => ({
        Tanggal: log.date,
        Nama: log.snapshotStudentName || "-",
        NIS: log.snapshotStudentNis || "-",
        Kelas: log.className || "-",
        Status: formatStatusLabel(log.status),
        Sumber: log.source === "qr" ? "QR" : "Manual",
        "Check In": formatTime(log.checkInTime),
        "Check Out": formatTime(log.checkOutTime),
        "Durasi Terlambat (menit)": log.lateDuration ?? 0,
        Catatan: log.notes || "-",
      }));

      const selectedStudentLabel =
        selectedHistoryStudentId === "all"
          ? "all-students"
          : historyStudentOptions.find(
              (student) => student.id === selectedHistoryStudentId,
            )?.nis || selectedHistoryStudentId;

      await exportRowsToXlsx({
        fileName: `attendance-history-${selectedStudentLabel}-${historyStartDate || "recent"}-${historyEndDate || "latest"}-${historySource}-${historyStatus}.xlsx`,
        sheetName: "Attendance History",
        rows,
      });
      toast.success("Riwayat absensi berhasil diekspor");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal export riwayat absensi",
      );
    } finally {
      setExportingHistory(false);
    }
  }

  async function handleExportClassSummary() {
    setExportingClassSummary(true);
    try {
      if (historyClassSummary.length === 0) {
        toast.error("Tidak ada rekap kelas untuk diekspor");
        return;
      }

      await exportRowsToXlsx({
        fileName: `attendance-class-summary-${historyStartDate || "all"}-${historyEndDate || "all"}-${historySource}-${historyStatus}.xlsx`,
        sheetName: "Class Summary",
        rows: historyClassSummary.map((item) => ({
          Kelas: item.className,
          Total: item.total,
          Hadir: item.present,
          Terlambat: item.late,
          "Izin/Sakit": item.excused,
          Alpha: item.absent,
          QR: item.qr,
          Manual: item.manual,
          "Tingkat Hadir (%)": item.attendanceRate,
        })),
      });
      toast.success("Rekap kelas berhasil diekspor");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal export rekap kelas",
      );
    } finally {
      setExportingClassSummary(false);
    }
  }

  async function handleExportStudentSummary() {
    setExportingStudentSummary(true);
    try {
      if (historyStudentSummary.length === 0) {
        toast.error("Tidak ada rekap siswa untuk diekspor");
        return;
      }

      await exportRowsToXlsx({
        fileName: `attendance-student-summary-${historyStartDate || "all"}-${historyEndDate || "all"}-${analyticsClassFilter}-${historySource}-${historyStatus}.xlsx`,
        sheetName: "Student Summary",
        rows: historyStudentSummary.map((item) => ({
          Nama: item.studentName,
          NIS: item.nis,
          Kelas: item.className,
          Total: item.total,
          Hadir: item.present,
          Terlambat: item.late,
          "Izin/Sakit": item.excused,
          Alpha: item.absent,
          QR: item.qr,
          Manual: item.manual,
          "Tingkat Hadir (%)": item.attendanceRate,
        })),
      });
      toast.success("Rekap siswa berhasil diekspor");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal export rekap siswa",
      );
    } finally {
      setExportingStudentSummary(false);
    }
  }

  async function handleExportRiskRanking() {
    setExportingRiskRanking(true);
    try {
      const rows = [
        ...topLateStudents.map((item, index) => ({
          Kategori: "Terlambat",
          Ranking: index + 1,
          Nama: item.studentName,
          NIS: item.nis,
          Kelas: item.className,
          "Jumlah Terlambat": item.late,
          "Jumlah Alpha": item.absent,
          "Tingkat Hadir (%)": item.attendanceRate,
        })),
        ...topAbsentStudents.map((item, index) => ({
          Kategori: "Alpha",
          Ranking: index + 1,
          Nama: item.studentName,
          NIS: item.nis,
          Kelas: item.className,
          "Jumlah Terlambat": item.late,
          "Jumlah Alpha": item.absent,
          "Tingkat Hadir (%)": item.attendanceRate,
        })),
      ];

      if (rows.length === 0) {
        toast.error("Tidak ada ranking risiko untuk diekspor");
        return;
      }

      await exportRowsToXlsx({
        fileName: `attendance-risk-ranking-${historyStartDate || "all"}-${historyEndDate || "all"}-${analyticsClassFilter}.xlsx`,
        sheetName: "Risk Ranking",
        rows,
      });
      toast.success("Ranking risiko berhasil diekspor");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal export ranking risiko",
      );
    } finally {
      setExportingRiskRanking(false);
    }
  }

  async function handleExportAnalyticsReport() {
    setExportingAnalyticsReport(true);
    try {
      const rows = [
        ...historyTrend.map((item) => ({
          Bagian: "Trend",
          Label: item.label,
          Periode: item.period,
          Total: item.total,
          Hadir: item.present,
          Terlambat: item.late,
          "Izin/Sakit": item.excused,
          Alpha: item.absent,
          "Tingkat Hadir (%)": item.attendanceRate,
        })),
        ...historyHeatmap.map((item) => ({
          Bagian: "Heatmap",
          Label: item.dayLabel,
          Periode: item.date,
          Total: item.total,
          Hadir: item.present,
          Terlambat: item.late,
          "Izin/Sakit": item.excused,
          Alpha: item.absent,
          "Tingkat Hadir (%)": item.attendanceRate,
        })),
      ];

      if (rows.length === 0) {
        toast.error("Tidak ada trend atau heatmap untuk diekspor");
        return;
      }

      await exportRowsToXlsx({
        fileName: `attendance-analytics-${historyStartDate || "all"}-${historyEndDate || "all"}-${analyticsClassFilter}.xlsx`,
        sheetName: "Analytics",
        rows,
      });
      toast.success("Laporan analytics berhasil diekspor");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Gagal export laporan analytics",
      );
    } finally {
      setExportingAnalyticsReport(false);
    }
  }

  async function handleSaveRiskSettings() {
    setSavingRiskSettings(true);
    try {
      const saved = await apiPut<AttendanceRiskSettings>(
        "/api/attendance/risk-settings",
        {
          alphaThreshold: normalizedAlphaThreshold,
          lateThreshold: normalizedLateThreshold,
          rateThreshold: normalizedRateThreshold,
        },
      );

      setRiskAlphaThreshold(String(saved.alphaThreshold));
      setRiskLateThreshold(String(saved.lateThreshold));
      setRiskRateThreshold(String(saved.rateThreshold));
      toast.success("Threshold alert berhasil disimpan");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Gagal menyimpan threshold alert",
      );
    } finally {
      setSavingRiskSettings(false);
    }
  }

  async function handleCreateFollowUp(
    student: AttendanceHistoryStudentSummary,
  ) {
    setCreatingFollowUpId(student.studentId);
    try {
      const riskFlags: string[] = [];
      if (student.absent >= normalizedAlphaThreshold) {
        riskFlags.push(`Alpha >= ${normalizedAlphaThreshold}`);
      }
      if (student.late >= normalizedLateThreshold) {
        riskFlags.push(`Terlambat >= ${normalizedLateThreshold}`);
      }
      if (student.attendanceRate < normalizedRateThreshold) {
        riskFlags.push(`Rate < ${normalizedRateThreshold}%`);
      }

      await apiPost<{ success: true }>("/api/attendance/risk-followups", {
        studentId: student.studentId,
        studentName: student.studentName,
        nis: student.nis,
        className: student.className,
        riskFlags,
        note: followUpNote.trim() || undefined,
        deadline: followUpDeadline || null,
      });
      setFollowUpNote("");
      setFollowUpDeadline("");
      toast.success(`Tindak lanjut dibuat untuk ${student.studentName}`);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal membuat follow-up",
      );
    } finally {
      setCreatingFollowUpId(null);
    }
  }

  async function handleExportCompareReport() {
    setExportingCompareReport(true);
    try {
      if (!compareItemA || !compareItemB) {
        toast.error("Pilih dua kelas terlebih dahulu");
        return;
      }

      await exportRowsToXlsx({
        fileName: `attendance-compare-${compareItemA.className}-vs-${compareItemB.className}-${historyStartDate || "all"}-${historyEndDate || "all"}.xlsx`,
        sheetName: "Compare Classes",
        rows: [compareItemA, compareItemB].map((item) => ({
          Kelas: item.className,
          Total: item.total,
          Hadir: item.present,
          Terlambat: item.late,
          "Izin/Sakit": item.excused,
          Alpha: item.absent,
          QR: item.qr,
          Manual: item.manual,
          "Tingkat Hadir (%)": item.attendanceRate,
        })),
      });
      toast.success("Compare report berhasil diekspor");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Gagal export compare report",
      );
    } finally {
      setExportingCompareReport(false);
    }
  }

  function drillDownToStudent(student: AttendanceHistoryStudentSummary) {
    setActiveTab("history");
    setHistorySearch("");
    setHistoryOffset(0);
    setSelectedHistoryStudentId(student.studentId);
    toast.success(`Filter riwayat diarahkan ke ${student.studentName}`);
  }

  function drillDownToDate(date: string) {
    setActiveTab("history");
    setHistoryOffset(0);
    setHistoryStartDate(date);
    setHistoryEndDate(date);
    toast.success(`Riwayat difilter ke tanggal ${date}`);
  }

  async function handleExportHistoryPdf() {
    setExportingPdf(true);
    try {
      if (dateRangeInvalid) {
        toast.error("Tanggal mulai tidak boleh lebih besar dari tanggal akhir");
        return;
      }

      const params = new URLSearchParams({
        export: "true",
        offset: "0",
        sortBy: historySort,
      });
      if (isStudentView && user?.id) params.set("studentId", user.id);
      if (!isStudentView && selectedHistoryStudentId !== "all") {
        params.set("studentId", selectedHistoryStudentId);
      }
      if (historySearch.trim()) params.set("searchQuery", historySearch.trim());
      if (historyStatus !== "all") params.set("status", historyStatus);
      if (historySource !== "all") params.set("source", historySource);
      if (historyStartDate) params.set("startDate", historyStartDate);
      if (historyEndDate) params.set("endDate", historyEndDate);

      const result = await apiGet<AttendanceHistoryResponse>(
        `/api/attendance/history?${params.toString()}`,
      );

      if (result.data.length === 0) {
        toast.error("Tidak ada riwayat absensi untuk diekspor");
        return;
      }

      const [{ jsPDF }] = await Promise.all([import("jspdf")]);
      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
        compress: true,
      });

      const selectedStudentLabel =
        selectedHistoryStudentId === "all"
          ? "all-students"
          : historyStudentOptions.find(
              (student) => student.id === selectedHistoryStudentId,
            )?.nis || selectedHistoryStudentId;
      const fileName = `attendance-history-${selectedStudentLabel}-${historyStartDate || "all"}-${historyEndDate || "all"}.pdf`;

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;
      let y = margin;
      let pageNumber = 1;

      const drawHeader = () => {
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(14);
        pdf.text("EduCore Attendance History", margin, y);
        y += 7;

        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9);
        pdf.text(
          `Filter: ${historyStartDate || "awal"} s/d ${historyEndDate || "akhir"} | Status: ${historyStatus} | Sumber: ${historySource}`,
          margin,
          y,
        );
        y += 5;
        pdf.text(
          `Total: ${result.data.length} record | Dicetak halaman ${pageNumber}`,
          margin,
          y,
        );
        y += 8;

        pdf.setFont("helvetica", "bold");
        pdf.text("Tanggal", margin, y);
        pdf.text("Nama / NIS / Kelas", 35, y);
        pdf.text("Status", 145, y);
        pdf.text("Sumber", 175, y);
        pdf.text("In", 205, y);
        pdf.text("Out", 225, y);
        pdf.text("Catatan", 245, y);
        y += 3;
        pdf.line(margin, y, pageWidth - margin, y);
        y += 5;
      };

      drawHeader();

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);

      for (const log of result.data) {
        const note = (log.notes || "-").slice(0, 36);
        const identity = `${log.snapshotStudentName || "-"} / ${log.snapshotStudentNis || "-"} / ${log.className || "-"}`;
        const rows = [
          { x: margin, value: log.date },
          { x: 35, value: identity.slice(0, 62) },
          { x: 145, value: formatStatusLabel(log.status) },
          { x: 175, value: log.source === "qr" ? "QR" : "Manual" },
          { x: 205, value: formatTime(log.checkInTime) },
          { x: 225, value: formatTime(log.checkOutTime) },
          { x: 245, value: note },
        ];

        if (y > pageHeight - 12) {
          pdf.addPage();
          pageNumber += 1;
          y = margin;
          drawHeader();
          pdf.setFont("helvetica", "normal");
          pdf.setFontSize(8);
        }

        for (const row of rows) {
          pdf.text(String(row.value), row.x, y);
        }
        y += 5;
      }

      const pdfArrayBuffer = pdf.output("arraybuffer");
      if (isTauri()) {
        const [{ save }, { writeFile }] = await Promise.all([
          import("@tauri-apps/plugin-dialog"),
          import("@tauri-apps/plugin-fs"),
        ]);
        const filePath = await save({
          defaultPath: fileName,
          filters: [{ name: "PDF", extensions: ["pdf"] }],
        });

        if (!filePath) {
          toast.info("Simpan PDF dibatalkan.");
          return;
        }

        await writeFile(filePath, new Uint8Array(pdfArrayBuffer));
        toast.success("PDF riwayat absensi berhasil disimpan.");
        return;
      }

      const blob = new Blob([pdfArrayBuffer], { type: "application/pdf" });
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = fileName;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(objectUrl);

      toast.success("PDF riwayat absensi berhasil diunduh.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Gagal export PDF riwayat absensi",
      );
    } finally {
      setExportingPdf(false);
    }
  }

  async function handlePrintHistoryReport() {
    setPrintingReport(true);
    try {
      if (dateRangeInvalid) {
        toast.error("Tanggal mulai tidak boleh lebih besar dari tanggal akhir");
        return;
      }

      const params = new URLSearchParams({
        export: "true",
        offset: "0",
        sortBy: historySort,
      });
      if (isStudentView && user?.id) params.set("studentId", user.id);
      if (!isStudentView && selectedHistoryStudentId !== "all") {
        params.set("studentId", selectedHistoryStudentId);
      }
      if (historySearch.trim()) params.set("searchQuery", historySearch.trim());
      if (historyStatus !== "all") params.set("status", historyStatus);
      if (historySource !== "all") params.set("source", historySource);
      if (historyStartDate) params.set("startDate", historyStartDate);
      if (historyEndDate) params.set("endDate", historyEndDate);

      const result = await apiGet<AttendanceHistoryResponse>(
        `/api/attendance/history?${params.toString()}`,
      );

      if (result.data.length === 0) {
        toast.error("Tidak ada riwayat absensi untuk dicetak");
        return;
      }

      const printWindow = window.open("", "_blank", "noopener,noreferrer");
      if (!printWindow) {
        toast.error("Popup print diblokir browser.");
        return;
      }

      const rows = result.data
        .map(
          (log) => `
            <tr>
              <td>${log.date}</td>
              <td>${log.snapshotStudentName || "-"}</td>
              <td>${log.snapshotStudentNis || "-"}</td>
              <td>${log.className || "-"}</td>
              <td>${formatStatusLabel(log.status)}</td>
              <td>${log.source === "qr" ? "QR" : "Manual"}</td>
              <td>${formatTime(log.checkInTime)}</td>
              <td>${formatTime(log.checkOutTime)}</td>
              <td>${log.lateDuration ?? 0}</td>
              <td>${log.notes || "-"}</td>
            </tr>
          `,
        )
        .join("");

      const summaryHtml = historySummary
        ? `
          <div class="summary">
            <div><strong>Total:</strong> ${historySummary.total}</div>
            <div><strong>Hadir:</strong> ${historySummary.present}</div>
            <div><strong>Terlambat:</strong> ${historySummary.late}</div>
            <div><strong>Izin/Sakit:</strong> ${historySummary.excused}</div>
            <div><strong>Alpha:</strong> ${historySummary.absent}</div>
            <div><strong>QR:</strong> ${historySummary.qr}</div>
            <div><strong>Manual:</strong> ${historySummary.manual}</div>
          </div>
        `
        : "";

      printWindow.document.write(`
        <html>
          <head>
            <title>EduCore Attendance History</title>
            <style>
              body {
                font-family: Arial, sans-serif;
                color: #111827;
                padding: 24px;
              }
              h1 {
                margin: 0 0 8px;
                font-size: 20px;
              }
              .meta {
                margin-bottom: 12px;
                font-size: 12px;
                color: #4b5563;
              }
              .summary {
                display: grid;
                grid-template-columns: repeat(4, minmax(0, 1fr));
                gap: 8px;
                margin: 12px 0 16px;
                font-size: 12px;
              }
              table {
                width: 100%;
                border-collapse: collapse;
                font-size: 11px;
              }
              th, td {
                border: 1px solid #d1d5db;
                padding: 6px;
                text-align: left;
                vertical-align: top;
              }
              th {
                background: #f3f4f6;
              }
              @media print {
                body {
                  padding: 0;
                }
              }
            </style>
          </head>
          <body>
            <h1>EduCore Attendance History</h1>
            <div class="meta">
              Filter tanggal: ${historyStartDate || "awal"} s/d ${historyEndDate || "akhir"} |
              Status: ${historyStatus} |
              Sumber: ${historySource}
            </div>
            ${summaryHtml}
            <table>
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Nama</th>
                  <th>NIS</th>
                  <th>Kelas</th>
                  <th>Status</th>
                  <th>Sumber</th>
                  <th>Check In</th>
                  <th>Check Out</th>
                  <th>Terlambat</th>
                  <th>Catatan</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      printWindow.print();
      toast.success("Laporan riwayat absensi siap dicetak.");
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Gagal menyiapkan print riwayat absensi",
      );
    } finally {
      setPrintingReport(false);
    }
  }

  const historyPage = Math.floor(historyOffset / historyLimit) + 1;
  const totalHistoryPages = Math.max(1, Math.ceil(historyTotal / historyLimit));

  function applyQuickRange(range: "today" | "7d" | "30d" | "month" | "all") {
    const today = getTodayDateString();

    if (range === "today") {
      setHistoryStartDate(today);
      setHistoryEndDate(today);
      return;
    }

    if (range === "7d") {
      setHistoryStartDate(getDaysAgoDateString(6));
      setHistoryEndDate(today);
      return;
    }

    if (range === "30d") {
      setHistoryStartDate(getDaysAgoDateString(29));
      setHistoryEndDate(today);
      return;
    }

    if (range === "month") {
      setHistoryStartDate(getMonthStartDateString());
      setHistoryEndDate(today);
      return;
    }

    setHistoryStartDate("");
    setHistoryEndDate("");
  }

  const groupedHistoryLogs =
    historyGroupBy === "none"
      ? []
      : historyLogs.reduce<
          Array<{ title: string; items: TodayAttendanceLog[] }>
        >((groups, log) => {
          const title =
            historyGroupBy === "date" ? log.date : log.className || "-";
          const existingGroup = groups.find((group) => group.title === title);

          if (existingGroup) {
            existingGroup.items.push(log);
            return groups;
          }

          groups.push({
            title,
            items: [log],
          });
          return groups;
        }, []);

  const classSummaryLabel =
    historyStartDate && historyEndDate
      ? `${historyStartDate} s/d ${historyEndDate}`
      : historyStartDate
        ? `mulai ${historyStartDate}`
        : historyEndDate
          ? `sampai ${historyEndDate}`
          : "seluruh riwayat";
  const topStudentSummary = historyStudentSummary.slice(0, 10);
  const topLateStudents = [...historyStudentSummary]
    .sort(
      (a, b) =>
        b.late - a.late ||
        b.absent - a.absent ||
        a.studentName.localeCompare(b.studentName),
    )
    .slice(0, 5);
  const topAbsentStudents = [...historyStudentSummary]
    .sort(
      (a, b) =>
        b.absent - a.absent ||
        b.late - a.late ||
        a.studentName.localeCompare(b.studentName),
    )
    .slice(0, 5);
  const maxTrendTotal = Math.max(...historyTrend.map((item) => item.total), 1);
  const heatmapMonthLabel =
    historyHeatmap.length > 0 ? historyHeatmap[0].date.slice(0, 7) : "";
  const bestClass = historyClassSummary[0] ?? null;
  const lowestClass =
    historyClassSummary.length > 0
      ? [...historyClassSummary].sort(
          (a, b) =>
            a.attendanceRate - b.attendanceRate ||
            b.absent - a.absent ||
            a.className.localeCompare(b.className),
        )[0]
      : null;
  const compareItemA =
    compareClassA === "none"
      ? null
      : historyClassSummary.find((item) => item.className === compareClassA) ||
        null;
  const compareItemB =
    compareClassB === "none"
      ? null
      : historyClassSummary.find((item) => item.className === compareClassB) ||
        null;
  const normalizedAlphaThreshold = Math.max(0, Number(riskAlphaThreshold) || 0);
  const normalizedLateThreshold = Math.max(0, Number(riskLateThreshold) || 0);
  const normalizedRateThreshold = Math.max(0, Number(riskRateThreshold) || 0);
  const atRiskStudents = historyStudentSummary
    .filter(
      (item) =>
        item.absent >= normalizedAlphaThreshold ||
        item.late >= normalizedLateThreshold ||
        item.attendanceRate < normalizedRateThreshold,
    )
    .sort(
      (a, b) =>
        a.attendanceRate - b.attendanceRate ||
        b.absent - a.absent ||
        b.late - a.late ||
        a.studentName.localeCompare(b.studentName),
    )
    .slice(0, 6);
  const internalNotifications = [
    lowestClass
      ? `Kelas ${lowestClass.className} perlu perhatian: rate ${lowestClass.attendanceRate}% dengan ${lowestClass.absent} alpha.`
      : null,
    atRiskStudents[0]
      ? `Siswa ${atRiskStudents[0].studentName} masuk prioritas pemantauan attendance.`
      : null,
    historySummary && historySummary.manual > historySummary.qr
      ? "Input manual lebih dominan dari QR pada filter aktif."
      : null,
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-5">
      {error ? (
        <InlineState
          title="Data log absensi tidak tersedia"
          description={error}
          actionLabel="Muat Ulang"
          onAction={() => {
            void loadTodayLogs();
            void loadHistoryLogs();
          }}
          variant="error"
        />
      ) : null}

      <Tabs
        value={activeTab}
        onValueChange={(value) => setActiveTab(value as "today" | "history")}
        className="space-y-4"
      >
        <TabsList
          variant="line"
          className="border-b border-zinc-800 w-full justify-start rounded-none p-0"
        >
          <TabsTrigger
            value="today"
            className="rounded-none px-4 py-3 data-[state=active]:text-white"
          >
            Hari Ini
          </TabsTrigger>
          <TabsTrigger
            value="history"
            className="rounded-none px-4 py-3 data-[state=active]:text-white"
          >
            Riwayat
          </TabsTrigger>
        </TabsList>

        <TabsContent value="today" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-zinc-400">
              {isStudentView
                ? "Log check-in dan check-out milik akun siswa yang sedang login."
                : "Log QR check-in/check-out hari ini."}
            </p>
            <Button
              variant="outline"
              onClick={() => {
                void loadTodayLogs();
              }}
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            >
              Refresh
            </Button>
          </div>

          {loadingToday ? (
            <div className="flex justify-center py-10 text-zinc-500">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : todayLogs.length > 0 ? (
            <div className="space-y-3">
              {todayLogs.map((log) => (
                <div
                  key={log.id}
                  className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium text-zinc-100">
                        {log.snapshotStudentName || "Siswa"}
                      </p>
                      <p className="text-sm text-zinc-400">
                        {log.snapshotStudentNis || "-"} • {log.status}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm text-zinc-300 sm:text-right">
                      <div>
                        <p className="text-zinc-500">Check-in</p>
                        <p>{formatTime(log.checkInTime)}</p>
                      </div>
                      <div>
                        <p className="text-zinc-500">Check-out</p>
                        <p>{formatTime(log.checkOutTime)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <InlineState
              title="Belum ada log hari ini"
              description="Check-in dan check-out QR yang berhasil akan muncul di panel ini."
              variant="info"
            />
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          {isStudentView ? (
            <div className="rounded-2xl border border-sky-500/20 bg-sky-500/5 p-4 text-sm text-sky-100">
              Riwayat absensi ditampilkan khusus untuk akun siswa yang sedang
              login.
            </div>
          ) : null}

          <div className="grid gap-3 xl:grid-cols-3">
            {!isStudentView ? (
              <div className="relative">
                <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <Input
                  value={historySearch}
                  onChange={(event) => setHistorySearch(event.target.value)}
                  placeholder="Cari nama atau NIS..."
                  className="border-zinc-800 bg-zinc-950 pl-11 text-zinc-100"
                />
              </div>
            ) : (
              <div className="rounded-md border border-zinc-800 bg-zinc-950 px-4 py-2.5 text-sm text-zinc-500">
                Pencarian lintas siswa disembunyikan pada mode siswa.
              </div>
            )}

            {isAdminView ? (
              <div className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-950/40 p-3">
                <Input
                  value={historyStudentSearch}
                  onChange={(event) =>
                    setHistoryStudentSearch(event.target.value)
                  }
                  placeholder="Cari siswa spesifik..."
                  className="border-zinc-800 bg-zinc-950 text-zinc-100"
                />
                <Select
                  value={selectedHistoryStudentId}
                  onValueChange={setSelectedHistoryStudentId}
                >
                  <SelectTrigger className="border-zinc-800 bg-zinc-950 text-zinc-200">
                    <SelectValue placeholder="Semua siswa" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                    <SelectItem value="all">Semua Siswa</SelectItem>
                    {historyStudentOptions.map((student) => (
                      <SelectItem key={student.id} value={student.id}>
                        {student.fullName} • {student.nis} • {student.grade}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-zinc-500">
                  {loadingStudentOptions
                    ? "Memuat opsi siswa..."
                    : "Filter ini khusus admin/super admin."}
                </p>
              </div>
            ) : null}

            <Select
              value={historyStatus}
              onValueChange={(value) =>
                setHistoryStatus(value as HistoryFilterStatus)
              }
            >
              <SelectTrigger className="border-zinc-800 bg-zinc-950 text-zinc-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                <SelectItem value="all">Semua Status</SelectItem>
                <SelectItem value="present">Hadir</SelectItem>
                <SelectItem value="late">Terlambat</SelectItem>
                <SelectItem value="sick">Sakit</SelectItem>
                <SelectItem value="permission">Izin</SelectItem>
                <SelectItem value="alpha">Alpha</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={historySource}
              onValueChange={(value) =>
                setHistorySource(value as HistorySourceFilter)
              }
            >
              <SelectTrigger className="border-zinc-800 bg-zinc-950 text-zinc-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                <SelectItem value="all">Semua Sumber</SelectItem>
                <SelectItem value="qr">QR</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={historyGroupBy}
              onValueChange={(value) =>
                setHistoryGroupBy(value as HistoryGroupBy)
              }
            >
              <SelectTrigger className="border-zinc-800 bg-zinc-950 text-zinc-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                <SelectItem value="none">Tanpa Grouping</SelectItem>
                <SelectItem value="date">Group per Tanggal</SelectItem>
                <SelectItem value="class">Group per Kelas</SelectItem>
              </SelectContent>
            </Select>

            <Select value={historySort} onValueChange={setHistorySort}>
              <SelectTrigger className="border-zinc-800 bg-zinc-950 text-zinc-200">
                <CalendarRange className="h-4 w-4 mr-2 text-zinc-500" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                <SelectItem value="latest">Terbaru</SelectItem>
                <SelectItem value="earliest">Terlama</SelectItem>
              </SelectContent>
            </Select>

            <Input
              type="date"
              value={historyStartDate}
              onChange={(event) => setHistoryStartDate(event.target.value)}
              className="border-zinc-800 bg-zinc-950 text-zinc-200"
            />

            <Input
              type="date"
              value={historyEndDate}
              onChange={(event) => setHistoryEndDate(event.target.value)}
              className="border-zinc-800 bg-zinc-950 text-zinc-200"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => applyQuickRange("today")}
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            >
              Hari Ini
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => applyQuickRange("7d")}
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            >
              7 Hari
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => applyQuickRange("30d")}
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            >
              30 Hari
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => applyQuickRange("month")}
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            >
              Bulan Ini
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => applyQuickRange("all")}
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            >
              Semua
            </Button>
          </div>

          {historySummary ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                {
                  label: "Total Record",
                  value: historySummary.total,
                  tone: "text-zinc-100",
                },
                {
                  label: "Hadir",
                  value: historySummary.present,
                  tone: "text-emerald-300",
                },
                {
                  label: "Terlambat",
                  value: historySummary.late,
                  tone: "text-amber-300",
                },
                {
                  label: "Izin/Sakit",
                  value: historySummary.excused,
                  tone: "text-sky-300",
                },
                {
                  label: "Alpha",
                  value: historySummary.absent,
                  tone: "text-red-300",
                },
                {
                  label: "QR",
                  value: historySummary.qr,
                  tone: "text-violet-300",
                },
                {
                  label: "Manual",
                  value: historySummary.manual,
                  tone: "text-orange-300",
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4"
                >
                  <p className="text-xs uppercase tracking-wide text-zinc-500">
                    {item.label}
                  </p>
                  <p className={`mt-2 text-2xl font-semibold ${item.tone}`}>
                    {item.value}
                  </p>
                </div>
              ))}
            </div>
          ) : null}

          {isAdminView && historyClassSummary.length > 0 ? (
            <div className="flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-950/30 p-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wide text-zinc-200">
                  Filter Analitik per Kelas
                </p>
                <p className="text-xs text-zinc-500">
                  Mempengaruhi tren, rekap siswa, dan ranking alpha/terlambat
                </p>
              </div>
              <div className="w-full sm:w-72">
                <Select
                  value={analyticsClassFilter}
                  onValueChange={setAnalyticsClassFilter}
                >
                  <SelectTrigger className="border-zinc-800 bg-zinc-950 text-zinc-200">
                    <SelectValue placeholder="Semua kelas" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                    <SelectItem value="all">Semua Kelas</SelectItem>
                    {historyClassSummary.map((item) => (
                      <SelectItem key={item.className} value={item.className}>
                        {item.className}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : null}

          {isAdminView && historyClassSummary.length > 1 ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-200">
                    Compare Mode Antar Kelas
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Bandingkan performa dua kelas pada filter aktif
                  </p>
                </div>
              </div>
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <Select value={compareClassA} onValueChange={setCompareClassA}>
                  <SelectTrigger className="border-zinc-800 bg-zinc-950 text-zinc-200">
                    <SelectValue placeholder="Pilih kelas A" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                    <SelectItem value="none">Pilih Kelas A</SelectItem>
                    {historyClassSummary.map((item) => (
                      <SelectItem
                        key={`a-${item.className}`}
                        value={item.className}
                      >
                        {item.className}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={compareClassB} onValueChange={setCompareClassB}>
                  <SelectTrigger className="border-zinc-800 bg-zinc-950 text-zinc-200">
                    <SelectValue placeholder="Pilih kelas B" />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-800 text-white">
                    <SelectItem value="none">Pilih Kelas B</SelectItem>
                    {historyClassSummary.map((item) => (
                      <SelectItem
                        key={`b-${item.className}`}
                        value={item.className}
                      >
                        {item.className}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {compareItemA && compareItemB ? (
                <div className="mt-4">
                  <div className="mb-4 flex justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={exportingCompareReport}
                      onClick={() => {
                        void handleExportCompareReport();
                      }}
                      className="border-sky-700 text-sky-300 hover:bg-sky-950/50"
                    >
                      {exportingCompareReport ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="mr-2 h-4 w-4" />
                      )}
                      Export Compare
                    </Button>
                  </div>
                  <div className="grid gap-4 lg:grid-cols-2">
                    {[compareItemA, compareItemB].map((item) => (
                      <div
                        key={item.className}
                        className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4"
                      >
                        <p className="text-sm font-semibold text-zinc-100">
                          {item.className}
                        </p>
                        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                          <div className="rounded-lg bg-zinc-950/70 px-3 py-2 text-zinc-300">
                            Total {item.total}
                          </div>
                          <div className="rounded-lg bg-zinc-950/70 px-3 py-2 text-zinc-100">
                            Rate {item.attendanceRate}%
                          </div>
                          <div className="rounded-lg bg-zinc-950/70 px-3 py-2 text-emerald-300">
                            Hadir {item.present}
                          </div>
                          <div className="rounded-lg bg-zinc-950/70 px-3 py-2 text-amber-300">
                            Terlambat {item.late}
                          </div>
                          <div className="rounded-lg bg-zinc-950/70 px-3 py-2 text-sky-300">
                            Izin {item.excused}
                          </div>
                          <div className="rounded-lg bg-zinc-950/70 px-3 py-2 text-red-300">
                            Alpha {item.absent}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {historyTrend.length > 0 ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-200">
                    Tren Attendance
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Grafik{" "}
                    {historyTrend.some((item) => item.period.length === 7)
                      ? "bulanan"
                      : "harian"}{" "}
                    sesuai filter aktif
                  </p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={exportingAnalyticsReport}
                  onClick={() => {
                    void handleExportAnalyticsReport();
                  }}
                  className="border-sky-700 text-sky-300 hover:bg-sky-950/50"
                >
                  {exportingAnalyticsReport ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" />
                  )}
                  Export Trend/Heatmap
                </Button>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                {historyTrend.map((item) => (
                  <div
                    key={item.period}
                    className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3"
                  >
                    <div className="flex items-center justify-between text-xs text-zinc-500">
                      <span>{item.label}</span>
                      <span>{item.attendanceRate}%</span>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-800">
                      <div
                        className="h-full rounded-full bg-emerald-400 transition-all"
                        style={{
                          width: `${Math.max(
                            8,
                            (item.total / maxTrendTotal) * 100,
                          )}%`,
                        }}
                      />
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg bg-zinc-950/60 px-2 py-1 text-zinc-300">
                        Total {item.total}
                      </div>
                      <div className="rounded-lg bg-zinc-950/60 px-2 py-1 text-emerald-300">
                        Hadir {item.present + item.late}
                      </div>
                      <div className="rounded-lg bg-zinc-950/60 px-2 py-1 text-sky-300">
                        Izin {item.excused}
                      </div>
                      <div className="rounded-lg bg-zinc-950/60 px-2 py-1 text-red-300">
                        Alpha {item.absent}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {historyHeatmap.length > 0 ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-200">
                    Heatmap Kehadiran
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Visual audit harian untuk{" "}
                    {heatmapMonthLabel || "rentang aktif"}
                  </p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-7 lg:grid-cols-10 xl:grid-cols-12">
                {historyHeatmap.map((item) => {
                  const bgClass =
                    item.attendanceRate >= 90
                      ? "bg-emerald-500/20 border-emerald-500/40"
                      : item.attendanceRate >= 75
                        ? "bg-amber-500/20 border-amber-500/40"
                        : "bg-red-500/20 border-red-500/40";

                  return (
                    <button
                      type="button"
                      key={item.date}
                      onClick={() => drillDownToDate(item.date)}
                      className={`rounded-xl border p-3 text-left transition-colors hover:bg-zinc-900/80 ${bgClass}`}
                      title={`${item.date} | Hadir ${item.present + item.late}/${item.total} | Alpha ${item.absent}`}
                    >
                      <p className="text-sm font-semibold text-zinc-100">
                        {item.dayLabel}
                      </p>
                      <p className="mt-1 text-xs text-zinc-300">
                        {item.attendanceRate}%
                      </p>
                      <p className="mt-2 text-[11px] text-zinc-400">
                        T {item.total}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          {historyClassSummary.length > 1 ? (
            <div className="grid gap-4 xl:grid-cols-2">
              {bestClass ? (
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                  <p className="text-xs uppercase tracking-wide text-emerald-300">
                    Kelas Terbaik
                  </p>
                  <p className="mt-2 text-lg font-semibold text-zinc-100">
                    {bestClass.className}
                  </p>
                  <p className="mt-1 text-sm text-zinc-300">
                    Tingkat hadir {bestClass.attendanceRate}% dari{" "}
                    {bestClass.total} record
                  </p>
                </div>
              ) : null}
              {lowestClass ? (
                <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4">
                  <p className="text-xs uppercase tracking-wide text-red-300">
                    Kelas Perlu Perhatian
                  </p>
                  <p className="mt-2 text-lg font-semibold text-zinc-100">
                    {lowestClass.className}
                  </p>
                  <p className="mt-1 text-sm text-zinc-300">
                    Tingkat hadir {lowestClass.attendanceRate}% dengan{" "}
                    {lowestClass.absent} alpha
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}

          {isAdminView &&
          selectedHistoryStudentId === "all" &&
          historyClassSummary.length > 0 ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-200">
                    Rekap Kelas
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Ringkasan kehadiran per kelas untuk {classSummaryLabel}
                  </p>
                </div>
                <p className="text-xs text-zinc-500">
                  {historyClassSummary.length} kelas terdeteksi
                </p>
              </div>

              <div className="mt-3 flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={exportingClassSummary}
                  onClick={() => {
                    void handleExportClassSummary();
                  }}
                  className="border-emerald-700 text-emerald-300 hover:bg-emerald-950/50"
                >
                  {exportingClassSummary ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" />
                  )}
                  Export Rekap Kelas
                </Button>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-left text-zinc-500">
                    <tr className="border-b border-zinc-800">
                      <th className="pb-2 pr-4 font-medium">Kelas</th>
                      <th className="pb-2 pr-4 font-medium">Total</th>
                      <th className="pb-2 pr-4 font-medium">Hadir</th>
                      <th className="pb-2 pr-4 font-medium">Terlambat</th>
                      <th className="pb-2 pr-4 font-medium">Izin/Sakit</th>
                      <th className="pb-2 pr-4 font-medium">Alpha</th>
                      <th className="pb-2 pr-4 font-medium">QR</th>
                      <th className="pb-2 pr-4 font-medium">Manual</th>
                      <th className="pb-2 font-medium">Tingkat Hadir</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historyClassSummary.map((item) => (
                      <tr
                        key={item.className}
                        className="border-b border-zinc-900/80 text-zinc-200"
                      >
                        <td className="py-3 pr-4 font-medium">
                          {item.className}
                        </td>
                        <td className="py-3 pr-4">{item.total}</td>
                        <td className="py-3 pr-4 text-emerald-300">
                          {item.present}
                        </td>
                        <td className="py-3 pr-4 text-amber-300">
                          {item.late}
                        </td>
                        <td className="py-3 pr-4 text-sky-300">
                          {item.excused}
                        </td>
                        <td className="py-3 pr-4 text-red-300">
                          {item.absent}
                        </td>
                        <td className="py-3 pr-4 text-violet-300">{item.qr}</td>
                        <td className="py-3 pr-4 text-orange-300">
                          {item.manual}
                        </td>
                        <td className="py-3 font-semibold text-zinc-100">
                          {item.attendanceRate}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {historyStudentSummary.length > 0 ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-200">
                    Alert Risiko Attendance
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Threshold alert bisa diatur langsung oleh admin
                  </p>
                </div>
                <p className="text-xs text-zinc-500">
                  {atRiskStudents.length} siswa terdeteksi
                </p>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <Input
                  type="number"
                  min="0"
                  value={riskAlphaThreshold}
                  onChange={(event) =>
                    setRiskAlphaThreshold(event.target.value)
                  }
                  placeholder="Alpha threshold"
                  className="border-zinc-800 bg-zinc-950 text-zinc-200"
                />
                <Input
                  type="number"
                  min="0"
                  value={riskLateThreshold}
                  onChange={(event) => setRiskLateThreshold(event.target.value)}
                  placeholder="Terlambat threshold"
                  className="border-zinc-800 bg-zinc-950 text-zinc-200"
                />
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={riskRateThreshold}
                  onChange={(event) => setRiskRateThreshold(event.target.value)}
                  placeholder="Rate threshold"
                  className="border-zinc-800 bg-zinc-950 text-zinc-200"
                />
              </div>
              <div className="mt-3 flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={savingRiskSettings}
                  onClick={() => {
                    void handleSaveRiskSettings();
                  }}
                  className="border-sky-700 text-sky-300 hover:bg-sky-950/50"
                >
                  {savingRiskSettings ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Simpan Threshold
                </Button>
              </div>
              <div className="mt-4 space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/40 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-zinc-100">
                      Catatan Tindak Lanjut
                    </p>
                    <p className="text-xs text-zinc-500">
                      Catatan ini akan ikut masuk ke notifikasi internal saat
                      tombol follow-up ditekan.
                    </p>
                  </div>
                  <span className="text-xs text-zinc-500">
                    {followUpNote.trim().length}/300
                  </span>
                </div>
                <Input
                  value={followUpNote}
                  maxLength={300}
                  onChange={(event) => setFollowUpNote(event.target.value)}
                  placeholder="Contoh: hubungi wali kelas, cek alasan alpha, jadwalkan konseling."
                  className="border-zinc-800 bg-zinc-950 text-zinc-200"
                />
                <div className="grid gap-2 md:grid-cols-[1fr_180px]">
                  <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2">
                    <p className="text-xs uppercase tracking-wide text-zinc-500">
                      Info
                    </p>
                    <p className="mt-1 text-xs text-zinc-400">
                      Deadline akan ikut tampil di dashboard follow-up guru atau
                      wali kelas.
                    </p>
                  </div>
                  <Input
                    type="date"
                    value={followUpDeadline}
                    onChange={(event) =>
                      setFollowUpDeadline(event.target.value)
                    }
                    className="border-zinc-800 bg-zinc-950 text-zinc-200"
                  />
                </div>
              </div>
              {atRiskStudents.length > 0 ? (
                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  {atRiskStudents.map((item) => (
                    <div
                      key={`risk-${item.studentId}`}
                      className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <button
                            type="button"
                            onClick={() => drillDownToStudent(item)}
                            className="text-left text-sm font-medium text-zinc-100 underline-offset-4 hover:underline"
                          >
                            {item.studentName}
                          </button>
                          <p className="text-xs text-zinc-400">
                            {item.nis} • {item.className}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={creatingFollowUpId === item.studentId}
                          onClick={() => {
                            void handleCreateFollowUp(item);
                          }}
                          className="border-red-700 text-red-300 hover:bg-red-950/50"
                        >
                          {creatingFollowUpId === item.studentId ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          ) : null}
                          Buat Tindak Lanjut
                        </Button>
                      </div>
                      <div className="mt-3 text-right text-xs">
                        <p className="text-red-300">Alpha {item.absent}</p>
                        <p className="text-amber-300">Terlambat {item.late}</p>
                        <p className="text-zinc-300">
                          Rate {item.attendanceRate}%
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-zinc-500">
                  Tidak ada siswa berisiko pada filter aktif.
                </p>
              )}
            </div>
          ) : null}

          {selectedHistoryStudentId !== "all" && followUpHistory.length > 0 ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-200">
                    Riwayat Tindakan Attendance
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Riwayat follow-up untuk siswa yang sedang dipilih
                  </p>
                </div>
              </div>
              <div className="mt-4 space-y-3">
                {followUpHistory.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-xl border border-zinc-800 bg-zinc-900/50 px-4 py-3"
                  >
                    <p className="text-sm font-medium text-zinc-100">
                      {item.judul}
                    </p>
                    <p className="mt-1 text-xs text-zinc-400">{item.pesan}</p>
                    <p className="mt-2 text-[11px] text-zinc-500">
                      Status: {item.isRead ? "Selesai" : "Aktif"}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {historySummary ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-200">
                    Dashboard Attendance
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Ringkasan cepat untuk admin/kepala sekolah
                  </p>
                </div>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
                  <p className="text-xs uppercase tracking-wide text-zinc-500">
                    Attendance Rate
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-zinc-100">
                    {historySummary.total === 0
                      ? 0
                      : Number(
                          (
                            ((historySummary.present + historySummary.late) /
                              historySummary.total) *
                            100
                          ).toFixed(1),
                        )}
                    %
                  </p>
                </div>
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
                  <p className="text-xs uppercase tracking-wide text-zinc-500">
                    Kelas Aktif
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-zinc-100">
                    {historyClassSummary.length}
                  </p>
                </div>
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
                  <p className="text-xs uppercase tracking-wide text-zinc-500">
                    Siswa Berisiko
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-red-300">
                    {atRiskStudents.length}
                  </p>
                </div>
                <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
                  <p className="text-xs uppercase tracking-wide text-zinc-500">
                    Sumber Dominan
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-zinc-100">
                    {historySummary.qr >= historySummary.manual
                      ? "QR"
                      : "Manual"}
                  </p>
                </div>
              </div>
              {internalNotifications.length > 0 ? (
                <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
                  <p className="text-xs uppercase tracking-wide text-zinc-500">
                    Notifikasi Internal
                  </p>
                  <div className="mt-3 space-y-2">
                    {internalNotifications.map((message) => (
                      <div
                        key={message}
                        className="rounded-lg border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-sm text-zinc-300"
                      >
                        {message}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {historyStudentSummary.length > 0 ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-200">
                    Rekap Siswa
                  </h3>
                  <p className="text-xs text-zinc-500">
                    Peringkat siswa berdasarkan total record dan tingkat hadir
                  </p>
                </div>
                <p className="text-xs text-zinc-500">
                  Menampilkan {topStudentSummary.length} dari{" "}
                  {historyStudentSummary.length} siswa
                </p>
              </div>

              <div className="mt-3 flex justify-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={exportingStudentSummary}
                  onClick={() => {
                    void handleExportStudentSummary();
                  }}
                  className="border-sky-700 text-sky-300 hover:bg-sky-950/50"
                >
                  {exportingStudentSummary ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="mr-2 h-4 w-4" />
                  )}
                  Export Rekap Siswa
                </Button>
              </div>

              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-left text-zinc-500">
                    <tr className="border-b border-zinc-800">
                      <th className="pb-2 pr-4 font-medium">Siswa</th>
                      <th className="pb-2 pr-4 font-medium">NIS</th>
                      <th className="pb-2 pr-4 font-medium">Kelas</th>
                      <th className="pb-2 pr-4 font-medium">Total</th>
                      <th className="pb-2 pr-4 font-medium">Hadir</th>
                      <th className="pb-2 pr-4 font-medium">Terlambat</th>
                      <th className="pb-2 pr-4 font-medium">Alpha</th>
                      <th className="pb-2 font-medium">Tingkat Hadir</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topStudentSummary.map((item) => (
                      <tr
                        key={item.studentId}
                        className="border-b border-zinc-900/80 text-zinc-200"
                      >
                        <td className="py-3 pr-4 font-medium">
                          <button
                            type="button"
                            onClick={() => drillDownToStudent(item)}
                            className="text-left text-zinc-100 underline-offset-4 hover:underline"
                          >
                            {item.studentName}
                          </button>
                        </td>
                        <td className="py-3 pr-4">{item.nis}</td>
                        <td className="py-3 pr-4">{item.className}</td>
                        <td className="py-3 pr-4">{item.total}</td>
                        <td className="py-3 pr-4 text-emerald-300">
                          {item.present}
                        </td>
                        <td className="py-3 pr-4 text-amber-300">
                          {item.late}
                        </td>
                        <td className="py-3 pr-4 text-red-300">
                          {item.absent}
                        </td>
                        <td className="py-3 font-semibold text-zinc-100">
                          {item.attendanceRate}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}

          {historyStudentSummary.length > 0 ? (
            <div className="grid gap-4 xl:grid-cols-2">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4">
                <div className="flex items-end justify-between">
                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-200">
                      Ranking Terlambat
                    </h3>
                    <p className="text-xs text-zinc-500">
                      Siswa dengan frekuensi terlambat tertinggi
                    </p>
                  </div>
                </div>
                <div className="mt-4 space-y-3">
                  {topLateStudents.map((item, index) => (
                    <button
                      type="button"
                      onClick={() => drillDownToStudent(item)}
                      key={`late-${item.studentId}`}
                      className="flex w-full items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/50 px-3 py-3 text-left"
                    >
                      <div>
                        <p className="text-sm font-medium text-zinc-100">
                          {index + 1}. {item.studentName}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {item.nis} • {item.className}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-amber-300">
                          {item.late} kali
                        </p>
                        <p className="text-xs text-zinc-500">
                          Alpha {item.absent}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-950/40 p-4">
                <div className="flex items-end justify-between">
                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-200">
                      Ranking Alpha
                    </h3>
                    <p className="text-xs text-zinc-500">
                      Siswa dengan frekuensi alpha tertinggi
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={exportingRiskRanking}
                    onClick={() => {
                      void handleExportRiskRanking();
                    }}
                    className="border-red-700 text-red-300 hover:bg-red-950/50"
                  >
                    {exportingRiskRanking ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="mr-2 h-4 w-4" />
                    )}
                    Export Ranking
                  </Button>
                </div>
                <div className="mt-4 space-y-3">
                  {topAbsentStudents.map((item, index) => (
                    <button
                      type="button"
                      key={`absent-${item.studentId}`}
                      onClick={() => drillDownToStudent(item)}
                      className="flex w-full items-center justify-between rounded-xl border border-zinc-800 bg-zinc-900/50 px-3 py-3 text-left"
                    >
                      <div>
                        <p className="text-sm font-medium text-zinc-100">
                          {index + 1}. {item.studentName}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {item.nis} • {item.className}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold text-red-300">
                          {item.absent} kali
                        </p>
                        <p className="text-xs text-zinc-500">
                          Terlambat {item.late}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}

          <div className="flex flex-col gap-2 text-sm text-zinc-500 sm:flex-row sm:items-center sm:justify-between">
            <span>
              Menampilkan {historyLogs.length} dari {historyTotal} record
              {historyStartDate || historyEndDate
                ? " sesuai rentang tanggal"
                : " dari seluruh riwayat"}
            </span>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={
                  exportingHistory || loadingHistory || historyTotal === 0
                }
                onClick={() => {
                  void handleExportHistory();
                }}
                className="border-emerald-700 text-emerald-300 hover:bg-emerald-950/50"
              >
                {exportingHistory ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Download className="mr-2 h-4 w-4" />
                )}
                Export History
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={exportingPdf || loadingHistory || historyTotal === 0}
                onClick={() => {
                  void handleExportHistoryPdf();
                }}
                className="border-sky-700 text-sky-300 hover:bg-sky-950/50"
              >
                {exportingPdf ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <FileText className="mr-2 h-4 w-4" />
                )}
                Export PDF
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={
                  printingReport || loadingHistory || historyTotal === 0
                }
                onClick={() => {
                  void handlePrintHistoryReport();
                }}
                className="border-violet-700 text-violet-300 hover:bg-violet-950/50"
              >
                {printingReport ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Printer className="mr-2 h-4 w-4" />
                )}
                Print Report
              </Button>
              {(historyStartDate || historyEndDate) && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setHistoryStartDate("");
                    setHistoryEndDate("");
                  }}
                  className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                >
                  Reset Tanggal
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                disabled={historyPage <= 1 || loadingHistory}
                onClick={() =>
                  setHistoryOffset((current) =>
                    Math.max(0, current - historyLimit),
                  )
                }
                className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
              >
                Prev
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={
                  historyPage >= totalHistoryPages ||
                  loadingHistory ||
                  historyTotal === 0
                }
                onClick={() =>
                  setHistoryOffset((current) =>
                    Math.min(
                      Math.max(0, (totalHistoryPages - 1) * historyLimit),
                      current + historyLimit,
                    ),
                  )
                }
                className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
              >
                Next
              </Button>
            </div>
          </div>

          {loadingHistory ? (
            <div className="flex justify-center py-10 text-zinc-500">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : historyLogs.length > 0 ? (
            historyGroupBy === "none" ? (
              <div className="space-y-3">
                {historyLogs.map((log) => (
                  <div
                    key={log.id}
                    className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-4"
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-medium text-zinc-100">
                          {log.snapshotStudentName || "Siswa"}
                        </p>
                        <p className="text-sm text-zinc-400">
                          {log.snapshotStudentNis || "-"} • {log.date} •{" "}
                          {log.source === "qr" ? "QR" : "MANUAL"} •{" "}
                          {log.className || "-"}
                        </p>
                      </div>
                      <div className="text-sm text-zinc-300 sm:text-right">
                        <p>{formatStatusLabel(log.status)}</p>
                        <p className="text-zinc-500">
                          In {formatTime(log.checkInTime)} • Out{" "}
                          {formatTime(log.checkOutTime)}
                        </p>
                        {log.lateDuration ? (
                          <p className="text-zinc-500">
                            Terlambat {log.lateDuration} menit
                          </p>
                        ) : null}
                        {log.notes ? (
                          <p className="text-zinc-500">Catatan: {log.notes}</p>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {groupedHistoryLogs.map((group) => (
                  <div
                    key={group.title}
                    className="rounded-2xl border border-zinc-800 bg-zinc-900/30 p-4"
                  >
                    <div className="sticky top-2 z-10 mb-3 flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950/95 px-3 py-2 backdrop-blur-sm">
                      <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-200">
                        {historyGroupBy === "date"
                          ? `Tanggal ${group.title}`
                          : `Kelas ${group.title}`}
                      </h3>
                      <span className="text-xs text-zinc-500">
                        {group.items.length} record
                      </span>
                    </div>
                    <div className="space-y-3">
                      {group.items.map((log) => (
                        <div
                          key={log.id}
                          className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-4"
                        >
                          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                              <p className="font-medium text-zinc-100">
                                {log.snapshotStudentName || "Siswa"}
                              </p>
                              <p className="text-sm text-zinc-400">
                                {log.snapshotStudentNis || "-"} • {log.date} •{" "}
                                {log.source === "qr" ? "QR" : "MANUAL"} •{" "}
                                {log.className || "-"}
                              </p>
                            </div>
                            <div className="text-sm text-zinc-300 sm:text-right">
                              <p>{formatStatusLabel(log.status)}</p>
                              <p className="text-zinc-500">
                                In {formatTime(log.checkInTime)} • Out{" "}
                                {formatTime(log.checkOutTime)}
                              </p>
                              {log.lateDuration ? (
                                <p className="text-zinc-500">
                                  Terlambat {log.lateDuration} menit
                                </p>
                              ) : null}
                              {log.notes ? (
                                <p className="text-zinc-500">
                                  Catatan: {log.notes}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            <InlineState
              title="Riwayat belum tersedia"
              description="Belum ada riwayat absensi yang cocok dengan filter saat ini."
              variant="info"
            />
          )}

          {historyTotal > 0 ? (
            <div className="text-right text-xs text-zinc-500">
              Halaman {historyPage} dari {totalHistoryPages}
            </div>
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}
