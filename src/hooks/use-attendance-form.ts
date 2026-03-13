"use client";

import { and, eq, isNull, or } from "drizzle-orm";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { recordBulkAttendance } from "@/core/services/attendance-service";
import { getDb } from "@/lib/db";
import { classes, students } from "@/lib/db/schema";
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
}

export interface ClassOption {
  id: string;
  name: string;
}

function getLocalDateString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function useAttendanceForm() {
  const authUser = useStore((state) => state.user);

  const [isMounted, setIsMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [studentList, setStudentList] = useState<StudentRecord[]>([]);
  const [selectedDate, setSelectedDate] = useState(getLocalDateString);
  const [selectedClass, setSelectedClass] = useState("");
  const [classList, setClassList] = useState<ClassOption[]>([]);
  const [projectionSynced, setProjectionSynced] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadClasses() {
      setLoading(true);
      try {
        if (!projectionSynced) {
          await syncUsersToStudentsProjection();
          if (!cancelled) {
            setProjectionSynced(true);
          }
        }

        const db = await getDb();
        const result = await db
          .select({ id: classes.id, name: classes.name })
          .from(classes)
          .where(and(eq(classes.isActive, true), isNull(classes.deletedAt)));

        if (cancelled) {
          return;
        }

        setClassList(result);
        if (result.length > 0 && !selectedClass) {
          setSelectedClass(result[0].id);
        }
      } catch {
        if (!cancelled) {
          toast.error("Failed to fetch classes");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadClasses();

    return () => {
      cancelled = true;
    };
  }, [projectionSynced, selectedClass]);

  useEffect(() => {
    let cancelled = false;

    async function loadStudentsByClass(classId: string) {
      setLoading(true);
      try {
        const db = await getDb();
        const classData = classList.find((item) => item.id === classId);

        if (!classData) {
          if (!cancelled) {
            setStudentList([]);
          }
          return;
        }

        const result = await db
          .select()
          .from(students)
          .where(
            and(
              or(
                eq(students.grade, classData.name),
                eq(students.grade, classData.id),
              ),
              isNull(students.deletedAt),
            ),
          );

        if (cancelled) {
          return;
        }

        setStudentList(
          result.map((student) => ({
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
            status: "present",
            notes: "",
          })),
        );
      } catch {
        if (!cancelled) {
          toast.error("Failed to fetch students");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    if (selectedClass) {
      void loadStudentsByClass(selectedClass);
    }

    return () => {
      cancelled = true;
    };
  }, [classList, selectedClass]);

  const updateStatus = (studentId: string, status: AttendanceStatus) => {
    setStudentList((prev) =>
      prev.map((student) =>
        student.id === studentId ? { ...student, status } : student,
      ),
    );
  };

  const setAllPresent = () => {
    setStudentList((prev) =>
      prev.map((student) => ({ ...student, status: "present" })),
    );
  };

  const handleSubmit = async () => {
    if (!selectedClass) {
      toast.error("Silakan pilih kelas terlebih dahulu");
      return;
    }

    if (!authUser?.id) {
      toast.error("Sesi login tidak ditemukan. Silakan login ulang.");
      return;
    }

    setSubmitting(true);
    try {
      const result = await recordBulkAttendance({
        classId: selectedClass,
        date: selectedDate,
        recordedBy: authUser.id,
        records: studentList.map((student) => ({
          studentId: student.id,
          status: student.status,
          notes: student.notes || undefined,
        })),
      });

      if (!result.success) {
        toast.error(result.message);
        return;
      }

      toast.success(`Attendance saved for ${studentList.length} students`);
    } catch {
      toast.error("Failed to save attendance");
    } finally {
      setSubmitting(false);
    }
  };

  return {
    isMounted,
    loading,
    submitting,
    studentList,
    selectedDate,
    setSelectedDate,
    selectedClass,
    setSelectedClass,
    classList,
    updateStatus,
    setAllPresent,
    handleSubmit,
  };
}
