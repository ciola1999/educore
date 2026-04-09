import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getSessionMock = vi.hoisted(() => vi.fn());
const signInMock = vi.hoisted(() => vi.fn());
const signOutMock = vi.hoisted(() => vi.fn());
const isTauriMock = vi.hoisted(() => vi.fn());
const useAuthSessionRuntimeMock = vi.hoisted(() => vi.fn());

type StoreUser = {
  id: string;
  fullName: string;
  email: string;
  role: "teacher" | "staff" | "admin";
  createdAt: Date;
  updatedAt: Date;
  deletedAt: null;
  version: number;
  hlc: null;
  syncStatus: "synced";
  nip: null;
  nis: null;
  nisn: null;
  tempatLahir: null;
  tanggalLahir: null;
  jenisKelamin: null;
  alamat: null;
  noTelepon: null;
  foto: null;
  kelasId: null;
  isActive: true;
  lastLoginAt: null;
  provider: null;
  providerId: null;
};

const storeState = vi.hoisted(() => ({
  user: null as StoreUser | null,
  login: vi.fn((user: StoreUser) => {
    storeState.user = user;
  }),
  logout: vi.fn(() => {
    storeState.user = null;
  }),
}));

const useStoreMock = vi.hoisted(() => {
  const fn = <T>(selector: (state: typeof storeState) => T) =>
    selector(storeState);
  return Object.assign(fn, {
    getState: () => storeState,
  });
});

vi.mock("next-auth/react", () => ({
  getSession: getSessionMock,
  signIn: signInMock,
  signOut: signOutMock,
}));

vi.mock("@/core/env", () => ({
  isTauri: isTauriMock,
}));

vi.mock("@/components/providers/auth-session-provider", () => ({
  useAuthSessionRuntime: useAuthSessionRuntimeMock,
}));

vi.mock("@/lib/store/use-store", () => ({
  useStore: useStoreMock,
}));

import { useAuth } from "./use-auth";

function createStoreUser(overrides?: Partial<StoreUser>): StoreUser {
  return {
    id: "store-user",
    fullName: "Store User",
    email: "store@example.com",
    role: "teacher",
    createdAt: new Date("2026-04-01T00:00:00.000Z"),
    updatedAt: new Date("2026-04-01T00:00:00.000Z"),
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
    ...overrides,
  };
}

describe("useAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storeState.user = null;
    isTauriMock.mockReturnValue(false);
    useAuthSessionRuntimeMock.mockReturnValue({
      desktopRuntime: false,
      status: "unauthenticated",
      session: null,
    });
    getSessionMock.mockResolvedValue(null);
  });

  it("clears stale local store when web session is unauthenticated", async () => {
    storeState.user = createStoreUser();

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.sessionStatus).toBe("unauthenticated");
      expect(storeState.logout).toHaveBeenCalledTimes(1);
    });

    expect(result.current.user).toBeNull();
  });

  it("prefers authenticated web session over stale local store data", async () => {
    storeState.user = createStoreUser({
      id: "stale-user",
      email: "stale@example.com",
      fullName: "Stale User",
      role: "teacher",
    });
    useAuthSessionRuntimeMock.mockReturnValue({
      desktopRuntime: false,
      status: "authenticated",
      session: {
        user: {
          id: "session-user",
          name: "Session User",
          email: "session@example.com",
          role: "admin",
        },
      },
    });

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.user?.id).toBe("session-user");
      expect(storeState.login).toHaveBeenCalledTimes(1);
    });

    expect(result.current.user).toMatchObject({
      id: "session-user",
      email: "session@example.com",
      fullName: "Session User",
      role: "admin",
    });
  });

  it("keeps desktop store session when desktop runtime is active", async () => {
    storeState.user = createStoreUser({
      id: "desktop-user",
      email: "desktop@example.com",
      fullName: "Desktop User",
      role: "staff",
    });
    useAuthSessionRuntimeMock.mockReturnValue({
      desktopRuntime: true,
      status: "unauthenticated",
      session: null,
    });

    const { result } = renderHook(() => useAuth());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.user).toMatchObject({
      id: "desktop-user",
      email: "desktop@example.com",
      fullName: "Desktop User",
      role: "staff",
    });
    expect(storeState.logout).not.toHaveBeenCalled();
  });
});
