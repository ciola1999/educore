"use client";

import { format } from "date-fns";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { apiGet, apiPost } from "@/lib/api/request";
import { useStore } from "@/lib/store/use-store";
import type { AttendanceStatus } from "@/lib/validations/schemas";

export interface StudentRecord {
  id: string;
  nis: string;
  nisn?: string | null;
  fullName: string;
  grade: string;
  tempatLahir?: string | null;
  tanggalLahir?: Date | null;
  alamat?: string | null;
  parentName?: string | null;
  parentPhone?: string | null;
  status: AttendanceStatus;
  notes: string;
  checkInTime?: Date | null;
  checkOutTime?: Date | null;
  isLocked?: boolean;
}

export interface ClassOption {
  id: string;
  name: string;
}

type AttendanceFormInitialState = {
  initialClassId?: string;
  initialClassName?: string;
  initialDate?: string;
};

function normalizeDateInput(value?: string): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
}

function resolveInitialClassId(
  options: ClassOption[],
  initialClassId?: string,
  initialClassName?: string,
): string | null {
  const normalizedClassId = initialClassId?.trim();
  if (
    normalizedClassId &&
    options.some((option) => option.id === normalizedClassId)
  ) {
    return normalizedClassId;
  }

  const normalizedClassName = initialClassName?.trim().toLowerCase();
  if (normalizedClassName) {
    const byName = options.find(
      (option) => option.name.trim().toLowerCase() === normalizedClassName,
    );
    if (byName) {
      return byName.id;
    }
  }

  return null;
}

