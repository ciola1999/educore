import type { AttendanceStatus } from "@/types/attendance";

export type AttendanceSearchStudent = {
  id: string;
  nis: string;
  nisn?: string | null;
  fullName: string;
  status: AttendanceStatus;
  notes: string;
  isLocked?: boolean;
};

export function filterAttendanceStudents<T extends AttendanceSearchStudent>(
  studentList: T[],
  searchQuery: string,
): T[] {
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  if (!normalizedSearchQuery) {
    return studentList;
  }

  return studentList.filter((student) => {
    return (
      student.fullName.toLowerCase().includes(normalizedSearchQuery) ||
      student.nis.toLowerCase().includes(normalizedSearchQuery) ||
      student.nisn?.toLowerCase().includes(normalizedSearchQuery)
    );
  });
}

export function buildManualAttendanceSubmissionTargets<
  T extends AttendanceSearchStudent,
>(studentList: T[], searchQuery: string) {
  const targetStudents = filterAttendanceStudents(studentList, searchQuery);
  const recordableStudents = targetStudents.filter(
    (student) => !student.isLocked,
  );

  return {
    targetStudents,
    recordableStudents,
  };
}
