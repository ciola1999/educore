"use client";

import { useCallback, useEffect, useState } from "react";
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
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const fetchStudents = useCallback(
    async (
      page = currentPage,
      search = searchQuery,
      nextSortBy = sortBy,
      nextSortDir = sortDir,
    ) => {
      setLoading(true);
      setError(null);
      try {
        await ensureAppWarmup();

        const params = new URLSearchParams({
          page: String(page),
          limit: "12",
          sortBy: nextSortBy,
          sortDir: nextSortDir,
        });
        if (search.trim()) {
          params.set("search", search.trim());
        }

        const result = await apiGet<StudentListResponse>(
          `/api/students?${params.toString()}`,
          { timeoutMs: 20_000 },
        );

        const date = getTodayDateString();
        const ids = result.data.map((student) => student.id).join(",");
        let attendanceMap = new Map<string, AttendanceTodaySnapshot>();

        if (ids) {
          try {
            const attendanceRows = await apiGet<AttendanceTodaySnapshot[]>(
              `/api/students/attendance-today?date=${date}&ids=${encodeURIComponent(ids)}`,
              { timeoutMs: 20_000 },
            );
            attendanceMap = new Map(
              attendanceRows.map((row) => [row.studentId, row]),
            );
          } catch {
            attendanceMap = new Map();
          }
        }

        setStudents(
          result.data.map((student) => ({
            ...student,
            attendanceToday: attendanceMap.get(student.id) ?? null,
          })),
        );
        setTotalPages(result.totalPages);
        setTotalCount(result.total);
        setCurrentPage(result.page);
      } catch (err) {
        setStudents([]);
        setTotalPages(1);
        setTotalCount(0);
        setError(
          err instanceof Error ? err.message : "Gagal memuat data siswa",
        );
      } finally {
        setLoading(false);
      }
    },
    [currentPage, searchQuery, sortBy, sortDir],
  );

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    setError(null);
    try {
      await ensureAppWarmup();
      const result = await apiGet<StudentStats>("/api/students/stats", {
        timeoutMs: 20_000,
      });
      setStats(result);
    } catch (err) {
      setStats(null);
      setError(
        err instanceof Error ? err.message : "Gagal memuat ringkasan siswa",
      );
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStudents(currentPage, searchQuery, sortBy, sortDir);
  }, [currentPage, fetchStudents, searchQuery, sortBy, sortDir]);

  useEffect(() => {
    void fetchStats();
  }, [fetchStats]);

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
    error,
    sortBy,
    setSortBy,
    sortDir,
    setSortDir,
    fetchStudents,
    fetchStats,
  };
}
