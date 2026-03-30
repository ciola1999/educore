import { describe, expect, it, vi } from "vitest";
import { handleDesktopStudentsRoute } from "./desktop-students-route";

describe("desktop students route", () => {
  it("delegates students request to the local students handler", async () => {
    const handleStudents = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ success: true }), { status: 200 }),
      );
    const url = new URL(
      "http://desktop.local/api/students?includeAttendanceToday=1&date=2026-03-30",
    );
    const pathSegments = ["api", "students"];
    const payload = {
      nis: "2324.10.001",
      fullName: "Aditya Putra",
    };

    const response = await handleDesktopStudentsRoute(
      url,
      "POST",
      pathSegments,
      payload,
      {
        handleStudents,
      },
    );

    expect(handleStudents).toHaveBeenCalledWith(
      url,
      "POST",
      pathSegments,
      payload,
    );
    expect(response?.status).toBe(200);
  });

  it("returns null for non-students paths", async () => {
    const handleStudents = vi.fn();
    const response = await handleDesktopStudentsRoute(
      new URL("http://desktop.local/api/teachers"),
      "GET",
      ["api", "teachers"],
      null,
      { handleStudents },
    );

    expect(handleStudents).not.toHaveBeenCalled();
    expect(response).toBeNull();
  });

  it("fails secure when the students handler returns null", async () => {
    const handleStudents = vi.fn().mockResolvedValue(null);
    const response = await handleDesktopStudentsRoute(
      new URL("http://desktop.local/api/students/unknown"),
      "GET",
      ["api", "students", "unknown"],
      null,
      { handleStudents },
    );

    expect(handleStudents).toHaveBeenCalledOnce();
    expect(response?.status).toBe(404);
    await expect(response?.json()).resolves.toMatchObject({
      success: false,
      code: "NOT_FOUND",
    });
  });

  it("delegates legacy student class group routes with the UI path shape", async () => {
    const handleStudents = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: [] }), {
        status: 200,
      }),
    );
    const url = new URL(
      "http://desktop.local/api/students/classes/legacy-groups",
    );
    const pathSegments = ["api", "students", "classes", "legacy-groups"];

    const response = await handleDesktopStudentsRoute(
      url,
      "GET",
      pathSegments,
      null,
      { handleStudents },
    );

    expect(handleStudents).toHaveBeenCalledWith(url, "GET", pathSegments, null);
    expect(response?.status).toBe(200);
  });

  it("delegates student class repair routes with the UI path shape", async () => {
    const handleStudents = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ success: true, data: { updated: 2 } }), {
        status: 200,
      }),
    );
    const url = new URL("http://desktop.local/api/students/classes/repair");
    const pathSegments = ["api", "students", "classes", "repair"];
    const payload = { className: "X IPA 1" };

    const response = await handleDesktopStudentsRoute(
      url,
      "POST",
      pathSegments,
      payload,
      { handleStudents },
    );

    expect(handleStudents).toHaveBeenCalledWith(
      url,
      "POST",
      pathSegments,
      payload,
    );
    expect(response?.status).toBe(200);
  });
});
