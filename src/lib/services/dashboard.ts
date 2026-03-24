import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { getDb } from "../db";
import {
  attendance,
  studentDailyAttendance,
  students,
  users,
} from "../db/schema";

export type DashboardStats = {
  totalStudents: number;
  totalTeachers: number;
  attendanceToday: {
    present: number;
    sick: number;
    permission: number;
    alpha: number;
    late: number;
    totalRecorded: number;
  };
};

const emptyStats: DashboardStats = {
  totalStudents: 0,
  totalTeachers: 0,
  attendanceToday: {
    present: 0,
    sick: 0,
    permission: 0,
    alpha: 0,
    late: 0,
    totalRecorded: 0,
  },
};

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function normalizeCount(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "bigint") {
    return Number(value);
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const db = await getDb();
  const today = toIsoDate(new Date());

  try {
    const [
      projectionStudents,
      accountStudents,
      teachers,
      manualAttendanceRows,
      qrAttendanceRows,
    ] = await Promise.all([
      db
        .select({ count: sql<number>`count(*)` })
        .from(students)
        .where(isNull(students.deletedAt)),
      db
        .select({ count: sql<number>`count(*)` })
        .from(users)
        .where(
          and(
            eq(users.role, "student"),
            eq(users.isActive, true),
            isNull(users.deletedAt),
          ),
        ),
      db
        .select({ count: sql<number>`count(*)` })
        .from(users)
        .where(
          and(
            inArray(users.role, ["teacher", "staff"]),
            eq(users.isActive, true),
            isNull(users.deletedAt),
          ),
        ),
      db
        .select({
          status: attendance.status,
          count: sql<number>`count(*)`,
        })
        .from(attendance)
        .where(and(eq(attendance.date, today), isNull(attendance.deletedAt)))
        .groupBy(attendance.status),
      db
        .select({
          status: studentDailyAttendance.status,
          count: sql<number>`count(*)`,
        })
        .from(studentDailyAttendance)
        .where(
          and(
            eq(studentDailyAttendance.date, today),
            isNull(studentDailyAttendance.deletedAt),
          ),
        )
        .groupBy(studentDailyAttendance.status),
    ]);

    const attendanceToday = { ...emptyStats.attendanceToday };

    for (const row of manualAttendanceRows) {
      const count = normalizeCount(row.count);
      switch ((row.status || "").toLowerCase()) {
        case "present":
          attendanceToday.present += count;
          break;
        case "late":
          attendanceToday.late += count;
          break;
        case "sick":
          attendanceToday.sick += count;
          break;
        case "permission":
          attendanceToday.permission += count;
          break;
        case "alpha":
          attendanceToday.alpha += count;
          break;
        default:
          break;
      }
    }

    for (const row of qrAttendanceRows) {
      const count = normalizeCount(row.count);
      switch (row.status) {
        case "PRESENT":
          attendanceToday.present += count;
          break;
        case "LATE":
          attendanceToday.late += count;
          break;
        case "EXCUSED":
          attendanceToday.permission += count;
          break;
        case "ABSENT":
          attendanceToday.alpha += count;
          break;
        default:
          break;
      }
    }

    attendanceToday.totalRecorded =
      attendanceToday.present +
      attendanceToday.late +
      attendanceToday.sick +
      attendanceToday.permission +
      attendanceToday.alpha;

    return {
      totalStudents: Math.max(
        normalizeCount(projectionStudents[0]?.count),
        normalizeCount(accountStudents[0]?.count),
      ),
      totalTeachers: normalizeCount(teachers[0]?.count),
      attendanceToday,
    };
  } catch {
    return emptyStats;
  }
}
