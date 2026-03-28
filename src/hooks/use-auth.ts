"use client";

import type { Session } from "next-auth";
import { getSession, signIn, signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import { useAuthSessionRuntime } from "@/components/providers/auth-session-provider";
import { isTauri } from "@/core/env";
import { apiPost } from "@/lib/api/request";
import { type UserSession, useStore } from "@/lib/store/use-store";

type SessionRole = UserSession["role"];
type AuthSource = "next-auth" | "desktop-store" | "none";

function buildUserSession(
  sessionUser: NonNullable<Session["user"]>,
): UserSession | null {
  if (!sessionUser.id) {
    return null;
  }

  const now = new Date();

  return {
    id: sessionUser.id,
    fullName: sessionUser.name || "",
    email: sessionUser.email || "",
    role: ((sessionUser as { role?: SessionRole }).role ||
      "teacher") as SessionRole,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    version: 1,
    hlc: null,
    syncStatus: "synced",
    nip: null,
    nis: null,
    nisn: null,
    tempatLahir: null,
    tanggalLahir: null,
    jenisKelamin: null,
    alamat: null,
    noTelepon: null,
    foto: null,
    kelasId: null,
    isActive: true,
    lastLoginAt: null,
    provider: null,
    providerId: null,
  };
}

/**
 * Auth hook for managing user authentication state
 */
export function useAuth() {
  const [hasMounted, setHasMounted] = useState(false);
  const runtimeSession = useAuthSessionRuntime();
  const user = useStore((state) => state.user);
  const setUser = useStore((state) => state.login);
  const clearUser = useStore((state) => state.logout);
  const desktopRuntime = hasMounted && isTauri();
  const session = runtimeSession.session;
  const status = runtimeSession.status;
  const sessionUser = session?.user ? buildUserSession(session.user) : null;
  const isLoading = !hasMounted || (!desktopRuntime && status === "loading");
  const resolvedUser = hasMounted ? (sessionUser ?? user) : null;
  const isAuthenticated = resolvedUser !== null;
  const authSource: AuthSource =
    hasMounted && sessionUser
      ? "next-auth"
      : hasMounted && user
        ? "desktop-store"
        : "none";

  useEffect(() => {
    setHasMounted(true);
  }, []);

  useEffect(() => {
    if (!hasMounted) {
      return;
    }

    if (status === "loading") {
      return;
    }

    if (status === "authenticated" && sessionUser) {
      const shouldSync =
        !user ||
        user.id !== sessionUser.id ||
        user.email !== sessionUser.email ||
        user.role !== sessionUser.role ||
        user.fullName !== sessionUser.fullName;

      if (shouldSync) {
        setUser({
          ...user,
          ...sessionUser,
          createdAt: user?.createdAt ?? sessionUser.createdAt,
          updatedAt: new Date(),
        });
      }
      return;
    }

    if (user && !desktopRuntime) {
      clearUser();
    }
  }, [
    status,
    sessionUser,
    user,
    setUser,
    clearUser,
    desktopRuntime,
    hasMounted,
  ]);

  /**
   * Login with email and password
   */
  async function login(email: string, password: string) {
    const identifier = email.trim();

    if (desktopRuntime) {
      try {
        await apiPost<{ user: UserSession }>("/api/auth/login", {
          email: identifier,
          password,
        });
        return { success: true as const };
      } catch (error) {
        return {
          success: false as const,
          error:
            error instanceof Error
              ? error.message
              : "Email atau password salah",
        };
      }
    }

    const result = await signIn("credentials", {
      email: identifier,
      password,
      redirect: false,
    });

    if (!result || result.error) {
      return {
        success: false as const,
        error: "Email atau password salah",
      };
    }

    const session = await getSession();
    if (!session?.user?.id) {
      return {
        success: false as const,
        error: "Sesi login gagal dibuat",
      };
    }

    const nextUser = buildUserSession(session.user);
    if (!nextUser) {
      return {
        success: false as const,
        error: "Data sesi login tidak valid",
      };
    }

    setUser(nextUser);

    return { success: true as const };
  }

  /**
   * Logout current user
   */
  async function logout() {
    try {
      if (!desktopRuntime) {
        await fetch("/api/auth/logout", { method: "POST" });
      }
    } finally {
      if (!desktopRuntime) {
        await signOut({ redirect: false });
      }
      clearUser();
    }
  }

  async function refreshSession() {
    if (desktopRuntime) {
      return Boolean(useStore.getState().user);
    }

    const latestSession = await getSession();

    if (!latestSession?.user?.id) {
      if (!desktopRuntime) {
        clearUser();
      }
      return false;
    }

    const nextUser = buildUserSession(latestSession.user);
    if (!nextUser) {
      return false;
    }

    setUser(nextUser);
    return true;
  }

  return {
    user: resolvedUser,
    isAuthenticated,
    isLoading,
    session,
    sessionStatus: status,
    authSource,
    login,
    logout,
    refreshSession,
  };
}
