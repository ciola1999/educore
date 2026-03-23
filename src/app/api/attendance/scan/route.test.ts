import { describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
const requirePermissionMock = vi.hoisted(() => vi.fn());
const processQRScanMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/web/auth", () => ({
  auth: authMock,
}));

vi.mock("@/lib/api/authz", () => ({
  requirePermission: requirePermissionMock,
}));

vi.mock("@/core/services/attendance-service", () => ({
  processQRScan: processQRScanMock,
}));

import { POST } from "./route";

describe("POST /api/attendance/scan", () => {
  it("returns wrapped scan result from backend service", async () => {
    authMock.mockResolvedValue({
      user: { id: "user-1", role: "teacher" },
    });
    requirePermissionMock.mockReturnValue(null);
    processQRScanMock.mockResolvedValue({
      success: true,
      message: "Selamat pagi, Aditya!",
      type: "CHECK_IN",
      data: {
        fullName: "Aditya Putra",
        nis: "2324.10.001",
        grade: "10-A",
        time: "07:01",
        status: "on-time",
        type: "in",
        lateMinutes: 0,
      },
    });

    const response = await POST(
      new Request("http://localhost/api/attendance/scan", {
        method: "POST",
        body: JSON.stringify({
          qrData: '{"nis":"2324.10.001"}',
        }),
      }),
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      success: boolean;
      data: {
        success: boolean;
        type: string;
      };
    };
    expect(payload.success).toBe(true);
    expect(payload.data.success).toBe(true);
    expect(payload.data.type).toBe("CHECK_IN");
    expect(processQRScanMock).toHaveBeenCalledWith('{"nis":"2324.10.001"}');
  });
});
