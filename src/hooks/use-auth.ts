"use client";

import type { Session } from "next-auth";
import { getSession, signIn, signOut } from "next-auth/react";
import { useEffect, useState } from "react";
import { useAuthSessionRuntime } from "@/components/providers/auth-session-provider";
import { isTauri } from "@/core/env";
import {
  clearForcedLogoutMarker,
  setForcedLogoutMarker,
} from "@/lib/auth/logout-marker";
import { type UserSession, useStore } from "@/lib/store/use-store";

type SessionRole = UserSession["role"];
type AuthSource = "next-auth" | "desktop-store" | "none";
type DesktopNativeLoginUser = {
  id?: string | null;
  fullName?: string | null;
  email?: string | null;
  role?: string | null;
  version?: number | null;
  hlc?: string | null;
  createdAt?: number | string | null;
  updatedAt?: number | string | null;
  deletedAt?: number | string | null;
  syncStatus?: UserSession["syncStatus"] | null;
  nip?: string | null;
  nis?: string | null;
  nisn?: string | null;
  tempatLahir?: string | null;
  tanggalLahir?: number | string | null;
  jenisKelamin?: UserSession["jenisKelamin"] | null;
  alamat?: string | null;
  noTelepon?: string | null;
  foto?: string | null;
  kelasId?: string | null;
  isActive?: boolean | number | string | null;
  lastLoginAt?: number | string | null;
  provider?: string | null;
  providerId?: string | null;
};

type DesktopNativeLoginResponse = {
  success: boolean;
  user?: DesktopNativeLoginUser | null;
  error?: string | null;
  dbPath?: string | null;
};

const DESKTOP_NATIVE_LOGIN_TIMEOUT_MS = 15_000;
const DESKTOP_POST_LOGIN_REPAIR_TIMEOUT_MS = 30_000;

function toDesktopDate(value: number | string | null | undefined) {
  if (value === null || value === undefined) {
    return value ?? null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(value * 1000);
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return new Date(parsed * 1000);
    }
  }

  return null;
}

function toDesktopBoolean(
  value: boolean | number | string | null | undefined,
  fallback: boolean,
) {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "1" || normalized === "true") {
      return true;
    }
    if (normalized === "0" || normalized === "false") {
      return false;
    }
  }

  return fallback;
}

function buildDesktopNativeSession(
  user: DesktopNativeLoginUser | null | undefined,
): UserSession | null {
  if (!user?.id || !user.email || !user.role) {
    return null;
  }

  return {
    id: user.id,
    fullName: user.fullName ?? "",
    email: user.email,
    role: user.role as SessionRole,
    version: user.version ?? 1,
    hlc: user.hlc ?? null,
    createdAt: toDesktopDate(user.createdAt) ?? new Date(),
    updatedAt: toDesktopDate(user.updatedAt) ?? new Date(),
    deletedAt: toDesktopDate(user.deletedAt),
    syncStatus:
      user.syncStatus === "pending" || user.syncStatus === "error"
        ? user.syncStatus
        : "synced",
    nip: user.nip ?? null,
    nis: user.nis ?? null,
    nisn: user.nisn ?? null,
    tempatLahir: user.tempatLahir ?? null,
    tanggalLahir: toDesktopDate(user.tanggalLahir),
    jenisKelamin: user.jenisKelamin ?? null,
    alamat: user.alamat ?? null,
    noTelepon: user.noTelepon ?? null,
    foto: user.foto ?? null,
    kelasId: user.kelasId ?? null,
    isActive: toDesktopBoolean(user.isActive, true),
    lastLoginAt: toDesktopDate(user.lastLoginAt),
    provider: user.provider ?? null,
    providerId: user.providerId ?? null,
  };
}

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

function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string,
) {
  return new Promise<T>((resolve, reject) => {
    const timeoutId = window.setTimeout(() => {
      reject(new Error(errorMessage));
    }, timeoutMs);

    promise.then(
      (value) => {
        window.clearTimeout(timeoutId);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timeoutId);
        reject(error);
      },
    );
  });
}

function getDesktopLoginErrorMessage(errorCode?: string | null) {
  switch (errorCode) {
    case "INVALID_CREDENTIALS":
      return "Email atau password salah";
    case "USER_NOT_FOUND":
      return "Akun desktop belum tersedia di perangkat ini.";
    case "PASSWORD_HASH_MISSING":
      return "Akun desktop belum siap dipakai. Jalankan sinkronisasi lalu coba lagi.";
    default:
      return "Login desktop gagal diproses.";
  }
}

async function verifyDesktopLoginNativeFallback(
  identifier: string,
  password: string,
) {
  const { invoke } = await import("@tauri-apps/api/core");
  const nativeResult = await withTimeout(
    invoke<DesktopNativeLoginResponse>("verify_local_desktop_login", {
      request: {
        identifier,
        password,
      },
    }),
    DESKTOP_NATIVE_LOGIN_TIMEOUT_MS,
    "Native desktop login timeout",
  );

  if (!nativeResult.success || !nativeResult.user) {
    return null;
  }

  return buildDesktopNativeSession(nativeResult.user);
}

