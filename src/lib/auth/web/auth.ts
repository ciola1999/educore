import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import type { AuthRole } from "@/core/auth/roles";
import { hashPassword, verifyPassword } from "@/lib/auth/hash";
import { createAuthDbClient } from "@/lib/auth/web/db";
import {
  buildLoginEmailCandidates,
  normalizeLoginIdentifier,
} from "@/lib/auth/web/login-identifier";
import {
  consumeRateLimit,
  extractClientIp,
  getUserSessionState,
  resetRateLimit,
} from "@/lib/auth/web/security";

const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 5 * 60 * 1000; // 5 minutes

function isLocalOrigin(url: string): boolean {
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname === "localhost" ||
      parsed.hostname === "127.0.0.1" ||
      parsed.hostname === "::1"
    );
  } catch {
    return false;
  }
}

function sanitizeAuthUrlForDevelopment() {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  const authUrl = process.env.AUTH_URL;
  const nextAuthUrl = process.env.NEXTAUTH_URL;
  const hasNonLocalAuthUrl = authUrl && !isLocalOrigin(authUrl);
  const hasNonLocalNextAuthUrl = nextAuthUrl && !isLocalOrigin(nextAuthUrl);

  if (hasNonLocalAuthUrl || hasNonLocalNextAuthUrl) {
    console.warn(
      "[AUTH] Non-local AUTH_URL/NEXTAUTH_URL detected in development. Falling back to request host for local sign-in routes.",
    );
    delete process.env.AUTH_URL;
    delete process.env.NEXTAUTH_URL;
  }
}

sanitizeAuthUrlForDevelopment();

const trustHost =
  process.env.AUTH_TRUST_HOST === "true" ||
  process.env.NODE_ENV !== "production";
const authSecret =
  process.env.AUTH_SECRET ||
  process.env.NEXTAUTH_SECRET ||
  (process.env.NODE_ENV !== "production"
    ? "educore-dev-auth-secret"
    : undefined);
const cookieSameSite = process.env.NODE_ENV === "production" ? "strict" : "lax";

type AuthRow = {
  id: string;
  email: string;
  full_name?: string;
  fullName?: string;
  role: AuthRole;
  version?: number;
  password_hash?: string;
};

function isArgon2Hash(value: string): boolean {
  return value.startsWith("$argon2");
}

async function verifyAndUpgradeLegacyPassword(params: {
  userId: string;
  password: string;
  storedHash: string;
}): Promise<boolean> {
  const { userId, password, storedHash } = params;

  if (!storedHash) {
    return false;
  }

  if (isArgon2Hash(storedHash)) {
    return verifyPassword(password, storedHash);
  }

  if (password !== storedHash) {
    return false;
  }

  try {
    const client = createAuthDbClient();
    const nextHash = await hashPassword(password);
    await client.execute({
      sql: "UPDATE users SET password_hash = ?, updated_at = CAST(strftime('%s', 'now') AS INTEGER), sync_status = 'pending' WHERE id = ?",
      args: [nextHash, userId],
    });
    return true;
  } catch (error) {
    console.error("[AUTH] Failed to upgrade legacy password hash", error);
    return true;
  }
}

type SessionUserWithRole = {
  id?: string;
  role?: AuthRole;
  version?: number;
  sessionRevoked?: boolean;
};

