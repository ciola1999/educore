"use client";

import type { Session } from "next-auth";
import { getSession, signIn, signOut, useSession } from "next-auth/react";
import { useEffect } from "react";
import { isTauri } from "@/core/env";
import { type UserSession, useStore } from "@/lib/store/use-store";

type SessionRole = UserSession["role"];

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
  const { data: session, status } = useSession();
  const user = useStore((state) => state.user);
  const setUser = useStore((state) => state.login);
  const clearUser = useStore((state) => state.logout);
  const sessionUser = session?.user ? buildUserSession(session.user) : null;
  const desktopRuntime = isTauri();
  const isLoading = status === "loading";
  const resolvedUser = sessionUser ?? user;
  const isAuthenticated = resolvedUser !== null;

  useEffect(() => {
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
  }, [status, sessionUser, user, setUser, clearUser, desktopRuntime]);

  /**
   * Login with email and password
   */
  async function login(email: string, password: string) {
    const identifier = email.trim();
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
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      await signOut({ redirect: false });
      clearUser();
    }
  }

  return {
    user: resolvedUser,
    isAuthenticated,
    isLoading,
    login,
    logout,
  };
}
