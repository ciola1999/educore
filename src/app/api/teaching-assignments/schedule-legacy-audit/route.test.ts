import { beforeEach, describe, expect, it, vi } from "vitest";

const authMock = vi.hoisted(() => vi.fn());
const requirePermissionMock = vi.hoisted(() => vi.fn());
const getLegacyScheduleAuditReportMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth/web/auth", () => ({
  auth: authMock,
}));

vi.mock("@/lib/api/authz", () => ({
  requirePermission: requirePermissionMock,
}));

vi.mock("@/lib/services/legacy-schedule-audit", () => ({
  getLegacyScheduleAuditReport: getLegacyScheduleAuditReportMock,
}));

describe("GET /api/teaching-assignments/schedule-legacy-audit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: "admin-1", role: "admin" } });
    requirePermissionMock.mockReturnValue(null);
    getLegacyScheduleAuditReportMock.mockResolvedValue({
      totalLegacyRows: 1,
      filteredRows: 1,
      summary: {
        already_canonical: 0,
        ready_to_backfill: 0,
        ambiguous_assignment: 1,
        missing_assignment: 0,
      },
      items: [],
    });
  });

  it("returns audit data for valid filter", async () => {
    const { GET } = await import("./route");

    const response = await GET(
      new Request(
        "http://localhost/api/teaching-assignments/schedule-legacy-audit?status=ambiguous_assignment&limit=10",
      ),
    );

    expect(response.status).toBe(200);
    expect(getLegacyScheduleAuditReportMock).toHaveBeenCalledWith({
      status: "ambiguous_assignment",
      limit: 10,
    });
  });
});
