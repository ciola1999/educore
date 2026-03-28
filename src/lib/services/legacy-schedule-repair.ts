import { and, desc, eq, isNull } from "drizzle-orm";
import { getDb } from "@/lib/db";
import {
  guruMapel,
  jadwal,
  schedule,
  semester,
  tahunAjaran,
} from "@/lib/db/schema";
import { isLegacyScheduleTableMissingError } from "./legacy-schedule-runtime";

export type LegacyScheduleRepairResult =
  | {
      success: true;
      legacyScheduleId: string;
      canonicalJadwalId: string;
      guruMapelId: string;
      action: "created" | "reused";
    }
  | {
      success: false;
      error: string;
      code:
        | "NOT_FOUND"
        | "AMBIGUOUS_ASSIGNMENT"
        | "MISSING_ASSIGNMENT"
        | "INVALID_ASSIGNMENT_SELECTION"
        | "LEGACY_TABLE_RETIRED";
    };

export type BulkLegacyScheduleRepairResult = {
  processed: number;
  created: number;
  reused: number;
  skipped: number;
  failures: Array<{
    legacyScheduleId: string;
    code: string;
    error: string;
  }>;
};

export type BulkArchiveCanonicalLegacyScheduleResult = {
  processed: number;
  archived: number;
  skipped: number;
  failures: Array<{
    legacyScheduleId: string;
    code: string;
    error: string;
  }>;
};

export async function repairLegacySchedule(params: {
  legacyScheduleId: string;
  guruMapelId?: string;
}): Promise<LegacyScheduleRepairResult> {
  const db = await getDb();
  let legacyRows: Array<{
    id: string;
    classId: string;
    subjectId: string;
    teacherId: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    room: string | null;
    version: number | null;
    hlc: string | null;
  }> = [];

  try {
    legacyRows = await db
      .select({
        id: schedule.id,
        classId: schedule.classId,
        subjectId: schedule.subjectId,
        teacherId: schedule.teacherId,
        dayOfWeek: schedule.dayOfWeek,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        room: schedule.room,
        version: schedule.version,
        hlc: schedule.hlc,
      })
      .from(schedule)
      .where(
        and(
          eq(schedule.id, params.legacyScheduleId),
          isNull(schedule.deletedAt),
        ),
      )
      .limit(1);
  } catch (error) {
    if (isLegacyScheduleTableMissingError(error)) {
      return {
        success: false,
        error: "Tabel schedule legacy sudah retired.",
        code: "LEGACY_TABLE_RETIRED",
      };
    }
    throw error;
  }

  const legacy = legacyRows[0];
  if (!legacy) {
    return {
      success: false,
      error: "Data schedule legacy tidak ditemukan.",
      code: "NOT_FOUND",
    };
  }

  const candidateAssignments = await db
    .select({ id: guruMapel.id })
    .from(guruMapel)
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

  if (candidateAssignments.length === 0) {
    return {
      success: false,
      error:
        "Schedule legacy belum punya assignment guru-mapel yang cocok. Buat atau perbaiki assignment terlebih dahulu.",
      code: "MISSING_ASSIGNMENT",
    };
  }

  const selectedGuruMapelId = params.guruMapelId?.trim();
  const candidateIds = candidateAssignments.map((item) => item.id);

  if (selectedGuruMapelId && !candidateIds.includes(selectedGuruMapelId)) {
    return {
      success: false,
      error:
        "Assignment guru-mapel yang dipilih tidak cocok untuk schedule legacy ini.",
      code: "INVALID_ASSIGNMENT_SELECTION",
    };
  }

  if (!selectedGuruMapelId && candidateIds.length > 1) {
    return {
      success: false,
      error:
        "Schedule legacy memiliki lebih dari satu assignment guru-mapel yang cocok. Pilih assignment secara eksplisit.",
      code: "AMBIGUOUS_ASSIGNMENT",
    };
  }

  const chosenGuruMapelId = selectedGuruMapelId ?? candidateIds[0];
  const now = new Date();

  return db.transaction(async (tx) => {
    const existingCanonicalRows = await tx
      .select({ id: jadwal.id, room: jadwal.ruangan })
      .from(jadwal)
      .where(
        and(
          eq(jadwal.guruMapelId, chosenGuruMapelId),
          eq(jadwal.hari, legacy.dayOfWeek),
          eq(jadwal.jamMulai, legacy.startTime),
          eq(jadwal.jamSelesai, legacy.endTime),
          isNull(jadwal.deletedAt),
        ),
      )
      .limit(1);

    const existingCanonical = existingCanonicalRows[0];
    const canonicalJadwalId = existingCanonical?.id ?? crypto.randomUUID();
    const action: "created" | "reused" = existingCanonical
      ? "reused"
      : "created";

    if (existingCanonical) {
      if (!existingCanonical.room && legacy.room) {
        await tx
          .update(jadwal)
          .set({
            ruangan: legacy.room,
            updatedAt: now,
            syncStatus: "pending",
          })
          .where(eq(jadwal.id, existingCanonical.id));
      }
    } else {
      await tx.insert(jadwal).values({
        id: canonicalJadwalId,
        guruMapelId: chosenGuruMapelId,
        hari: legacy.dayOfWeek,
        jamMulai: legacy.startTime,
        jamSelesai: legacy.endTime,
        ruangan: legacy.room,
        version: legacy.version ?? 1,
        hlc: legacy.hlc,
        createdAt: now,
        updatedAt: now,
        syncStatus: "pending",
      });
    }

    await tx
      .update(schedule)
      .set({
        deletedAt: now,
        updatedAt: now,
        syncStatus: "pending",
      })
      .where(eq(schedule.id, legacy.id));

    return {
      success: true,
      legacyScheduleId: legacy.id,
      canonicalJadwalId,
      guruMapelId: chosenGuruMapelId,
      action,
    } as const;
  });
}

