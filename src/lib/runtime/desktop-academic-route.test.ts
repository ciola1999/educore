import { beforeEach, describe, expect, it, vi } from "vitest";

const getClassesMock = vi.hoisted(() => vi.fn());
const getLegacyScheduleAuditReportMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/services/academic", () => ({
  getClasses: (...args: unknown[]) => getClassesMock(...args),
  addClass: vi.fn(),
  updateClass: vi.fn(),
  deleteClass: vi.fn(),
  getAcademicYears: vi.fn(),
  addAcademicYear: vi.fn(),
  updateAcademicYear: vi.fn(),
  deleteAcademicYear: vi.fn(),
  getSemesters: vi.fn(),
  addSemester: vi.fn(),
  updateSemester: vi.fn(),
  deleteSemester: vi.fn(),
  getSubjects: vi.fn(),
  addSubject: vi.fn(),
  updateSubject: vi.fn(),
  deleteSubject: vi.fn(),
  getTeachingAssignmentScheduleOptions: vi.fn(),
  getTeachingAssignments: vi.fn(),
  addTeachingAssignment: vi.fn(),
  updateTeachingAssignment: vi.fn(),
  deleteTeachingAssignment: vi.fn(),
  getSchedules: vi.fn(),
  addSchedule: vi.fn(),
  updateSchedule: vi.fn(),
  deleteSchedule: vi.fn(),
}));

vi.mock("@/lib/services/legacy-schedule-audit", () => ({
  getLegacyScheduleAuditReport: (...args: unknown[]) =>
    getLegacyScheduleAuditReportMock(...args),
}));

vi.mock("@/lib/services/legacy-schedule-repair", () => ({
  bulkArchiveAlreadyCanonicalLegacySchedules: vi.fn(),
  bulkRepairReadyLegacySchedules: vi.fn(),
  repairLegacySchedule: vi.fn(),
}));

import { handleDesktopAcademicRoute } from "./desktop-academic-route";

describe("desktop academic route", () => {
  const ensurePermission = vi.fn();

  beforeEach(() => {
    ensurePermission.mockReset();
    ensurePermission.mockReturnValue(null);
    getClassesMock.mockReset();
    getLegacyScheduleAuditReportMock.mockReset();
  });

  it("serves classes through the local desktop service path", async () => {
    getClassesMock.mockResolvedValue([{ id: "class-1", name: "X-A" }]);

    const response = await handleDesktopAcademicRoute(
      new URL("http://desktop.local/api/classes"),
      "GET",
      ["api", "classes"],
      undefined,
      {
        ensurePermission,
      },
    );

    expect(ensurePermission).toHaveBeenCalledWith("academic:read");
    expect(getClassesMock).toHaveBeenCalledTimes(1);
    expect(response?.status).toBe(200);
  });

  it("serves legacy schedule audit through the local desktop service path", async () => {
    getLegacyScheduleAuditReportMock.mockResolvedValue({
      summary: { total: 1 },
      rows: [],
    });

    const response = await handleDesktopAcademicRoute(
      new URL(
        "http://desktop.local/api/teaching-assignments/schedule-legacy-audit?status=ambiguous_assignment&limit=10",
      ),
      "GET",
      ["api", "teaching-assignments", "schedule-legacy-audit"],
      undefined,
      {
        ensurePermission,
      },
    );

    expect(ensurePermission).toHaveBeenCalledWith("academic:write");
    expect(getLegacyScheduleAuditReportMock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "ambiguous_assignment",
        limit: 10,
      }),
    );
    expect(response?.status).toBe(200);
  });
});
