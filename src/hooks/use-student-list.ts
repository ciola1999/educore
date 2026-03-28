"use client";

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useRef,
  useState,
} from "react";
import { apiGet, apiPost } from "@/lib/api/request";
import { ensureAppWarmup, scheduleIdleTask } from "@/lib/runtime/app-bootstrap";

export type AttendanceTodayStatus =
  | "present"
  | "late"
  | "sick"
  | "permission"
  | "alpha";

export type AttendanceTodaySnapshot = {
  studentId: string;
  status: AttendanceTodayStatus;
  source: "qr" | "manual";
  checkInTime: string | Date | null;
  checkOutTime: string | Date | null;
};

export type StudentListItem = {
  id: string;
  nis: string;
  nisn: string | null;
  fullName: string;
  gender: "L" | "P";
  grade: string;
  parentName: string | null;
  parentPhone: string | null;
  tempatLahir: string | null;
  tanggalLahir: string | Date | null;
  alamat: string | null;
  hasAccount: boolean;
  accountEmail?: string | null;
  createdAt: string | Date;
  attendanceToday?: AttendanceTodaySnapshot | null;
};

type StudentStats = {
  total: number;
  male: number;
  female: number;
  activeGrades: number;
};

type StudentListResponse = {
  data: StudentListItem[];
  total: number;
  page: number;
  totalPages: number;
  stats?: StudentStats | null;
};

function getTodayDateString() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export function useStudentList() {
  const [loading, setLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [students, setStudents] = useState<StudentListItem[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [stats, setStats] = useState<StudentStats | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const listRequestRef = useRef(0);
  const statsRequestRef = useRef(0);

  const resolveListParams = useCallback(
    (
      page = currentPage,
      search = deferredSearchQuery,
      nextSortBy = sortBy,
      nextSortDir = sortDir,
    ) => ({
      page,
      search,
      sortBy: nextSortBy,
      sortDir: nextSortDir,
    }),
    [currentPage, deferredSearchQuery, sortBy, sortDir],
  );

  const fetchStudents = useCallback(
    async (
      page = currentPage,
      search = deferredSearchQuery,
      nextSortBy = sortBy,
      nextSortDir = sortDir,
    ) => {
      const requestId = ++listRequestRef.current;
      setLoading(true);
      setListError(null);
      try {
        await ensureAppWarmup();

        const params = new URLSearchParams({
          page: String(page),
          limit: "12",
          sortBy: nextSortBy,
          sortDir: nextSortDir,
          includeStats: "1",
          includeAttendanceToday: "1",
          date: getTodayDateString(),
        });
        if (search.trim()) {
          params.set("search", search.trim());
        }

        const result = await apiGet<StudentListResponse>(
          `/api/students?${params.toString()}`,
          { timeoutMs: 20_000 },
        );

        if (requestId !== listRequestRef.current) {
          return;
        }

        setStudents(result.data);
        setTotalPages(result.totalPages);
        setTotalCount(result.total);
        setCurrentPage(result.page);
        if (result.stats) {
          setStats(result.stats);
          setStatsError(null);
        }
      } catch (err) {
        if (requestId !== listRequestRef.current) {
          return;
        }
        setStudents([]);
        setTotalPages(1);
        setTotalCount(0);
        setListError(
          err instanceof Error ? err.message : "Gagal memuat data siswa",
        );
      } finally {
        if (requestId === listRequestRef.current) {
          setLoading(false);
        }
      }
    },
    [currentPage, deferredSearchQuery, sortBy, sortDir],
  );

  const fetchStats = useCallback(async () => {
    const requestId = ++statsRequestRef.current;
    setStatsLoading(true);
    setStatsError(null);
    try {
      await ensureAppWarmup();
      const result = await apiGet<StudentStats>("/api/students/stats", {
        timeoutMs: 20_000,
      });
      if (requestId !== statsRequestRef.current) {
        return;
      }
      setStats(result);
    } catch (err) {
      if (requestId !== statsRequestRef.current) {
        return;
      }
      setStats(null);
      setStatsError(
        err instanceof Error ? err.message : "Gagal memuat ringkasan siswa",
      );
    } finally {
      if (requestId === statsRequestRef.current) {
        setStatsLoading(false);
      }
    }
  }, []);

  const refreshList = useCallback(async () => {
    const params = resolveListParams();
    await fetchStudents(
      params.page,
      params.search,
      params.sortBy,
      params.sortDir,
    );
  }, [fetchStudents, resolveListParams]);

  const refreshAll = useCallback(async () => {
    await refreshList();
  }, [refreshList]);

  useEffect(() => {
    const params = resolveListParams();
    void fetchStudents(
      params.page,
      params.search,
      params.sortBy,
      params.sortDir,
    );
  }, [fetchStudents, resolveListParams]);

  useEffect(() => {
    const key = "students_projection_last_sync";
    const cancelIdleTask = scheduleIdleTask(() => {
      const lastSync = sessionStorage.getItem(key);
      const now = Date.now();

      if (lastSync && now - Number(lastSync) <= 300000) {
        return;
      }

      void ensureAppWarmup()
        .then(() =>
          apiPost<{
            classCreated: number;
            studentUpserted: number;
            settingsSeeded: number;
          }>("/api/attendance/projection-sync", undefined, {
            timeoutMs: 30_000,
          }),
        )
        .then(() => {
          sessionStorage.setItem(key, now.toString());
        })
        .catch(() => {
          // Keep student list usable even when projection sync endpoint is unavailable.
        });
    }, 2_500);

    return () => {
      cancelIdleTask();
    };
  }, []);

  return {
    loading,
    statsLoading,
    searchQuery,
    setSearchQuery,
    currentPage,
    setCurrentPage,
    students,
    totalPages,
    totalCount,
    stats,
    error: listError ?? statsError,
    listError,
    statsError,
    sortBy,
    setSortBy,
    sortDir,
    setSortDir,
    fetchStudents,
    fetchStats,
    refreshList,
    refreshAll,
  };
}
