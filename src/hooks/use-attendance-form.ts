"use client";

import { and, eq, isNull, or } from "drizzle-orm";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { getDb } from "@/lib/db";
import { classes, students } from "@/lib/db/schema";
import { recordBulkAttendance } from "@/lib/services/attendance";
import { syncUsersToStudentsProjection } from "@/lib/services/student-projection";
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

export function useAttendanceForm() {
  const [isMounted, setIsMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [studentList, setStudentList] = useState<StudentRecord[]>([]);
  const [selectedDate, setSelectedDate] = useState(
    () => new Date().toISOString().split("T")[0],
  );
  const [selectedClass, setSelectedClass] = useState("");
  const [classList, setClassList] = useState<ClassOption[]>([]);
  const [projectionSynced, setProjectionSynced] = useState(false);

  const fetchClasses = useCallback(async () => {
    try {
      if (!projectionSynced) {
        await syncUsersToStudentsProjection();
        setProjectionSynced(true);
      }

      const db = await getDb();
      const result = await db
        .select({ id: classes.id, name: classes.name })
        .from(classes)
        .where(and(eq(classes.isActive, true), isNull(classes.deletedAt)));
      setClassList(result);
      if (result.length > 0 && !selectedClass) {
        setSelectedClass(result[0].id);
      }
    } catch (e) {
      console.error("Failed to fetch classes:", e);
      toast.error("Failed to fetch classes");
    } finally {
      setLoading(false);
    }
  }, [projectionSynced, selectedClass]);

  const fetchStudentsByClass = useCallback(
    async (classId: string) => {
      setLoading(true);
      try {
        const db = await getDb();
        const classData = classList.find((c) => c.id === classId);
        if (!classData) {
          setStudentList([]);
          setLoading(false);
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

        const records: StudentRecord[] = result.map((s) => ({
          id: s.id,
          nis: s.nis,
          nisn: s.nisn,
          fullName: s.fullName,
          grade: s.grade,
          tempatLahir: s.tempatLahir,
          tanggalLahir: s.tanggalLahir,
          alamat: s.alamat,
          parentName: s.parentName,
          parentPhone: s.parentPhone,
          status: "present",
          notes: "",
        }));
        setStudentList(records);
      } catch (e) {
        console.error("Failed to fetch students:", e);
        toast.error("Failed to fetch students");
      } finally {
        setLoading(false);
      }
    },
    [classList],
  );

  useEffect(() => {
    setIsMounted(true);
    fetchClasses();
  }, [fetchClasses]);

  useEffect(() => {
    if (selectedClass) {
      fetchStudentsByClass(selectedClass);
    }
  }, [selectedClass, fetchStudentsByClass]);

  const updateStatus = (studentId: string, status: AttendanceStatus) => {
    setStudentList((prev) =>
      prev.map((s) => (s.id === studentId ? { ...s, status } : s)),
    );
  };

  const setAllPresent = () => {
    setStudentList((prev) => prev.map((s) => ({ ...s, status: "present" })));
  };

  const handleSubmit = async () => {
    if (!selectedClass) return;

    setSubmitting(true);
    const promise = async () => {
      const result = await recordBulkAttendance({
        classId: selectedClass,
        date: selectedDate,
        recordedBy: "550e8400-e29b-41d4-a716-446655440001", // TODO: Get from auth context
        records: studentList.map((s) => ({
          studentId: s.id,
          status: s.status,
          notes: s.notes,
        })),
      });

      if (!result.success) {
        throw new Error(result.message);
      }
      return result;
    };

    toast.promise(promise(), {
      loading: "Saving attendance...",
      success: () => `Attendance saved for ${studentList.length} students!`,
      error: (err) => `Failed: ${err.message}`,
    });

    try {
      await promise();
    } catch (e) {
      console.error("Submit error:", e);
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
