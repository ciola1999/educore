import { and, eq, isNull } from "drizzle-orm";
import { requireRole } from "@/lib/api/authz";
import { apiOk } from "@/lib/api/response";
import { auth } from "@/lib/auth/web/auth";
import { getDb } from "@/lib/db";
import { students, users } from "@/lib/db/schema";
import { isUuidLikeClassValue } from "@/lib/utils/class-name";

type LegacyGroup = {
  sourceToken: string;
  count: number;
  samples: Array<{
    id: string;
    nis: string;
    fullName: string;
  }>;
};

export async function GET() {
  const session = await auth();
  const guard = requireRole(session, ["admin", "super_admin"]);
  if (guard) {
    return guard;
  }

  const db = await getDb();
  const rows = await db
    .select({
      id: students.id,
      nis: students.nis,
      fullName: students.fullName,
      grade: students.grade,
      kelasId: users.kelasId,
    })
    .from(students)
    .leftJoin(users, and(isNull(users.deletedAt), eq(students.id, users.id)))
    .where(isNull(students.deletedAt));

  const groups = new Map<string, LegacyGroup>();

  for (const row of rows) {
    const sourceToken = isUuidLikeClassValue(row.kelasId)
      ? row.kelasId?.trim() || null
      : isUuidLikeClassValue(row.grade)
        ? row.grade.trim()
        : row.grade === "UNASSIGNED"
          ? "UNASSIGNED"
          : null;

    if (!sourceToken) {
      continue;
    }

    const current = groups.get(sourceToken) ?? {
      sourceToken,
      count: 0,
      samples: [],
    };
    current.count += 1;
    if (current.samples.length < 5) {
      current.samples.push({
        id: row.id,
        nis: row.nis,
        fullName: row.fullName,
      });
    }
    groups.set(sourceToken, current);
  }

  return apiOk(Array.from(groups.values()).sort((a, b) => b.count - a.count));
}
