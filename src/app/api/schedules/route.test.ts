import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
const requirePermissionMock = vi.hoisted(() => vi.fn());
const getSchedulesMock = vi.hoisted(() => vi.fn());
const addScheduleMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/web/auth", () => ({
  auth: authMock,
}));

vi.mock("@/lib/api/authz", () => ({
  requirePermission: requirePermissionMock,
}));

vi.mock("@/lib/services/academic", () => ({
  getSchedules: getSchedulesMock,
  addSchedule: addScheduleMock,
}));

describe("/api/schedules", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: "admin-1", role: "admin" } });
    requirePermissionMock.mockReturnValue(null);
  });

  it("returns schedule rows on GET", async () => {
    getSchedulesMock.mockResolvedValue([{ id: "jadwal-1" }]);

    const { GET } = await import("./route");
    const response = await GET(new Request("http://localhost/api/schedules"));

    expect(response.status).toBe(200);
    expect(getSchedulesMock).toHaveBeenCalled();
  });

  it("passes filter params to schedule query", async () => {
    getSchedulesMock.mockResolvedValue([{ id: "jadwal-1" }]);

    const { GET } = await import("./route");
    const response = await GET(
      new Request("http://localhost/api/schedules?hari=1&search=mat"),
    );

    expect(response.status).toBe(200);
    expect(getSchedulesMock).toHaveBeenCalledWith({
      hari: 1,
      search: "mat",
    });
  });

  it("returns created response on POST success", async () => {
    addScheduleMock.mockResolvedValue({
      success: true,
      id: "jadwal-1",
    });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guruMapelId: "11111111-1111-4111-8111-111111111111",
          hari: 1,
          jamMulai: "07:00",
          jamSelesai: "08:00",
          ruangan: "Lab 1",
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(addScheduleMock).toHaveBeenCalled();
  });
});
