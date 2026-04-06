import { describe, expect, it } from "vitest";
import {
  type AttendanceSearchStudent,
  buildManualAttendanceSubmissionTargets,
  filterAttendanceStudents,
} from "./use-attendance-form.utils";

function createStudent(
  overrides: Partial<AttendanceSearchStudent>,
): AttendanceSearchStudent {
  return {
    id: overrides.id ?? "student-1",
    nis: overrides.nis ?? "1001",
    nisn: overrides.nisn ?? null,
    fullName: overrides.fullName ?? "Budi Santoso",
    status: overrides.status ?? "present",
    notes: overrides.notes ?? "",
    isLocked: overrides.isLocked ?? false,
  };
}

describe("use-attendance-form utils", () => {
  it("filters students by active search query across name, nis, and nisn", () => {
    const students = [
      createStudent({
        id: "student-1",
        nis: "1001",
        nisn: "998877",
        fullName: "Budi Santoso",
      }),
      createStudent({
        id: "student-2",
        nis: "1002",
        nisn: "112233",
        fullName: "Siti Aminah",
      }),
    ];

    expect(filterAttendanceStudents(students, "budi")).toHaveLength(1);
    expect(filterAttendanceStudents(students, "1002")).toHaveLength(1);
    expect(filterAttendanceStudents(students, "998877")).toHaveLength(1);
  });

  it("limits manual submission targets to the visible filtered students and skips locked rows", () => {
    const students = [
      createStudent({
        id: "student-visible-editable",
        nis: "2001",
        fullName: "Tes Manual",
      }),
      createStudent({
        id: "student-visible-locked",
        nis: "2002",
        fullName: "Tes Manual Locked",
        isLocked: true,
      }),
      createStudent({
        id: "student-hidden",
        nis: "2003",
        fullName: "Tidak Cocok Search",
      }),
    ];

    const result = buildManualAttendanceSubmissionTargets(
      students,
      "Tes Manual",
    );

    expect(result.targetStudents.map((student) => student.id)).toEqual([
      "student-visible-editable",
      "student-visible-locked",
    ]);
    expect(result.recordableStudents.map((student) => student.id)).toEqual([
      "student-visible-editable",
    ]);
  });
});
