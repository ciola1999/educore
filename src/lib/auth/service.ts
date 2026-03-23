// Project\educore\src\lib\auth\service.ts

import { and, eq, isNull } from "drizzle-orm";
import { isTauri } from "@/core/env";
import { getDb } from "../db";
import { type User, users } from "../db/schema";
import { hashPassword, verifyPassword } from "./hash";

export type AuthResult =
  | { success: true; user: Omit<User, "passwordHash"> }
  | { success: false; error: string };

/**
 * Verify password based on runtime environment
 * - Tauri (desktop): Uses argon2 via Tauri command
 * - Web: Uses server-side compatible verification
 */
async function verifyPasswordEnvironment(
  password: string,
  storedHash: string,
): Promise<boolean> {
  if (!storedHash) {
    return false;
  }

  if (!storedHash.startsWith("$argon2")) {
    return password === storedHash;
  }

  return verifyPassword(password, storedHash);
}

/**
 * Authenticate user with email and password
 * Works in both Tauri (desktop) and Web environments
 */
export async function login(
  email: string,
  password: string,
): Promise<AuthResult> {
  try {
    const db = await getDb();
    const result = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.email, email),
          eq(users.isActive, true),
          isNull(users.deletedAt),
        ),
      )
      .limit(1);

    if (result.length === 0) {
      return { success: false, error: "Email tidak ditemukan" };
    }

    const user = result[0];
    // biome-ignore lint/suspicious/noExplicitAny: Raw SQL results may contain snake_case keys
    const rawUser = user as any;

    const passwordHash = user.passwordHash || rawUser.password_hash;

    // Check if password is set
    if (!passwordHash) {
      return { success: false, error: "Password belum diatur. Hubungi admin." };
    }

    const isValid = await verifyPasswordEnvironment(password, passwordHash);

    if (!isValid) {
      return { success: false, error: "Password salah" };
    }

    // Return user without password hash
    const { passwordHash: _, ...safeUser } = user;
    return { success: true, user: safeUser };
  } catch (error) {
    console.error("Login error:", error);
    return { success: false, error: "Terjadi kesalahan sistem" };
  }
}

/**
 * Hash password based on runtime environment
 * - Tauri (desktop): Uses argon2 via Tauri command
 * - Web: Returns plain password (for demo) or would use server-side API
 */
async function hashPasswordEnvironment(password: string): Promise<string> {
  if (isTauri()) {
    return hashPassword(password);
  }

  return hashPassword(password);
}

/**
 * Set password for a user (first-time setup or reset)
 * Works in both Tauri (desktop) and Web environments
 */
export async function setPassword(
  userId: string,
  newPassword: string,
): Promise<boolean> {
  try {
    const db = await getDb();
    const hash = await hashPasswordEnvironment(newPassword);

    await db
      .update(users)
      .set({ passwordHash: hash })
      .where(eq(users.id, userId));

    return true;
  } catch (error) {
    console.error("Set password error:", error);
    return false;
  }
}

/**
 * Check if a user has a password set
 */
export async function hasPassword(email: string): Promise<boolean> {
  try {
    const db = await getDb();
    const result = await db
      .select({ passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    return result.length > 0 && !!result[0].passwordHash;
  } catch {
    return false;
  }
}
