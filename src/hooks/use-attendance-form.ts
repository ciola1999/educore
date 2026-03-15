"use client";

import { format } from "date-fns";
import { and, eq, isNull, or, sql } from "drizzle-orm";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { recordBulkAttendance } from "@/core/services/attendance-service";
import { getDb } from "@/lib/db";
import { classes, studentDailyAttendance, students } from "@/lib/db/schema";
import { syncUsersToStudentsProjection } from "@/lib/services/student-projection";
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

export function useAttendanceForm() {
  const authUser = useStore((state) => state.user);
  const [isMounted, setIsMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [studentList, setStudentList] = useState<StudentRecord[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>(
    format(new Date(), "yyyy-MM-dd"),
  );
  const [classList, setClassList] = useState<ClassOption[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(25);
  const [searchQuery, setSearchQuery] = useState("");

  // 1. Initial Mount & Background Sync Guard
  useEffect(() => {
    setIsMounted(true);

    // Check if we've already synced in this session to avoid reload loops
    const lastSync = sessionStorage.getItem("attendance_projection_last_sync");
    const now = Date.now();

    // Only sync once every 5 minutes in background
    if (!lastSync || now - Number(lastSync) > 300000) {
      void syncUsersToStudentsProjection().then(() => {
        sessionStorage.setItem(
          "attendance_projection_last_sync",
          now.toString(),
        );
      });
    }
  }, []);

  // 2. Load Classes (Once)
  useEffect(() => {
    let cancelled = false;

    async function loadClasses() {
      try {
        const db = await getDb();
        const result = await db
          .select({ id: classes.id, name: classes.name })
          .from(classes)
          .where(isNull(classes.deletedAt));

        if (!cancelled) {
          const options = [{ id: "all", name: "All Students" }, ...result];
          setClassList(options);
          // Set default class if not set
          setSelectedClass((prev) => prev || "all");
        }
      } catch (error) {
        console.error("Failed to load classes:", error);
      }
    }

    void loadClasses();
    return () => {
      cancelled = true;
    };
  }, []);

  // 3. Student Loader (Stabilized)
  const loadStudentsByClass = useCallback(
    async (classId: string, date: string, isAutoRefresh = false) => {
      if (!isAutoRefresh) setLoading(true);
      try {
        const db = await getDb();
        let studentResults: (typeof students.$inferSelect)[];

        if (classId === "all") {
          studentResults = await db
            .select()
            .from(students)
            .where(isNull(students.deletedAt));
        } else {
          const classData = classList.find((item) => item.id === classId);
          if (!classData) return;

          studentResults = await db
            .select()
            .from(students)
            .where(
              and(
                or(
                  eq(
                    sql`LOWER(${students.grade})`,
                    classData.name.toLowerCase(),
                  ),
                  eq(students.grade, classData.id),
                ),
                isNull(students.deletedAt),
              ),
            );
        }

        const dailyLogs = await db
          .select()
          .from(studentDailyAttendance)
          .where(
            and(
              eq(studentDailyAttendance.date, date),
              isNull(studentDailyAttendance.deletedAt),
            ),
          );

        const logMap = new Map(dailyLogs.map((log) => [log.studentId, log]));

        setStudentList(
          studentResults.map((student) => {
            const log = logMap.get(student.id);
            return {
              id: student.id,
              nis: student.nis,
              nisn: student.nisn,
              fullName: student.fullName,
              grade: student.grade,
              tempatLahir: student.tempatLahir,
              tanggalLahir: student.tanggalLahir,
              alamat: student.alamat,
              parentName: student.parentName,
              parentPhone: student.parentPhone,
              status: "present", // Default for manual entry
              notes: "",
              checkInTime: log?.checkInTime,
              checkOutTime: log?.checkOutTime,
              isLocked: !!log,
            };
          }),
        );
      } catch (error) {
        console.error("Failed to fetch students:", error);
      } finally {
        if (!isAutoRefresh) setLoading(false);
      }
    },
    [classList],
  );

  const refreshStudents = useCallback(() => {
    if (selectedClass) {
      void loadStudentsByClass(selectedClass, selectedDate);
    }
  }, [loadStudentsByClass, selectedClass, selectedDate]);

  // 4. Data Refresh Effect
  useEffect(() => {
    if (!selectedClass) return;

    loadStudentsByClass(selectedClass, selectedDate);
    setCurrentPage(1);
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

      await recordBulkAttendance({
        classId: selectedClass === "all" ? "manual_bulk" : selectedClass,
        date: selectedDate,
        records: recordableStudents.map((s) => ({
          studentId: s.id,
          status: s.status,
          notes: s.notes,
        })),
        recordedBy: authUser.id,
      });

      toast.success("Attendance recorded successfully");
    } catch (error) {
      console.error("Error recording attendance:", error);
      toast.error("Failed to record attendance");
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
    refreshStudents,
  };
}
