import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { apiError, apiOk } from "@/lib/api/response";
import { hashPassword, verifyPassword } from "@/lib/auth/hash";
import { auth } from "@/lib/auth/web/auth";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";

const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Password saat ini wajib diisi"),
    newPassword: z.string().min(8, "Password baru minimal 8 karakter"),
    confirmPassword: z
      .string()
      .min(8, "Konfirmasi password minimal 8 karakter"),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    message: "Konfirmasi password tidak cocok",
    path: ["confirmPassword"],
  })
  .refine((value) => value.currentPassword !== value.newPassword, {
    message: "Password baru tidak boleh sama dengan password saat ini",
    path: ["newPassword"],
  });

function isArgon2Hash(value: string): boolean {
  return value.startsWith("$argon2");
}

async function validateCurrentPassword(
  inputPassword: string,
  storedHash: string,
): Promise<boolean> {
  if (!storedHash) {
    return false;
  }

  if (isArgon2Hash(storedHash)) {
    return verifyPassword(inputPassword, storedHash);
  }

  return inputPassword === storedHash;
}

type SessionUserLike = {
  id?: string;
};

export async function POST(request: Request) {
  const session = await auth();
  const user = session?.user as SessionUserLike | undefined;
  const userId = user?.id;

  if (!userId) {
    return apiError("Unauthorized", 401, "UNAUTHORIZED");
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Payload tidak valid", 400, "INVALID_PAYLOAD");
  }

  const validation = changePasswordSchema.safeParse(body);
  if (!validation.success) {
    return apiError(
      validation.error.issues[0]?.message || "Input tidak valid",
      400,
      "VALIDATION_ERROR",
    );
  }

  const db = await getDb();
  const userRows = await db
    .select({
      id: users.id,
      passwordHash: users.passwordHash,
    })
    .from(users)
    .where(
      and(
        eq(users.id, userId),
        eq(users.isActive, true),
        isNull(users.deletedAt),
      ),
    )
    .limit(1);

  if (userRows.length === 0) {
    return apiError("Akun tidak ditemukan", 404, "USER_NOT_FOUND");
  }

  const storedHash = userRows[0]?.passwordHash || "";
  const isCurrentValid = await validateCurrentPassword(
    validation.data.currentPassword,
    storedHash,
  );

  if (!isCurrentValid) {
    return apiError("Password saat ini salah", 400, "INVALID_CURRENT_PASSWORD");
  }

  const nextHash = await hashPassword(validation.data.newPassword);
  await db
    .update(users)
    .set({
      passwordHash: nextHash,
      syncStatus: "pending",
      updatedAt: new Date(),
      version: sql`${users.version} + 1`,
    })
    .where(eq(users.id, userId));

  return apiOk({ changed: true });
}