export async function bulkRepairReadyLegacySchedules(options?: {
  limit?: number;
}): Promise<BulkLegacyScheduleRepairResult> {
  const db = await getDb();
  const limit = Math.min(Math.max(options?.limit ?? 50, 1), 200);

  const result: BulkLegacyScheduleRepairResult = {
    processed: 0,
    created: 0,
    reused: 0,
    skipped: 0,
    failures: [],
  };

  let legacyRows: Array<{
    id: string;
    classId: string;
    subjectId: string;
    teacherId: string;
  }> = [];

  try {
    legacyRows = await db
      .select({
        id: schedule.id,
        classId: schedule.classId,
        subjectId: schedule.subjectId,
        teacherId: schedule.teacherId,
      })
      .from(schedule)
      .where(isNull(schedule.deletedAt))
      .orderBy(desc(schedule.updatedAt))
      .limit(limit);
  } catch (error) {
    if (isLegacyScheduleTableMissingError(error)) {
      return result;
    }
    throw error;
  }

  for (const legacy of legacyRows) {
    const candidateAssignments = await db
      .select({ id: guruMapel.id })
      .from(guruMapel)
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
      .limit(2);

    if (candidateAssignments.length !== 1) {
      result.skipped++;
      continue;
    }

    const repaired = await repairLegacySchedule({
      legacyScheduleId: legacy.id,
      guruMapelId: candidateAssignments[0]?.id,
    });

    if (!repaired.success) {
      result.failures.push({
        legacyScheduleId: legacy.id,
        code: repaired.code,
        error: repaired.error,
      });
      continue;
    }

    result.processed++;
    if (repaired.action === "created") {
      result.created++;
    } else {
      result.reused++;
    }
  }

  return result;
}

export async function bulkArchiveAlreadyCanonicalLegacySchedules(options?: {
  limit?: number;
}): Promise<BulkArchiveCanonicalLegacyScheduleResult> {
  const db = await getDb();
  const limit = Math.min(Math.max(options?.limit ?? 50, 1), 200);

  const result: BulkArchiveCanonicalLegacyScheduleResult = {
    processed: 0,
    archived: 0,
    skipped: 0,
    failures: [],
  };

  let legacyRows: Array<{
    id: string;
    classId: string;
    subjectId: string;
    teacherId: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
  }> = [];

  try {
    legacyRows = await db
      .select({
        id: schedule.id,
        classId: schedule.classId,
        subjectId: schedule.subjectId,
        teacherId: schedule.teacherId,
        dayOfWeek: schedule.dayOfWeek,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
      })
      .from(schedule)
      .where(isNull(schedule.deletedAt))
      .orderBy(desc(schedule.updatedAt))
      .limit(limit);
  } catch (error) {
    if (isLegacyScheduleTableMissingError(error)) {
      return result;
    }
    throw error;
  }

  for (const legacy of legacyRows) {
    try {
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

      if (canonicalRows.length === 0) {
        result.skipped++;
        continue;
      }

      await db
        .update(schedule)
        .set({
          deletedAt: new Date(),
          updatedAt: new Date(),
          syncStatus: "pending",
        })
        .where(eq(schedule.id, legacy.id));

      result.processed++;
      result.archived++;
    } catch (error) {
      result.failures.push({
        legacyScheduleId: legacy.id,
        code: "ARCHIVE_FAILED",
        error:
          error instanceof Error
            ? error.message
            : "Gagal mengarsipkan schedule legacy canonical",
      });
    }
  }

  return result;
}
