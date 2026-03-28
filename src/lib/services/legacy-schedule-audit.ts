import { and, desc, eq, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  classes,
  guruMapel,
  jadwal,
  schedule,
  semester,
  subjects,
  tahunAjaran,
  users,
} from "@/lib/db/schema";
import { isLegacyScheduleTableMissingError } from "./legacy-schedule-runtime";

export type LegacyScheduleAuditStatus =
  | "already_canonical"
  | "ready_to_backfill"
  | "ambiguous_assignment"
  | "missing_assignment";

export type LegacyScheduleAuditItem = {
  legacyScheduleId: string;
  classId: string;
  className: string | null;
  subjectId: string;
  subjectName: string | null;
  teacherId: string;
  teacherName: string | null;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  room: string | null;
  status: LegacyScheduleAuditStatus;
  matchingAssignments: Array<{
    id: string;
    guruName: string | null;
    mataPelajaranName: string | null;
    kelasName: string | null;
    semesterName: string | null;
    tahunAjaranNama: string | null;
  }>;
};

export type LegacyScheduleAuditReport = {
  legacyTableAvailable: boolean;
  totalLegacyRows: number;
  filteredRows: number;
  summary: Record<LegacyScheduleAuditStatus, number>;
  items: LegacyScheduleAuditItem[];
};

export async function getLegacyScheduleAuditReport(options?: {
  status?: LegacyScheduleAuditStatus;
  limit?: number;
}): Promise<LegacyScheduleAuditReport> {
  const db = await getDb();
  const limit = Math.min(Math.max(options?.limit ?? 100, 1), 500);
  const emptySummary: LegacyScheduleAuditReport["summary"] = {
    already_canonical: 0,
    ready_to_backfill: 0,
    ambiguous_assignment: 0,
    missing_assignment: 0,
  };

  let legacyRows: Array<{
    id: string;
    classId: string;
    className: string | null;
    subjectId: string;
    subjectName: string | null;
    teacherId: string;
    teacherName: string | null;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    room: string | null;
  }> = [];

  try {
    legacyRows = await db
      .select({
        id: schedule.id,
        classId: schedule.classId,
        className: classes.name,
        subjectId: schedule.subjectId,
        subjectName: subjects.name,
        teacherId: schedule.teacherId,
        teacherName: users.fullName,
        dayOfWeek: schedule.dayOfWeek,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        room: schedule.room,
      })
      .from(schedule)
      .leftJoin(classes, eq(schedule.classId, classes.id))
      .leftJoin(subjects, eq(schedule.subjectId, subjects.id))
      .leftJoin(users, eq(schedule.teacherId, users.id))
      .where(isNull(schedule.deletedAt))
      .orderBy(desc(schedule.updatedAt));
  } catch (error) {
    if (isLegacyScheduleTableMissingError(error)) {
      return {
        legacyTableAvailable: false,
        totalLegacyRows: 0,
        filteredRows: 0,
        summary: emptySummary,
        items: [],
      };
    }
    throw error;
  }

  const items: LegacyScheduleAuditItem[] = [];
  const summary: LegacyScheduleAuditReport["summary"] = { ...emptySummary };

  for (const legacy of legacyRows) {
    const canonicalRows = await db
      .select({ id: jadwal.id })
      .from(jadwal)
      .innerJoin(guruMapel, eq(jadwal.guruMapelId, guruMapel.id))
      .where(
        and(
          isNull(jadwal.deletedAt),
          isNull(guruMapel.deletedAt),
          eq(guruMapel.kelasId, legacy.classId),
          eq(guruMapel.mataPelajaranId, legacy.subjectId),
          eq(guruMapel.guruId, legacy.teacherId),
          eq(jadwal.hari, legacy.dayOfWeek),
          eq(jadwal.jamMulai, legacy.startTime),
          eq(jadwal.jamSelesai, legacy.endTime),
        ),
      )
      .limit(1);

    const assignmentRows = await db
      .select({
        id: guruMapel.id,
        guruName: users.fullName,
        mataPelajaranName: subjects.name,
        kelasName: classes.name,
        semesterName: semester.nama,
        tahunAjaranNama: tahunAjaran.nama,
      })
      .from(guruMapel)
      .innerJoin(users, eq(guruMapel.guruId, users.id))
      .innerJoin(subjects, eq(guruMapel.mataPelajaranId, subjects.id))
      .innerJoin(classes, eq(guruMapel.kelasId, classes.id))
      .innerJoin(semester, eq(guruMapel.semesterId, semester.id))
      .innerJoin(tahunAjaran, eq(semester.tahunAjaranId, tahunAjaran.id))
      .where(
        and(
          isNull(guruMapel.deletedAt),
          isNull(semester.deletedAt),
          isNull(tahunAjaran.deletedAt),
          eq(guruMapel.kelasId, legacy.classId),
          eq(guruMapel.mataPelajaranId, legacy.subjectId),
          eq(guruMapel.guruId, legacy.teacherId),
        ),
      )
      .orderBy(
        desc(semester.isActive),
        desc(tahunAjaran.isActive),
        desc(guruMapel.updatedAt),
        desc(guruMapel.createdAt),
      );

    const status: LegacyScheduleAuditStatus =
      canonicalRows.length > 0
        ? "already_canonical"
        : assignmentRows.length === 0
          ? "missing_assignment"
          : assignmentRows.length === 1
            ? "ready_to_backfill"
            : "ambiguous_assignment";

    summary[status] += 1;

    if (options?.status && options.status !== status) {
      continue;
    }

    items.push({
      legacyScheduleId: legacy.id,
      classId: legacy.classId,
      className: legacy.className ?? null,
      subjectId: legacy.subjectId,
      subjectName: legacy.subjectName ?? null,
      teacherId: legacy.teacherId,
      teacherName: legacy.teacherName ?? null,
      dayOfWeek: legacy.dayOfWeek,
      startTime: legacy.startTime,
      endTime: legacy.endTime,
      room: legacy.room ?? null,
      status,
      matchingAssignments: assignmentRows.map((row) => ({
        id: row.id,
        guruName: row.guruName ?? null,
        mataPelajaranName: row.mataPelajaranName ?? null,
        kelasName: row.kelasName ?? null,
        semesterName: row.semesterName ?? null,
        tahunAjaranNama: row.tahunAjaranNama ?? null,
      })),
    });

    if (items.length >= limit) {
      break;
    }
  }

  return {
    legacyTableAvailable: true,
    totalLegacyRows: legacyRows.length,
    filteredRows: items.length,
    summary,
    items,
  };
}