export function useAttendanceForm(
  initialState: AttendanceFormInitialState = {},
) {
  const authUser = useStore((state) => state.user);
  const [isMounted, setIsMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [classLoadError, setClassLoadError] = useState<string | null>(null);
  const [studentLoadError, setStudentLoadError] = useState<string | null>(null);
  const [studentList, setStudentList] = useState<StudentRecord[]>([]);
  const initialDate = normalizeDateInput(initialState.initialDate);
  const [selectedDate, setSelectedDate] = useState<string>(
    initialDate || format(new Date(), "yyyy-MM-dd"),
  );
  const [classList, setClassList] = useState<ClassOption[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(25);
  const [searchQuery, setSearchQuery] = useState("");

  async function loadClasses() {
    const data = await apiGet<ClassOption[]>("/api/attendance/classes");
    const options = [{ id: "all", name: "All Students" }, ...(data || [])];
    setClassList(options);
    const initialClassId = resolveInitialClassId(
      options,
      initialState.initialClassId,
      initialState.initialClassName,
    );
    setSelectedClass(
      (prev) => prev || initialClassId || data?.[0]?.id || "all",
    );
  }

  // 1. Initial Mount & Background Sync Guard
  useEffect(() => {
    setIsMounted(true);

    // Check if we've already synced in this session to avoid reload loops
    const lastSync = sessionStorage.getItem("attendance_projection_last_sync");
    const now = Date.now();

    // Only sync once every 5 minutes in background
    if (!lastSync || now - Number(lastSync) > 300000) {
      void apiPost<{
        classCreated: number;
        studentUpserted: number;
        settingsSeeded: number;
      }>("/api/attendance/projection-sync")
        .then(() => {
          sessionStorage.setItem(
            "attendance_projection_last_sync",
            now.toString(),
          );
        })
        .catch((error) => {
          const message =
            error instanceof Error
              ? error.message
              : "Sinkronisasi proyeksi attendance gagal";
          toast.warning(message);
        });
    }
  }, []);

  // 2. Load Classes (Once)
  useEffect(() => {
    let cancelled = false;

    async function loadAttendanceClasses() {
      try {
        setClassLoadError(null);
        const data = await apiGet<ClassOption[]>("/api/attendance/classes");
        if (cancelled) {
          return;
        }
        const options = [{ id: "all", name: "All Students" }, ...(data || [])];
        const initialClassId = resolveInitialClassId(
          options,
          initialState.initialClassId,
          initialState.initialClassName,
        );
        setClassList(options);
        setSelectedClass(
          (prev) => prev || initialClassId || data?.[0]?.id || "all",
        );
      } catch (error) {
        if (!cancelled) {
          setClassList([]);
          const message =
            error instanceof Error
              ? error.message
              : "Gagal memuat daftar kelas attendance";
          setClassLoadError(message);
          toast.error(message);
        }
      }
    }

    void loadAttendanceClasses();
    return () => {
      cancelled = true;
    };
  }, [initialState.initialClassId, initialState.initialClassName]);

  // 3. Student Loader (Stabilized)
  const loadStudentsByClass = useCallback(
    async (classId: string, date: string, isAutoRefresh = false) => {
      if (!isAutoRefresh) setLoading(true);
      try {
        setStudentLoadError(null);
        const params = new URLSearchParams({
          classId,
          date,
        });
        const data = await apiGet<StudentRecord[]>(
          `/api/attendance/students?${params.toString()}`,
        );
        setStudentList(data || []);
      } catch (error) {
        setStudentList([]);
        const message =
          error instanceof Error
            ? error.message
            : "Gagal memuat daftar siswa untuk attendance";
        setStudentLoadError(message);
        toast.error(message);
      } finally {
        if (!isAutoRefresh) setLoading(false);
      }
    },
    [],
  );

  function refreshStudents() {
    if (selectedClass) {
      void loadStudentsByClass(selectedClass, selectedDate);
    }
  }

  // 4. Data Refresh Effect
  useEffect(() => {
    let cancelled = false;
    if (!selectedClass) return;

    void (async () => {
      if (!selectedClass) return;
      if (!cancelled) {
        await loadStudentsByClass(selectedClass, selectedDate);
      }
    })();
    setCurrentPage(1);

    return () => {
      cancelled = true;
    };
  }, [loadStudentsByClass, selectedClass, selectedDate]);

  const updateStatus = (studentId: string, status: AttendanceStatus) => {
    setStudentList((prev) =>
      prev.map((s) => (s.id === studentId ? { ...s, status } : s)),
    );
  };

  const setAllPresent = () => {
    setStudentList((prev) =>
      prev.map((s) => (s.isLocked ? s : { ...s, status: "present" })),
    );
    toast.success("Set all students to present");
  };

  const handleSubmit = async () => {
    if (!selectedClass) {
      toast.error("Please select a class");
      return;
    }

    if (selectedClass === "all") {
      toast.error(
        "Pilih satu kelas spesifik untuk menyimpan absensi manual. Opsi All Students hanya untuk melihat data.",
      );
      return;
    }

    if (!authUser) {
      toast.error("Unauthenticated");
      return;
    }

    setSubmitting(true);
    try {
      // Filter out locked students as they are already handled by QR
      const recordableStudents = studentList.filter((s) => !s.isLocked);

      if (recordableStudents.length === 0) {
        toast.info("All records for this class were already synced via QR.");
        return;
      }

      const result = await apiPost<{ success: true; message: string }>(
        "/api/attendance/bulk",
        {
          classId: selectedClass,
          date: selectedDate,
          records: recordableStudents.map((s) => ({
            studentId: s.id,
            status: s.status,
            notes: s.notes,
          })),
        },
      );
      toast.success(result.message || "Attendance recorded successfully");
      await loadStudentsByClass(selectedClass, selectedDate, true);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to record attendance",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const filteredList = studentList.filter((s) => {
    if (!searchQuery) return true;
    const search = searchQuery.toLowerCase();
    return (
      s.fullName.toLowerCase().includes(search) ||
      s.nis.toLowerCase().includes(search) ||
      s.nisn?.toLowerCase().includes(search)
    );
  });

  const totalPages = Math.ceil(filteredList.length / itemsPerPage);
  const paginatedStudentList = filteredList.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage,
  );

  return {
    isMounted,
    loading,
    submitting,
    classLoadError,
    studentLoadError,
    studentList,
    paginatedStudentList,
    currentPage,
    setCurrentPage,
    totalPages,
    totalItems: filteredList.length,
    itemsPerPage,
    searchQuery,
    setSearchQuery,
    selectedDate,
    setSelectedDate,
    selectedClass,
    setSelectedClass,
    classList,
    updateStatus,
    setAllPresent,
    handleSubmit,
    loadClasses,
    refreshStudents,
  };
}
