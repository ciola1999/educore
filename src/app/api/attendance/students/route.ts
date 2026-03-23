import { and, eq, isNull } from "drizzle-orm";
import { getAttendanceRosterStudents } from "@/core/services/attendance-service";
import { requirePermission } from "@/lib/api/authz";
import { apiError, apiOk } from "@/lib/api/response";
import { auth } from "@/lib/auth/web/auth";
import { getDb } from "@/lib/db";
import { attendance, studentDailyAttendance } from "@/lib/db/schema";

export async function GET(request: Request) {
  const session = await auth();
  const guard = requirePermission(session, "attendance:read");
  if (guard) {
    return guard;
  }

  const { searchParams } = new URL(request.url);
  const classId = searchParams.get("classId");
  const date = searchParams.get("date");

  if (!classId || !date) {
    return apiError("classId dan date wajib diisi", 400);
  }

  const db = await getDb();
  let studentResults: Awaited<
    ReturnType<typeof getAttendanceRosterStudents>
  >["students"] = [];

  try {
    const roster = await getAttendanceRosterStudents(classId);
    studentResults = roster.students;
  } catch {
    return apiError("Kelas tidak ditemukan", 404);
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

  const manualAttendanceConditions = [
    eq(attendance.date, date),
    isNull(attendance.deletedAt),
  ];

  if (classId !== "all") {
    manualAttendanceConditions.push(eq(attendance.classId, classId));
  }

  const manualAttendanceRows = await db
    .select({
      studentId: attendance.studentId,
      status: attendance.status,
      notes: attendance.notes,
    })
    .from(attendance)
    .where(and(...manualAttendanceConditions));

  const logMap = new Map(dailyLogs.map((log) => [log.studentId, log]));
  const manualAttendanceMap = new Map(
    manualAttendanceRows.map((row) => [row.studentId, row]),
  );
  const data = studentResults.map((student) => {
    const log = logMap.get(student.id);
    const manualAttendance = manualAttendanceMap.get(student.id);

    let status: "present" | "sick" | "permission" | "alpha" = "present";
    if (!log && manualAttendance) {
      status = manualAttendance.status as typeof status;
    }

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
      status,
      notes: log ? "" : (manualAttendance?.notes ?? ""),
      checkInTime: log?.checkInTime ?? null,
      checkOutTime: log?.checkOutTime ?? null,
      isLocked: !!log,
    };
  });

  return apiOk(data);
}
