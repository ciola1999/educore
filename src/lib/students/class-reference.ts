import { and, inArray, isNull } from "drizzle-orm";
import type { getDb } from "@/lib/db";
import { classes } from "@/lib/db/schema";
import {
  buildClassNameLookupKeys,
  canonicalizeClassDisplayName,
  sanitizeClassDisplayName,
} from "@/lib/utils/class-name";

type DbClient = Awaited<ReturnType<typeof getDb>>;

export function normalizeStudentGradeInput(
  grade: string | null | undefined,
): string {
  return canonicalizeClassDisplayName(sanitizeClassDisplayName(grade));
}

export function buildMissingClassReferenceMessage(grades: string[]): string {
  const uniqueGrades = Array.from(
    new Set(grades.map((grade) => normalizeStudentGradeInput(grade))),
  ).filter((grade) => grade !== "UNASSIGNED");

  if (uniqueGrades.length === 0) {
    return "Kelas siswa belum tersedia di master kelas. Tambahkan dulu di halaman Kelas.";
  }

  return `Kelas berikut belum tersedia di master kelas: ${uniqueGrades.join(", ")}. Tambahkan dulu di halaman Kelas.`;
}

export async function resolveExistingClassReference(
  db: DbClient,
  grade: string | null | undefined,
): Promise<{ normalizedGrade: string; kelasId: string | null }> {
  const normalizedGrade = normalizeStudentGradeInput(grade);
  if (normalizedGrade === "UNASSIGNED") {
    return {
      normalizedGrade,
      kelasId: null,
    };
  }

  const lookupKeys = buildClassNameLookupKeys(normalizedGrade);
  const existingClass = await db
    .select({ id: classes.id })
    .from(classes)
    .where(and(inArray(classes.name, lookupKeys), isNull(classes.deletedAt)))
    .limit(1);

  return {
    normalizedGrade,
    kelasId: existingClass[0]?.id ?? null,
  };
}

export async function resolveExistingClassIdsByGrade(
  db: DbClient,
  grades: string[],
): Promise<{
  classIdByGrade: Map<string, string>;
  missingGrades: string[];
}> {
  const normalizedGrades = Array.from(
    new Set(grades.map((grade) => normalizeStudentGradeInput(grade))),
  ).filter((grade) => grade !== "UNASSIGNED");

  if (normalizedGrades.length === 0) {
    return {
      classIdByGrade: new Map(),
      missingGrades: [],
    };
  }

  const lookupKeys = Array.from(
    new Set(
      normalizedGrades.flatMap((grade) => buildClassNameLookupKeys(grade)),
    ),
  );
  const classRows = await db
    .select({ id: classes.id, name: classes.name })
    .from(classes)
    .where(and(inArray(classes.name, lookupKeys), isNull(classes.deletedAt)));

  const classIdByGrade = new Map<string, string>();

  for (const grade of normalizedGrades) {
    const allowedNames = new Set(buildClassNameLookupKeys(grade));
    const matchingRow = classRows.find((row) => allowedNames.has(row.name));
    if (matchingRow?.id) {
      classIdByGrade.set(grade, matchingRow.id);
    }
  }

  return {
    classIdByGrade,
    missingGrades: normalizedGrades.filter(
      (grade) => !classIdByGrade.has(grade),
    ),
  };
}
