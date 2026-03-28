import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
const requirePermissionMock = vi.hoisted(() => vi.fn());
const updateScheduleMock = vi.hoisted(() => vi.fn());
const deleteScheduleMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/web/auth", () => ({
  auth: authMock,
}));

vi.mock("@/lib/api/authz", () => ({
  requirePermission: requirePermissionMock,
}));

vi.mock("@/lib/services/academic", () => ({
  updateSchedule: updateScheduleMock,
  deleteSchedule: deleteScheduleMock,
}));

describe("/api/schedules/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: "admin-1", role: "admin" } });
    requirePermissionMock.mockReturnValue(null);
  });

  it("returns success on PATCH", async () => {
    updateScheduleMock.mockResolvedValue({ success: true });

    const { PATCH } = await import("./route");
    const response = await PATCH(
      new Request("http://localhost/api/schedules/jadwal-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guruMapelId: "11111111-1111-4111-8111-111111111111",
          hari: 1,
          jamMulai: "07:00",
          jamSelesai: "08:00",
        }),
      }),
      { params: Promise.resolve({ id: "jadwal-1" }) },
    );

    expect(response.status).toBe(200);
    expect(updateScheduleMock).toHaveBeenCalled();
  });

  it("returns success on DELETE", async () => {
    deleteScheduleMock.mockResolvedValue({ success: true });

    const { DELETE } = await import("./route");
    const response = await DELETE(new Request("http://localhost"), {
      params: Promise.resolve({ id: "jadwal-1" }),
    });

    expect(response.status).toBe(200);
    expect(deleteScheduleMock).toHaveBeenCalledWith("jadwal-1");
  });
});
