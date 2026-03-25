"use client";

import { Loader2, RefreshCw } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isTauri } from "@/core/env";
import { useAuth } from "@/hooks/use-auth";
import { apiGet, apiPost, apiPut } from "@/lib/api/request";
import { exportRowsToXlsx } from "@/lib/export/xlsx";
import { InlineState } from "../common/inline-state";
import { HistoryLoadingSkeleton } from "./history/history-loading-skeleton";
import type {
  AttendanceHistoryClassSummary,
  AttendanceHistoryHeatmapPoint,
  AttendanceHistoryStudentSummary,
  AttendanceHistorySummary,
  AttendanceHistoryTrendPoint,
  AttendanceRiskFollowUpHistoryItem,
  HistoryDensity,
  HistoryFilterStatus,
  HistoryGroupBy,
  HistoryLogGroup,
  HistoryQuickRange,
  HistorySourceFilter,
  StudentOption,
  TodayAttendanceLog,
} from "./history/history-types";

const HistoryFiltersPanel = dynamic(
  () =>
    import("./history/history-filters-panel").then(
      (module) => module.HistoryFiltersPanel,
    ),
  { ssr: false },
);

const HistoryAnalyticsPanel = dynamic(
  () =>
    import("./history/history-analytics-panel").then(
      (module) => module.HistoryAnalyticsPanel,
    ),
  { ssr: false },
);

const HistoryRiskPanel = dynamic(
  () =>
    import("./history/history-risk-panel").then(
      (module) => module.HistoryRiskPanel,
    ),
  { ssr: false },
);

const HistoryInsightsPanel = dynamic(
  () =>
    import("./history/history-insights-panel").then(
      (module) => module.HistoryInsightsPanel,
    ),
  { ssr: false },
);

const HistoryExportToolbar = dynamic(
  () =>
    import("./history/history-export-toolbar").then(
      (module) => module.HistoryExportToolbar,
    ),
  { ssr: false },
);

const HistoryLogList = dynamic(
  () =>
    import("./history/history-log-list").then(
      (module) => module.HistoryLogList,
    ),
  { ssr: false },
);

const HistoryGroupedLogList = dynamic(
  () =>
    import("./history/history-grouped-log-list").then(
      (module) => module.HistoryGroupedLogList,
    ),
  { ssr: false },
);

type AttendanceHistoryResponse = {
  data: TodayAttendanceLog[];
  total: number;
  limit: number;
  offset: number;
};

type AttendanceHistoryAnalyticsBundleResponse = {
  summary: AttendanceHistorySummary;
  classSummary: AttendanceHistoryClassSummary[];
  studentSummary: AttendanceHistoryStudentSummary[];
  trend: AttendanceHistoryTrendPoint[];
  heatmap: AttendanceHistoryHeatmapPoint[];
};

type AttendanceRiskSettings = {
  alphaThreshold: number;
  lateThreshold: number;
  rateThreshold: number;
};

const HISTORY_DENSITY_STORAGE_KEY = "attendance:daily-log:history-density";
const HISTORY_ADVANCED_FILTERS_STORAGE_KEY =
  "attendance:daily-log:history-advanced-filters";
