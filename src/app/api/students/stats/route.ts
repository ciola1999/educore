import { and, count, eq, isNull, sql } from "drizzle-orm";
import { requireRole } from "@/lib/api/authz";
import { apiError, apiOk } from "@/lib/api/response";
import { auth } from "@/lib/auth/web/auth";
import { getDb } from "@/lib/db";
import { students } from "@/lib/db/schema";

type SessionUserLike = {
  id?: string;
  role?: string;
};

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return apiError("Unauthorized", 401);
  }

  const sessionUser = session.user as SessionUserLike;
  const role = sessionUser.role;
  const userId = sessionUser.id;
  const db = await getDb();

  if (role === "student" && userId) {
    const ownRecord = await db
      .select({
        grade: students.grade,
        gender: students.gender,
      })
      .from(students)
      .where(and(eq(students.id, userId), isNull(students.deletedAt)))
      .limit(1);

    const gender = ownRecord[0]?.gender;
    return apiOk({
      total: ownRecord.length,
      male: gender === "L" ? 1 : 0,
      female: gender === "P" ? 1 : 0,
      activeGrades: ownRecord[0]?.grade ? 1 : 0,
    });
  }

  const guard = requireRole(session, ["admin", "super_admin"]);
  if (guard) {
    return guard;
  }

  const base = isNull(students.deletedAt);
  const [totalRes, maleRes, femaleRes, gradeRes] = await Promise.all([
    db.select({ value: count() }).from(students).where(base),
    db
      .select({ value: count() })
      .from(students)
      .where(and(base, eq(students.gender, "L"))),
    db
      .select({ value: count() })
      .from(students)
      .where(and(base, eq(students.gender, "P"))),
    db
      .select({ value: sql<number>`count(distinct ${students.grade})` })
      .from(students)
      .where(base),
  ]);

  return apiOk({
    total: Number(totalRes[0]?.value || 0),
    male: Number(maleRes[0]?.value || 0),
    female: Number(femaleRes[0]?.value || 0),
    activeGrades: Number(gradeRes[0]?.value || 0),
  });
}
