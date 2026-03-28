import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { guruMapel, jadwal, schedule } from "@/lib/db/schema";
import { isLegacyScheduleTableMissingError } from "./legacy-schedule-runtime";

type UsageRow = { id: string };

export type ScheduleUsageSummary = {
  canonicalJadwal: UsageRow[];
  legacySchedule: UsageRow[];
};

export async function findClassScheduleUsage(
  classId: string,
): Promise<ScheduleUsageSummary> {
  const db = await getDb();
  const canonicalJadwal = await db
    .select({ id: jadwal.id })
    .from(jadwal)
    .innerJoin(guruMapel, eq(jadwal.guruMapelId, guruMapel.id))
    .where(and(eq(guruMapel.kelasId, classId), isNull(jadwal.deletedAt)))
    .limit(1);

  let legacySchedule: UsageRow[] = [];
  try {
    legacySchedule = await db
      .select({ id: schedule.id })
      .from(schedule)
      .where(and(eq(schedule.classId, classId), isNull(schedule.deletedAt)))
      .limit(1);
  } catch (error) {
    if (!isLegacyScheduleTableMissingError(error)) {
      throw error;
    }
  }

  return { canonicalJadwal, legacySchedule };
}

export async function findSubjectScheduleUsage(
  subjectId: string,
): Promise<ScheduleUsageSummary> {
  const db = await getDb();
  const canonicalJadwal = await db
    .select({ id: jadwal.id })
    .from(jadwal)
    .innerJoin(guruMapel, eq(jadwal.guruMapelId, guruMapel.id))
    .where(
      and(eq(guruMapel.mataPelajaranId, subjectId), isNull(jadwal.deletedAt)),
    )
    .limit(1);

  let legacySchedule: UsageRow[] = [];
  try {
    legacySchedule = await db
      .select({ id: schedule.id })
      .from(schedule)
      .where(and(eq(schedule.subjectId, subjectId), isNull(schedule.deletedAt)))
      .limit(1);
  } catch (error) {
    if (!isLegacyScheduleTableMissingError(error)) {
      throw error;
    }
  }

  return { canonicalJadwal, legacySchedule };
}

export async function findTeacherScheduleUsage(
  teacherId: string,
): Promise<ScheduleUsageSummary> {
  const db = await getDb();
  const canonicalJadwal = await db
    .select({ id: jadwal.id })
    .from(jadwal)
    .innerJoin(guruMapel, eq(jadwal.guruMapelId, guruMapel.id))
    .where(and(eq(guruMapel.guruId, teacherId), isNull(jadwal.deletedAt)))
    .limit(1);

  let legacySchedule: UsageRow[] = [];
  try {
    legacySchedule = await db
      .select({ id: schedule.id })
      .from(schedule)
      .where(and(eq(schedule.teacherId, teacherId), isNull(schedule.deletedAt)))
      .limit(1);
  } catch (error) {
    if (!isLegacyScheduleTableMissingError(error)) {
      throw error;
    }
  }

  return { canonicalJadwal, legacySchedule };
}

export function hasAnyScheduleUsage(summary: ScheduleUsageSummary) {
  return (
    summary.canonicalJadwal.length > 0 || summary.legacySchedule.length > 0
  );
}