const HISTORY_QUICK_RANGE_STORAGE_KEY =
  "attendance:daily-log:history-quick-range";

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
  const [showHistoryAdvancedFilters, setShowHistoryAdvancedFilters] =
    useState(false);
  const [historyQuickRange, setHistoryQuickRange] =
    useState<HistoryQuickRange>("all");
  const [historyDensity, setHistoryDensity] =
    useState<HistoryDensity>("comfortable");
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
  const historyRequestKeyRef = useRef("");
  const historyRequestSeqRef = useRef(0);
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

  const loadHistoryLogs = useCallback(
    async (options?: { force?: boolean }) => {
      const requestKey = JSON.stringify({
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
        userId: user?.id ?? null,
      });

      if (!options?.force && requestKey === historyRequestKeyRef.current) {
        return;
      }

      historyRequestKeyRef.current = requestKey;
      const requestSeq = historyRequestSeqRef.current + 1;
      historyRequestSeqRef.current = requestSeq;

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
        if (historySearch.trim())
          params.set("searchQuery", historySearch.trim());
        if (historyStatus !== "all") params.set("status", historyStatus);
        if (historySource !== "all") params.set("source", historySource);
        if (historyStartDate) params.set("startDate", historyStartDate);
        if (historyEndDate) params.set("endDate", historyEndDate);
        if (analyticsClassFilter !== "all") {
          params.set("className", analyticsClassFilter);
        }
        const analyticsParams = new URLSearchParams(params);
        analyticsParams.set("analyticsBundle", "true");
        const [result, analytics] = await Promise.all([
          apiGet<AttendanceHistoryResponse>(
            `/api/attendance/history?${params.toString()}`,
          ),
          apiGet<AttendanceHistoryAnalyticsBundleResponse>(
            `/api/attendance/history?${analyticsParams.toString()}`,
          ),
        ]);

        if (requestSeq !== historyRequestSeqRef.current) {
          return;
        }

        setHistoryLogs(result.data);
        setHistoryTotal(result.total);
        setHistorySummary(analytics.summary);
        setHistoryClassSummary(analytics.classSummary);
        setHistoryStudentSummary(analytics.studentSummary);
        setHistoryTrend(analytics.trend);
        setHistoryHeatmap(analytics.heatmap);
      } catch (err) {
        if (requestSeq !== historyRequestSeqRef.current) {
          return;
        }
        setHistorySummary(null);
        setHistoryClassSummary([]);
        setHistoryStudentSummary([]);
        setHistoryTrend([]);
        setHistoryHeatmap([]);
        setError(
          err instanceof Error
            ? err.message
            : "Gagal memuat riwayat attendance",
        );
      } finally {
        if (requestSeq === historyRequestSeqRef.current) {
          setLoadingHistory(false);
        }
      }
    },
    [
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
    ],
  );

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
    if (activeTab !== "history") {
      return;
    }

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
  }, [activeTab, historyStudentSearch, isAdminView, isStudentView, user?.id]);

  useEffect(() => {
    if (activeTab !== "history") {
      return;
    }
    void loadHistoryLogs();
  }, [activeTab, loadHistoryLogs]);

  useEffect(() => {
    if (activeTab !== "history" || !isAdminView) {
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
  }, [activeTab, isAdminView]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const storedDensity = window.localStorage.getItem(
      HISTORY_DENSITY_STORAGE_KEY,
    );
    if (storedDensity === "comfortable" || storedDensity === "compact") {
      setHistoryDensity(storedDensity);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(HISTORY_DENSITY_STORAGE_KEY, historyDensity);
  }, [historyDensity]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const storedAdvancedFilters = window.localStorage.getItem(
      HISTORY_ADVANCED_FILTERS_STORAGE_KEY,
    );
    if (
      storedAdvancedFilters === "open" ||
      storedAdvancedFilters === "closed"
    ) {
      setShowHistoryAdvancedFilters(storedAdvancedFilters === "open");
    }

    const storedQuickRange = window.localStorage.getItem(
      HISTORY_QUICK_RANGE_STORAGE_KEY,
    );
    if (
      storedQuickRange === "today" ||
      storedQuickRange === "7d" ||
      storedQuickRange === "30d" ||
      storedQuickRange === "month" ||
      storedQuickRange === "all" ||
      storedQuickRange === "custom"
    ) {
      setHistoryQuickRange(storedQuickRange);
      if (!initialStartDate && !initialEndDate) {
        if (storedQuickRange === "all") {
          setHistoryStartDate("");
          setHistoryEndDate("");
        } else if (storedQuickRange === "today") {
          const today = getTodayDateString();
          setHistoryStartDate(today);
          setHistoryEndDate(today);
        } else if (storedQuickRange === "7d") {
          setHistoryStartDate(getDaysAgoDateString(6));
          setHistoryEndDate(getTodayDateString());
        } else if (storedQuickRange === "30d") {
          setHistoryStartDate(getDaysAgoDateString(29));
          setHistoryEndDate(getTodayDateString());
        } else if (storedQuickRange === "month") {
          setHistoryStartDate(getMonthStartDateString());
          setHistoryEndDate(getTodayDateString());
        }
      }
    }
  }, [initialEndDate, initialStartDate]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(
      HISTORY_ADVANCED_FILTERS_STORAGE_KEY,
      showHistoryAdvancedFilters ? "open" : "closed",
    );
  }, [showHistoryAdvancedFilters]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(
      HISTORY_QUICK_RANGE_STORAGE_KEY,
      historyQuickRange,
    );
  }, [historyQuickRange]);

  useEffect(() => {
    if (activeTab !== "history") {
      return;
    }

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
  }, [activeTab, selectedHistoryStudentId]);

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
          Bagian: "Tren",
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
          Bagian: "Peta Panas",
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
  const activeHistoryFilterCount = [
    historySearch.trim().length > 0,
    !isStudentView && selectedHistoryStudentId !== "all",
    historyStatus !== "all",
    historySource !== "all",
    historyGroupBy !== "none",
    historySort !== "latest",
    Boolean(historyStartDate),
    Boolean(historyEndDate),
  ].filter(Boolean).length;
  const hasHistoryFiltersActive = activeHistoryFilterCount > 0;

  function resetHistoryFilters(options?: {
    clearOffset?: boolean;
    clearError?: boolean;
  }) {
    setHistorySearch("");
    setHistoryStudentSearch("");
    setSelectedHistoryStudentId(isStudentView && user?.id ? user.id : "all");
    setHistoryStatus("all");
    setHistorySource("all");
    setHistoryGroupBy("none");
    setHistorySort("latest");
    setHistoryQuickRange("all");
    setHistoryStartDate("");
    setHistoryEndDate("");

    if (options?.clearOffset) {
      setHistoryOffset(0);
    }

    if (options?.clearError) {
      setError(null);
    }
  }

  function applyQuickRange(range: "today" | "7d" | "30d" | "month" | "all") {
    const today = getTodayDateString();
    setHistoryQuickRange(range);

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

  function handleHistoryStartDateChange(value: string) {
    setHistoryStartDate(value);
    setHistoryQuickRange("custom");
  }

  function handleHistoryEndDateChange(value: string) {
    setHistoryEndDate(value);
    setHistoryQuickRange("custom");
  }

  function isQuickRangeActive(range: "today" | "7d" | "30d" | "month" | "all") {
    const today = getTodayDateString();
    if (range === "all") {
      return !historyStartDate && !historyEndDate;
    }

    if (!historyStartDate || !historyEndDate) {
      return false;
    }

    if (range === "today") {
      return historyStartDate === today && historyEndDate === today;
    }

    if (range === "7d") {
      return (
        historyStartDate === getDaysAgoDateString(6) && historyEndDate === today
      );
    }

    if (range === "30d") {
      return (
        historyStartDate === getDaysAgoDateString(29) &&
        historyEndDate === today
      );
    }

    return (
      historyStartDate === getMonthStartDateString() && historyEndDate === today
    );
  }

  const groupedHistoryLogs =
    historyGroupBy === "none"
      ? []
      : historyLogs.reduce<HistoryLogGroup[]>((groups, log) => {
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
            void loadHistoryLogs({ force: true });
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
          className="w-full justify-start rounded-3xl border border-zinc-800 bg-linear-to-br from-zinc-950/90 to-zinc-900/80 p-1.5 shadow-inner shadow-black/20"
        >
          <TabsTrigger
            value="today"
            className="rounded-2xl border border-transparent px-4 py-3 text-zinc-200 after:hidden hover:text-white data-[state=active]:border-emerald-400/45 data-[state=active]:bg-linear-to-br data-[state=active]:from-emerald-600/25 data-[state=active]:to-emerald-500/15 data-[state=active]:text-white"
          >
            Hari Ini
          </TabsTrigger>
          <TabsTrigger
            value="history"
            className="rounded-2xl border border-transparent px-4 py-3 text-zinc-200 after:hidden hover:text-white data-[state=active]:border-sky-400/45 data-[state=active]:bg-linear-to-br data-[state=active]:from-sky-600/25 data-[state=active]:to-cyan-500/15 data-[state=active]:text-white"
          >
            Riwayat
          </TabsTrigger>
        </TabsList>

        <TabsContent value="today" className="space-y-4">
          <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
            <p className="text-sm text-zinc-400">
              {isStudentView
                ? "Log check-in dan check-out milik akun siswa yang sedang login."
                : "Log QR check-in/check-out hari ini."}
            </p>
            <Button
              variant="default"
              onClick={() => {
                void loadTodayLogs();
              }}
              className="h-11 w-full rounded-xl border border-sky-400/60 !bg-linear-to-br !from-sky-700 !to-cyan-600 px-4 !text-white shadow-sm shadow-sky-950/35 transition-all duration-200 hover:-translate-y-0.5 hover:border-sky-300/80 hover:!from-sky-600 hover:!to-cyan-500 hover:!text-white hover:shadow-md hover:shadow-sky-950/45 disabled:border-zinc-700 disabled:!from-zinc-800 disabled:!to-zinc-800 disabled:!text-zinc-300 sm:w-auto"
            >
              <RefreshCw className="mr-2 h-4 w-4 text-sky-100" />
              <span className="!text-white">Muat Ulang</span>
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
                        <p className="text-zinc-500">Masuk</p>
                        <p>{formatTime(log.checkInTime)}</p>
                      </div>
                      <div>
                        <p className="text-zinc-500">Pulang</p>
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
              description="Log masuk dan pulang QR yang berhasil akan muncul di panel ini."
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

          <HistoryFiltersPanel
            isStudentView={isStudentView}
            isAdminView={isAdminView}
            activeHistoryFilterCount={activeHistoryFilterCount}
            hasHistoryFiltersActive={hasHistoryFiltersActive}
            historyDensity={historyDensity}
            showHistoryAdvancedFilters={showHistoryAdvancedFilters}
            historySearch={historySearch}
            historyStudentSearch={historyStudentSearch}
            historyStudentOptions={historyStudentOptions}
            selectedHistoryStudentId={selectedHistoryStudentId}
            loadingStudentOptions={loadingStudentOptions}
            historyStatus={historyStatus}
            historySource={historySource}
            historyGroupBy={historyGroupBy}
            historySort={historySort}
            historyStartDate={historyStartDate}
            historyEndDate={historyEndDate}
            error={error}
            dateRangeInvalid={dateRangeInvalid}
            onHistoryDensityChange={setHistoryDensity}
            onToggleAdvancedFilters={() =>
              setShowHistoryAdvancedFilters((current) => !current)
            }
            onResetAllFilters={() => resetHistoryFilters()}
            onHistorySearchChange={setHistorySearch}
            onHistoryStudentSearchChange={setHistoryStudentSearch}
            onSelectedHistoryStudentIdChange={setSelectedHistoryStudentId}
            onHistoryStatusChange={setHistoryStatus}
            onHistorySourceChange={setHistorySource}
            onHistoryGroupByChange={setHistoryGroupBy}
            onHistorySortChange={setHistorySort}
            onHistoryStartDateChange={handleHistoryStartDateChange}
            onHistoryEndDateChange={handleHistoryEndDateChange}
            onApplyQuickRange={applyQuickRange}
            isQuickRangeActive={isQuickRangeActive}
            onResetInvalidFilterState={() =>
              resetHistoryFilters({ clearOffset: true, clearError: true })
            }
          />

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

          <HistoryAnalyticsPanel
            isAdminView={isAdminView}
            selectedHistoryStudentId={selectedHistoryStudentId}
            historyClassSummary={historyClassSummary}
            analyticsClassFilter={analyticsClassFilter}
            compareClassA={compareClassA}
            compareClassB={compareClassB}
            compareItemA={compareItemA}
            compareItemB={compareItemB}
            historyTrend={historyTrend}
            maxTrendTotal={maxTrendTotal}
            historyHeatmap={historyHeatmap}
            heatmapMonthLabel={heatmapMonthLabel}
            bestClass={bestClass}
            lowestClass={lowestClass}
            classSummaryLabel={classSummaryLabel}
            exportingClassSummary={exportingClassSummary}
            exportingAnalyticsReport={exportingAnalyticsReport}
            exportingCompareReport={exportingCompareReport}
            onAnalyticsClassFilterChange={setAnalyticsClassFilter}
            onCompareClassAChange={setCompareClassA}
            onCompareClassBChange={setCompareClassB}
            onExportClassSummary={() => {
              void handleExportClassSummary();
            }}
            onExportAnalyticsReport={() => {
              void handleExportAnalyticsReport();
            }}
            onExportCompareReport={() => {
              void handleExportCompareReport();
            }}
            onDrillDownToDate={drillDownToDate}
          />

          <HistoryRiskPanel
            historyStudentSummaryLength={historyStudentSummary.length}
            atRiskStudents={atRiskStudents}
            riskAlphaThreshold={riskAlphaThreshold}
            riskLateThreshold={riskLateThreshold}
            riskRateThreshold={riskRateThreshold}
            savingRiskSettings={savingRiskSettings}
            followUpNote={followUpNote}
            followUpDeadline={followUpDeadline}
            creatingFollowUpId={creatingFollowUpId}
            onRiskAlphaThresholdChange={setRiskAlphaThreshold}
            onRiskLateThresholdChange={setRiskLateThreshold}
            onRiskRateThresholdChange={setRiskRateThreshold}
            onSaveRiskSettings={() => {
              void handleSaveRiskSettings();
            }}
            onFollowUpNoteChange={setFollowUpNote}
            onFollowUpDeadlineChange={setFollowUpDeadline}
            onDrillDownToStudent={drillDownToStudent}
            onCreateFollowUp={(student) => {
              void handleCreateFollowUp(student);
            }}
          />

          <HistoryInsightsPanel
            selectedHistoryStudentId={selectedHistoryStudentId}
            followUpHistory={followUpHistory}
            historySummary={historySummary}
            historyClassSummaryLength={historyClassSummary.length}
            atRiskStudentsLength={atRiskStudents.length}
            internalNotifications={internalNotifications}
            historyStudentSummaryLength={historyStudentSummary.length}
            topStudentSummary={topStudentSummary}
            topLateStudents={topLateStudents}
            topAbsentStudents={topAbsentStudents}
            exportingStudentSummary={exportingStudentSummary}
            exportingRiskRanking={exportingRiskRanking}
            onExportStudentSummary={() => {
              void handleExportStudentSummary();
            }}
            onExportRiskRanking={() => {
              void handleExportRiskRanking();
            }}
            onDrillDownToStudent={drillDownToStudent}
          />

          <HistoryExportToolbar
            historyLogsLength={historyLogs.length}
            historyTotal={historyTotal}
            historyStartDate={historyStartDate}
            historyEndDate={historyEndDate}
            historyStatus={historyStatus}
            historySource={historySource}
            historyGroupBy={historyGroupBy}
            exportingHistory={exportingHistory}
            exportingPdf={exportingPdf}
            printingReport={printingReport}
            loadingHistory={loadingHistory}
            canGoPrev={historyPage > 1 && !loadingHistory}
            canGoNext={
              historyPage < totalHistoryPages &&
              !loadingHistory &&
              historyTotal > 0
            }
            onExportHistory={() => {
              void handleExportHistory();
            }}
            onExportPdf={() => {
              void handleExportHistoryPdf();
            }}
            onPrintReport={() => {
              void handlePrintHistoryReport();
            }}
            onResetDate={() => {
              setHistoryQuickRange("all");
              setHistoryStartDate("");
              setHistoryEndDate("");
            }}
            onPrevPage={() =>
              setHistoryOffset((current) => Math.max(0, current - historyLimit))
            }
            onNextPage={() =>
              setHistoryOffset((current) =>
                Math.min(
                  Math.max(0, (totalHistoryPages - 1) * historyLimit),
                  current + historyLimit,
                ),
              )
            }
          />

          {loadingHistory ? (
            <div
              className="rounded-3xl border border-dashed border-zinc-800/80 bg-zinc-950/35 p-3 sm:p-4"
              aria-live="polite"
              aria-busy="true"
            >
              <HistoryLoadingSkeleton
                density={historyDensity}
                grouped={historyGroupBy !== "none"}
              />
            </div>
          ) : historyLogs.length > 0 ? (
            historyGroupBy === "none" ? (
              <HistoryLogList
                logs={historyLogs}
                density={historyDensity}
                formatStatusLabel={formatStatusLabel}
                formatTime={formatTime}
              />
            ) : (
              <HistoryGroupedLogList
                groups={groupedHistoryLogs}
                groupBy={historyGroupBy}
                density={historyDensity}
                formatStatusLabel={formatStatusLabel}
                formatTime={formatTime}
              />
            )
          ) : (
            <InlineState
              title="Riwayat belum tersedia"
              description={
                hasHistoryFiltersActive
                  ? "Belum ada riwayat absensi yang cocok dengan filter aktif. Coba reset filter untuk melihat seluruh data."
                  : "Belum ada riwayat absensi pada periode ini."
              }
              variant="info"
              actionLabel={hasHistoryFiltersActive ? "Reset Filter" : undefined}
              onAction={
                hasHistoryFiltersActive
                  ? () => resetHistoryFilters()
                  : undefined
              }
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
