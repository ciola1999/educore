import { beforeEach, describe, expect, it, vi } from "vitest";

const { pullFromCloudMock, fullSyncMock, pushToCloudMock } = vi.hoisted(() => ({
  pullFromCloudMock: vi.fn(),
  fullSyncMock: vi.fn(),
  pushToCloudMock: vi.fn(),
}));

vi.mock("@/lib/auth/rbac", () => ({
  checkPermission: vi.fn(() => true),
}));

vi.mock("@/lib/store/use-store", () => ({
  useStore: {
    getState: () => ({
      user: {
        id: "admin-1",
        role: "admin",
      },
    }),
  },
}));

vi.mock("@/lib/sync/turso-sync", () => ({
  pullFromCloud: pullFromCloudMock,
  fullSync: fullSyncMock,
  pushToCloud: pushToCloudMock,
}));

import { handleDesktopSyncRoute } from "./desktop-sync-route";

describe("desktop sync route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pushToCloudMock.mockResolvedValue({
      status: "success",
      message: "push ok",
    });
    pullFromCloudMock.mockResolvedValue({
      status: "success",
      message: "pull ok",
    });
    fullSyncMock.mockResolvedValue({
      status: "success",
      message: "full ok",
    });
  });

  it("enables authoritative prune only for manual pull", async () => {
    await handleDesktopSyncRoute("/api/sync/pull", "POST");

    expect(pullFromCloudMock).toHaveBeenCalledWith({
      pruneAuthoritativeTables: true,
    });
    expect(fullSyncMock).not.toHaveBeenCalled();
  });

  it("enables authoritative prune for manual full sync", async () => {
    await handleDesktopSyncRoute("/api/sync/full", "POST");

    expect(fullSyncMock).toHaveBeenCalledWith({
      pruneAuthoritativeTables: true,
    });
    expect(pullFromCloudMock).not.toHaveBeenCalled();
  });

  it("keeps manual push non-destructive and does not pass prune flags", async () => {
    await handleDesktopSyncRoute("/api/sync/push", "POST");

    expect(pushToCloudMock).toHaveBeenCalledWith();
    expect(pullFromCloudMock).not.toHaveBeenCalled();
    expect(fullSyncMock).not.toHaveBeenCalled();
  });
});
