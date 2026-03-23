import { and, eq, inArray, isNull } from "drizzle-orm";
import { requireRole } from "@/lib/api/authz";
import { apiError, apiOk } from "@/lib/api/response";
import { auth } from "@/lib/auth/web/auth";
import { getDb } from "@/lib/db";
import { attendance, studentDailyAttendance } from "@/lib/db/schema";

type SessionUserLike = {
  id?: string;
  role?: string;
};

type AttendanceTodayStatus =
  | "present"
  | "late"
  | "sick"
  | "permission"
  | "alpha";

type AttendanceTodaySnapshot = {
  studentId: string;
  status: AttendanceTodayStatus;
  source: "qr" | "manual";
  checkInTime: Date | null;
  checkOutTime: Date | null;
};

function normalizeDate(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
}

function mapQrStatus(status: string): AttendanceTodayStatus {
  switch (status) {
    case "LATE":
      return "late";
    case "EXCUSED":
      return "permission";
    case "ABSENT":
      return "alpha";
    default:
      return "present";
  }
}

function mapManualStatus(status: string): AttendanceTodayStatus {
  switch (status) {
    case "sick":
      return "sick";
    case "permission":
      return "permission";
    case "alpha":
      return "alpha";
    default:
      return "present";
  }
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return apiError("Unauthorized", 401);
  }

  const sessionUser = session.user as SessionUserLike;
  const role = sessionUser.role;
  const userId = sessionUser.id;

  const { searchParams } = new URL(request.url);
  const date = normalizeDate(searchParams.get("date"));
  if (!date) {
    return apiError("Parameter date wajib format YYYY-MM-DD", 400);
  }

  let studentIds: string[] = [];
  if (role === "student" && userId) {
    studentIds = [userId];
  } else {
    const guard = requireRole(session, ["admin", "super_admin"]);
    if (guard) {
      return guard;
    }

    const rawIds = searchParams.get("ids") || "";
    const parsedIds = rawIds
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);
    studentIds = [...new Set(parsedIds)].slice(0, 200);
  }

  if (studentIds.length === 0) {
    return apiOk([] as AttendanceTodaySnapshot[]);
  }

  const db = await getDb();

  const [qrRows, manualRows] = await Promise.all([
    db
      .select({
        studentId: studentDailyAttendance.studentId,
        status: studentDailyAttendance.status,
        checkInTime: studentDailyAttendance.checkInTime,
        checkOutTime: studentDailyAttendance.checkOutTime,
        updatedAt: studentDailyAttendance.updatedAt,
      })
      .from(studentDailyAttendance)
      .where(
        and(
          eq(studentDailyAttendance.date, date),
          inArray(studentDailyAttendance.studentId, studentIds),
          isNull(studentDailyAttendance.deletedAt),
        ),
      ),
    db
      .select({
        studentId: attendance.studentId,
        status: attendance.status,
        updatedAt: attendance.updatedAt,
      })
      .from(attendance)
      .where(
        and(
          eq(attendance.date, date),
          inArray(attendance.studentId, studentIds),
          isNull(attendance.deletedAt),
        ),
      ),
  ]);

  const qrByStudent = new Map<string, (typeof qrRows)[number]>();
  for (const row of qrRows) {
    const current = qrByStudent.get(row.studentId);
    if (!current || row.updatedAt > current.updatedAt) {
      qrByStudent.set(row.studentId, row);
    }
  }

  const manualByStudent = new Map<string, (typeof manualRows)[number]>();
  for (const row of manualRows) {
    const current = manualByStudent.get(row.studentId);
    if (!current || row.updatedAt > current.updatedAt) {
      manualByStudent.set(row.studentId, row);
    }
  }

  const snapshots: AttendanceTodaySnapshot[] = [];
  for (const studentId of studentIds) {
    const qrRow = qrByStudent.get(studentId);
    if (qrRow) {
      snapshots.push({
        studentId,
        status: mapQrStatus(qrRow.status),
        source: "qr",
        checkInTime: qrRow.checkInTime,
        checkOutTime: qrRow.checkOutTime,
      });
      continue;
    }

    const manualRow = manualByStudent.get(studentId);
    if (manualRow) {
      snapshots.push({
        studentId,
        status: mapManualStatus(manualRow.status),
        source: "manual",
        checkInTime: null,
        checkOutTime: null,
      });
    }
  }

  return apiOk(snapshots);
}
