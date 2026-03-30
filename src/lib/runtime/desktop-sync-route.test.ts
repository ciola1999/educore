import { beforeEach, describe, expect, it, vi } from "vitest";

const storeState = {
  user: null as unknown,
};

const pushToCloudMock = vi.fn();
const pullFromCloudMock = vi.fn();
const fullSyncMock = vi.fn();
const checkPermissionMock = vi.fn();

vi.mock("@/lib/store/use-store", () => ({
  useStore: {
    getState: () => storeState,
  },
}));

vi.mock("@/lib/auth/rbac", () => ({
  checkPermission: (...args: unknown[]) => checkPermissionMock(...args),
}));

vi.mock("@/lib/sync/turso-sync", () => ({
  pushToCloud: (...args: unknown[]) => pushToCloudMock(...args),
  pullFromCloud: (...args: unknown[]) => pullFromCloudMock(...args),
  fullSync: (...args: unknown[]) => fullSyncMock(...args),
}));

import { handleDesktopSyncRoute } from "./desktop-sync-route";

async function readPayload(response: Response) {
  return (await response.json()) as {
    success: boolean;
    data?: {
      status: string;
      message: string;
    };
    error?: string;
    code?: string;
  };
}

describe("desktop sync route", () => {
  beforeEach(() => {
    storeState.user = null;
    checkPermissionMock.mockReset();
    pushToCloudMock.mockReset();
    pullFromCloudMock.mockReset();
    fullSyncMock.mockReset();
  });

  it("returns unauthorized when there is no desktop session", async () => {
    const response = await handleDesktopSyncRoute("/api/sync/pull", "POST");

    expect(response?.status).toBe(401);
    expect(await readPayload(response as Response)).toMatchObject({
      success: false,
      error: "Unauthorized",
    });
  });

  it("returns forbidden when user lacks settings permission", async () => {
    storeState.user = { role: "teacher" };
    checkPermissionMock.mockReturnValue(false);

    const response = await handleDesktopSyncRoute("/api/sync/pull", "POST");

    expect(checkPermissionMock).toHaveBeenCalledWith(
      storeState.user,
      "settings:manage",
    );
    expect(response?.status).toBe(403);
    expect(await readPayload(response as Response)).toMatchObject({
      success: false,
      error: "Forbidden",
    });
  });

  it("uses local full sync handler for desktop full sync", async () => {
    storeState.user = { role: "super_admin" };
    checkPermissionMock.mockReturnValue(true);
    fullSyncMock.mockResolvedValue({
      status: "success",
      message: "Desktop full sync complete.",
    });

    const response = await handleDesktopSyncRoute("/api/sync/full", "POST");

    expect(fullSyncMock).toHaveBeenCalledTimes(1);
    expect(response?.status).toBe(200);
    expect(await readPayload(response as Response)).toMatchObject({
      success: true,
      data: {
        status: "success",
        message: "Desktop full sync complete.",
      },
    });
  });

  it("returns offline-safe local result for pull sync", async () => {
    storeState.user = { role: "super_admin" };
    checkPermissionMock.mockReturnValue(true);
    pullFromCloudMock.mockResolvedValue({
      status: "error",
      message:
        "Desktop sedang offline. Pull sync dari cloud ditunda sampai koneksi tersedia.",
    });

    const response = await handleDesktopSyncRoute("/api/sync/pull", "POST");

    expect(pullFromCloudMock).toHaveBeenCalledTimes(1);
    expect(response?.status).toBe(200);
    expect(await readPayload(response as Response)).toMatchObject({
      success: true,
      data: {
        status: "error",
        message:
          "Desktop sedang offline. Pull sync dari cloud ditunda sampai koneksi tersedia.",
      },
    });
  });
});