async function finalizeDesktopLogin(
  identifier: string,
  password: string,
  setUser: (user: UserSession) => void,
  seedUser?: UserSession | null,
) {
  if (seedUser) {
    setUser(seedUser);
  }

  const { apiPost } = await import("@/lib/api/request");
  const repairPromise = apiPost<{ user: UserSession }>("/api/auth/login", {
    email: identifier,
    password,
  });

  const applyRepairedUser = (
    result: { user: UserSession } | null | undefined,
  ) => {
    if (result?.user) {
      setUser(result.user);
    }
  };

  if (seedUser) {
    try {
      const result = await withTimeout(
        repairPromise,
        DESKTOP_POST_LOGIN_REPAIR_TIMEOUT_MS,
        "Desktop post-login repair timeout",
      );
      applyRepairedUser(result);
      clearForcedLogoutMarker();
      return { success: true as const };
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === "Desktop post-login repair timeout"
      ) {
        console.warn(
          "[AUTH] Desktop post-login repair is still running in the background.",
        );
        void repairPromise
          .then((result) => {
            applyRepairedUser(result);
          })
          .catch((backgroundError) => {
            console.warn(
              "[AUTH] Background desktop post-login repair failed.",
              backgroundError,
            );
          });
        clearForcedLogoutMarker();
        return { success: true as const };
      }

      throw error;
    }
  }

  const result = await withTimeout(
    repairPromise,
    DESKTOP_POST_LOGIN_REPAIR_TIMEOUT_MS,
    "Desktop post-login repair timeout",
  );

  applyRepairedUser(result);
  clearForcedLogoutMarker();
  return { success: true as const };
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
  const detectedDesktopRuntime = hasMounted && isTauri();
  const desktopRuntime =
    runtimeSession.desktopRuntime || detectedDesktopRuntime;
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

    if (
      user &&
      !desktopRuntime &&
      status === "unauthenticated" &&
      authSource !== "desktop-store"
    ) {
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
    authSource,
  ]);

  /**
   * Login with email and password
   */
  async function login(email: string, password: string) {
    const identifier = email.trim();

    if (desktopRuntime) {
      let shouldFallbackToDesktopApi = true;

      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const nativeResult = await withTimeout(
          invoke<DesktopNativeLoginResponse>("verify_local_desktop_login", {
            request: {
              identifier,
              password,
            },
          }),
          DESKTOP_NATIVE_LOGIN_TIMEOUT_MS,
          "Native desktop login timeout",
        );

        if (nativeResult.success && nativeResult.user) {
          const nativeUser = buildDesktopNativeSession(nativeResult.user);
          if (nativeUser) {
            try {
              return await finalizeDesktopLogin(
                identifier,
                password,
                setUser,
                nativeUser,
              );
            } catch (error) {
              console.warn(
                "[AUTH] Desktop post-login repair failed after native login.",
                error,
              );
              setUser(nativeUser);
              clearForcedLogoutMarker();
              return { success: true as const };
            }
          }
        }

        if (nativeResult.error === "INVALID_CREDENTIALS") {
          return {
            success: false as const,
            error: getDesktopLoginErrorMessage(nativeResult.error),
          };
        }

        if (nativeResult.error) {
          shouldFallbackToDesktopApi =
            nativeResult.error === "USER_NOT_FOUND" ||
            nativeResult.error === "PASSWORD_HASH_MISSING";

          if (!shouldFallbackToDesktopApi) {
            return {
              success: false as const,
              error: getDesktopLoginErrorMessage(nativeResult.error),
            };
          }
        }
      } catch (error) {
        console.warn("[AUTH] Native desktop login path failed.", error);
      }

      if (!shouldFallbackToDesktopApi) {
        return {
          success: false as const,
          error: "Login desktop gagal diproses.",
        };
      }

      try {
        return await finalizeDesktopLogin(identifier, password, setUser);
      } catch (error) {
        if (
          error instanceof Error &&
          error.message === "Desktop post-login repair timeout"
        ) {
          try {
            const nativeUser = await verifyDesktopLoginNativeFallback(
              identifier,
              password,
            );

            if (nativeUser) {
              return await finalizeDesktopLogin(
                identifier,
                password,
                setUser,
                nativeUser,
              );
            }
          } catch (nativeFallbackError) {
            console.warn(
              "[AUTH] Native desktop fallback after repair timeout failed.",
              nativeFallbackError,
            );
          }
        }

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
    clearForcedLogoutMarker();

    return { success: true as const };
  }

  /**
   * Logout current user
   */
  async function logout() {
    setForcedLogoutMarker();

    if (desktopRuntime) {
      try {
        const { apiPost } = await import("@/lib/api/request");
        await apiPost<{ success?: boolean }>("/api/auth/logout");
      } catch (error) {
        console.warn("[AUTH] Desktop logout cleanup failed.", error);
      } finally {
        clearUser();
      }
      return;
    }

    clearUser();
    await signOut({ redirect: true, redirectTo: "/" });
  }

  async function refreshSession() {
    if (desktopRuntime) {
      return Boolean(useStore.getState().user);
    }

    const latestSession = await getSession();
    const effectiveSession =
      latestSession?.user?.id || status !== "authenticated"
        ? latestSession
        : session;

    if (!effectiveSession?.user?.id) {
      if (!desktopRuntime) {
        clearUser();
      }
      return false;
    }

    const nextUser = buildUserSession(effectiveSession.user);
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
