import { eq } from 'drizzle-orm';
import { getDb } from '../db';
import { users, type User } from '../db/schema';
import { hashPassword, verifyPassword } from './hash';

export type AuthResult =
  | { success: true; user: Omit<User, 'passwordHash'> }
  | { success: false; error: string };

/**
 * Authenticate user with email and password
 */
export async function login(email: string, password: string): Promise<AuthResult> {
  try {
    const db = await getDb();
    const result = await db.select().from(users).where(eq(users.email, email)).limit(1);

    if (result.length === 0) {
      return { success: false, error: 'Email tidak ditemukan' };
    }

    const user = result[0];

    // Check if password is set
    if (!user.passwordHash) {
      return { success: false, error: 'Password belum diatur. Hubungi admin.' };
    }

    const isValid = await verifyPassword(password, user.passwordHash);

    if (!isValid) {
      return { success: false, error: 'Password salah' };
    }

    // Return user without password hash
    const { passwordHash: _, ...safeUser } = user;
    return { success: true, user: safeUser };
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, error: 'Terjadi kesalahan sistem' };
  }
}

/**
 * Set password for a user (first-time setup or reset)
 */
export async function setPassword(userId: string, newPassword: string): Promise<boolean> {
  try {
    const db = await getDb();
    const hash = await hashPassword(newPassword);

    await db.update(users).set({ passwordHash: hash }).where(eq(users.id, userId));

    return true;
  } catch (error) {
    console.error('Set password error:', error);
    return false;
  }
}

/**
 * Check if a user has a password set
 */
export async function hasPassword(email: string): Promise<boolean> {
  try {
    const db = await getDb();
    const result = await db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.email, email)).limit(1);

    return result.length > 0 && !!result[0].passwordHash;
  } catch {
    return false;
  }
}
