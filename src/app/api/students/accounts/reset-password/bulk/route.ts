import { and, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { requireRole } from "@/lib/api/authz";
import { apiError, apiOk } from "@/lib/api/response";
import { hashPassword } from "@/lib/auth/hash";
import { auth } from "@/lib/auth/web/auth";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";

const bulkResetStudentPasswordSchema = z.object({
  studentIds: z.array(z.string().uuid()).min(1, "Pilih minimal 1 akun siswa"),
  password: z.string().min(8, "Password default minimal 8 karakter"),
});

export async function POST(request: Request) {
  const session = await auth();
  const guard = requireRole(session, ["admin", "super_admin"]);
  if (guard) {
    return guard;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Payload tidak valid", 400, "INVALID_PAYLOAD");
  }

  const validation = bulkResetStudentPasswordSchema.safeParse(body);
  if (!validation.success) {
    return apiError(
      validation.error.issues[0]?.message || "Data reset password tidak valid",
      400,
      "VALIDATION_ERROR",
    );
  }

  const { password } = validation.data;
  const studentIds = Array.from(new Set(validation.data.studentIds));
  const db = await getDb();
  const studentAccounts = await db
    .select({ id: users.id })
    .from(users)
    .where(
      and(
        inArray(users.id, studentIds),
        eq(users.role, "student"),
        eq(users.isActive, true),
        isNull(users.deletedAt),
      ),
    );

  if (studentAccounts.length === 0) {
    return apiError(
      "Akun siswa aktif tidak ditemukan",
      404,
      "ACCOUNT_NOT_FOUND",
    );
  }

  const passwordHash = await hashPassword(password);
  const updatedAt = new Date();
  const skipped = studentIds.length - studentAccounts.length;

  await db
    .update(users)
    .set({
      passwordHash,
      syncStatus: "pending",
      updatedAt,
    })
    .where(
      and(
        inArray(
          users.id,
          studentAccounts.map((account) => account.id),
        ),
        eq(users.role, "student"),
        eq(users.isActive, true),
        isNull(users.deletedAt),
      ),
    );

  return apiOk({
    updated: studentAccounts.length,
    skipped,
    message: `Berhasil reset password ${studentAccounts.length} akun siswa, ${skipped} data dilewati.`,
  });
}