function normalizeVersion(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 1;
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials, request) => {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = credentials.email as string;
        const password = credentials.password as string;

        try {
          const client = createAuthDbClient();
          const clientIp = extractClientIp(request);
          const identifier = normalizeLoginIdentifier(email);
          const emailCandidates = buildLoginEmailCandidates(identifier);

          if (emailCandidates.length === 0) {
            return null;
          }

          const [emailLimit, ipLimit] = await Promise.all([
            consumeRateLimit(client, {
              scope: "login:email",
              key: identifier,
              maxAttempts: MAX_ATTEMPTS,
              windowMs: LOCKOUT_DURATION,
              blockMs: LOCKOUT_DURATION,
            }),
            consumeRateLimit(client, {
              scope: "login:ip",
              key: clientIp,
              maxAttempts: MAX_ATTEMPTS * 2,
              windowMs: LOCKOUT_DURATION,
              blockMs: LOCKOUT_DURATION,
            }),
          ]);

          const blockedLimit = !emailLimit.allowed ? emailLimit : ipLimit;

          if (!emailLimit.allowed || !ipLimit.allowed) {
            throw new Error(
              `Akun terkunci. Coba lagi dalam ${Math.ceil(
                blockedLimit.retryAfterSeconds / 60,
              )} menit.`,
            );
          }

          // Find user by email using raw SQL
          const result = await client.execute({
            sql: `SELECT id, email, full_name, role, version, password_hash
                  FROM users
                  WHERE (
                    lower(email) IN (${emailCandidates.map(() => "?").join(", ")})
                    OR (? NOT LIKE '%@%' AND lower(COALESCE(nip, '')) = ?)
                    OR (? NOT LIKE '%@%' AND lower(COALESCE(nis, '')) = ?)
                  )
                    AND deleted_at IS NULL
                    AND is_active = 1
                  LIMIT 1`,
            args: [
              ...emailCandidates,
              identifier,
              identifier,
              identifier,
              identifier,
            ],
          });

          const rows = result.rows as unknown as AuthRow[];

          if (!rows || rows.length === 0) {
            return null;
          }

          const user = rows[0];

          // Verify password
          // For web, we need to use a server-side compatible hash verification
          // Since argon2 is not available in browser, we'll use a simple comparison for now
          // In production, implement proper server-side password verification
          const storedHash =
            typeof user.password_hash === "string" ? user.password_hash : "";
          const isValidPassword = await verifyAndUpgradeLegacyPassword({
            userId: user.id,
            password,
            storedHash,
          });

          if (!isValidPassword) {
            return null;
          }

          await Promise.all([
            resetRateLimit(client, "login:email", identifier),
            resetRateLimit(client, "login:ip", clientIp),
          ]);

          // Return user object
          return {
            id: user.id,
            email: user.email,
            name: user.fullName || user.full_name,
            role: user.role,
            version: normalizeVersion(user.version),
          };
        } catch (error) {
          console.error("Auth error:", error);
          throw error;
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as SessionUserWithRole).role;
        token.version = normalizeVersion((user as SessionUserWithRole).version);
        token.sessionRevoked = false;
        return token;
      }

      if (!token.id || token.sessionRevoked) {
        return token;
      }

      const client = createAuthDbClient();
      const userState = await getUserSessionState(client, token.id as string);

      if (
        !userState ||
        !userState.isActive ||
        userState.deletedAt !== null ||
        userState.version !== normalizeVersion(token.version)
      ) {
        console.error("[AUTH][jwt] Revoking session", {
          tokenId: token.id,
          tokenRole: token.role ?? null,
          tokenVersion: normalizeVersion(token.version),
          userState,
        });
        token.sessionRevoked = true;
        return token;
      }

      token.role = userState.role;
      token.version = userState.version;
      return token;
    },
    async session({ session, token }) {
      if (token.sessionRevoked || !session.user) {
        return null as never;
      }

      if (session.user) {
        session.user.id = token.id as string;
        (session.user as SessionUserWithRole).role = token.role as AuthRole;
        (session.user as SessionUserWithRole).version = normalizeVersion(
          token.version,
        );
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 hours
  },
  cookies: {
    sessionToken: {
      name: `${process.env.NODE_ENV === "production" ? "__Secure-" : ""}next-auth.session-token`,
      options: {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: cookieSameSite,
        path: "/",
        maxAge: 24 * 60 * 60, // 24 hours
      },
    },
  },
  secret: authSecret,
  trustHost,
});
