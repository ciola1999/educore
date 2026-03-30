import { beforeEach, describe, expect, it, vi } from "vitest";

const getTeacherOptionsMock = vi.hoisted(() => vi.fn());
const getTeachersMock = vi.hoisted(() => vi.fn());
const addTeacherMock = vi.hoisted(() => vi.fn());
const updateTeacherMock = vi.hoisted(() => vi.fn());
const deleteTeacherMock = vi.hoisted(() => vi.fn());
const importTeachersMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/services/teacher", () => ({
  getTeacherOptions: (...args: unknown[]) => getTeacherOptionsMock(...args),
  getTeachers: (...args: unknown[]) => getTeachersMock(...args),
  addTeacher: (...args: unknown[]) => addTeacherMock(...args),
  updateTeacher: (...args: unknown[]) => updateTeacherMock(...args),
  deleteTeacher: (...args: unknown[]) => deleteTeacherMock(...args),
}));

vi.mock("./desktop-import-handlers", () => ({
  handleDesktopTeacherImportRequest: (...args: unknown[]) =>
    importTeachersMock(...args),
  toDesktopRouteErrorResponse: (error: unknown) => ({
    message: error instanceof Error ? error.message : "IMPORT_ERROR",
    status: 400,
    code: "IMPORT_ERROR",
  }),
}));

import { handleDesktopTeachersRoute } from "./desktop-teachers-route";

describe("desktop teachers route", () => {
  const ensureRole = vi.fn();
  const ensurePermission = vi.fn();

  beforeEach(() => {
    ensureRole.mockReset();
    ensurePermission.mockReset();
    ensureRole.mockReturnValue(null);
    ensurePermission.mockReturnValue(null);
    getTeacherOptionsMock.mockReset();
    getTeachersMock.mockReset();
    addTeacherMock.mockReset();
    updateTeacherMock.mockReset();
    deleteTeacherMock.mockReset();
    importTeachersMock.mockReset();
  });

  it("serves teacher options through the local desktop path", async () => {
    getTeacherOptionsMock.mockResolvedValue([
      { id: "teacher-1", label: "Ahmad" },
    ]);

    const response = await handleDesktopTeachersRoute(
      new URL("http://desktop.local/api/teachers?view=options"),
      "GET",
      ["api", "teachers"],
      undefined,
      {
        ensureRole,
        ensurePermission,
      },
    );

    expect(ensurePermission).toHaveBeenCalledWith("academic:write");
    expect(getTeacherOptionsMock).toHaveBeenCalledTimes(1);
    expect(response?.status).toBe(200);
  });

  it("creates a teacher through the local desktop service path", async () => {
    addTeacherMock.mockResolvedValue({
      success: true,
      id: "teacher-1",
    });

    const payload = {
      fullName: "Ahmad Fauzi",
      email: "ahmad.fauzi@school.local",
      role: "teacher",
    };

    const response = await handleDesktopTeachersRoute(
      new URL("http://desktop.local/api/teachers"),
      "POST",
      ["api", "teachers"],
      payload,
      {
        ensureRole,
        ensurePermission,
      },
    );

    expect(ensureRole).toHaveBeenCalledWith(["admin", "super_admin"]);
    expect(addTeacherMock).toHaveBeenCalledWith(payload);
    expect(response?.status).toBe(201);
  });
});
