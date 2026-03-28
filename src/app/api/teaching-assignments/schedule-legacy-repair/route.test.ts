import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
const requirePermissionMock = vi.hoisted(() => vi.fn());
const repairLegacyScheduleMock = vi.hoisted(() => vi.fn());
const bulkRepairReadyLegacySchedulesMock = vi.hoisted(() => vi.fn());
const bulkArchiveAlreadyCanonicalLegacySchedulesMock = vi.hoisted(() =>
  vi.fn(),
);

vi.mock("@/lib/auth/web/auth", () => ({
  auth: authMock,
}));

vi.mock("@/lib/api/authz", () => ({
  requirePermission: requirePermissionMock,
}));

vi.mock("@/lib/services/legacy-schedule-repair", () => ({
  repairLegacySchedule: repairLegacyScheduleMock,
  bulkRepairReadyLegacySchedules: bulkRepairReadyLegacySchedulesMock,
  bulkArchiveAlreadyCanonicalLegacySchedules:
    bulkArchiveAlreadyCanonicalLegacySchedulesMock,
}));

describe("POST /api/teaching-assignments/schedule-legacy-repair", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: "admin-1", role: "admin" } });
    requirePermissionMock.mockReturnValue(null);
  });

  it("returns success response when repair succeeds", async () => {
    repairLegacyScheduleMock.mockResolvedValue({
      success: true,
      legacyScheduleId: "legacy-1",
      canonicalJadwalId: "jadwal-1",
      guruMapelId: "gm-1",
      action: "created",
    });

    const { POST } = await import("./route");
    const response = await POST(
      new Request(
        "http://localhost/api/teaching-assignments/schedule-legacy-repair",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            legacyScheduleId: "11111111-1111-4111-8111-111111111111",
          }),
        },
      ),
    );

    expect(response.status).toBe(200);
    expect(repairLegacyScheduleMock).toHaveBeenCalled();
  });

  it("runs bulk repair for ready_to_backfill mode", async () => {
    bulkRepairReadyLegacySchedulesMock.mockResolvedValue({
      processed: 2,
      created: 2,
      reused: 0,
      skipped: 1,
      failures: [],
    });

    const { POST } = await import("./route");
    const response = await POST(
      new Request(
        "http://localhost/api/teaching-assignments/schedule-legacy-repair",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "ready_to_backfill",
            limit: 20,
          }),
        },
      ),
    );

    expect(response.status).toBe(200);
    expect(bulkRepairReadyLegacySchedulesMock).toHaveBeenCalledWith({
      limit: 20,
    });
  });

  it("runs bulk archive for already_canonical mode", async () => {
    bulkArchiveAlreadyCanonicalLegacySchedulesMock.mockResolvedValue({
      processed: 3,
      archived: 3,
      skipped: 1,
      failures: [],
    });

    const { POST } = await import("./route");
    const response = await POST(
      new Request(
        "http://localhost/api/teaching-assignments/schedule-legacy-repair",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "already_canonical",
            limit: 10,
          }),
        },
      ),
    );

    expect(response.status).toBe(200);
    expect(bulkArchiveAlreadyCanonicalLegacySchedulesMock).toHaveBeenCalledWith(
      {
        limit: 10,
      },
    );
  });
});
