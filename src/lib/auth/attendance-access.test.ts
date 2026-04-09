import { describe, expect, it } from "vitest";
import {
  type AttendanceAccessScope,
  canAccessAttendanceClass,
  canAccessAttendanceClassName,
  resolveAttendanceClassNameFilter,
} from "./attendance-access";

describe("attendance access helper", () => {
  it("denies scoped teacher access to synthetic all-classes roster", () => {
    const scope: AttendanceAccessScope = {
      userId: "teacher-1",
      role: "teacher",
      hasRosterAccess: true,
      hasGlobalClassAccess: false,
      classIds: ["class-a"],
    };

    expect(canAccessAttendanceClass(scope, "all")).toBe(false);
    expect(canAccessAttendanceClass(scope, "class-a")).toBe(true);
    expect(canAccessAttendanceClass(scope, "class-b")).toBe(false);
  });

  it("allows global attendance roles to reach any class", () => {
    const scope: AttendanceAccessScope = {
      userId: "staff-1",
      role: "staff",
      hasRosterAccess: true,
      hasGlobalClassAccess: true,
      classIds: [],
    };

    expect(canAccessAttendanceClass(scope, "all")).toBe(true);
    expect(canAccessAttendanceClass(scope, "class-a")).toBe(true);
  });

  it("checks scoped class name access for history filters", () => {
    const scope: AttendanceAccessScope = {
      userId: "teacher-1",
      role: "teacher",
      hasRosterAccess: true,
      hasGlobalClassAccess: false,
      classIds: ["class-a"],
    };

    expect(canAccessAttendanceClassName(scope, ["X-A"], "X-A")).toBe(true);
    expect(canAccessAttendanceClassName(scope, ["X-A"], "X-B")).toBe(false);
  });

  it("allows scoped class name access when casing or whitespace differs", () => {
    const scope: AttendanceAccessScope = {
      userId: "teacher-1",
      role: "teacher",
      hasRosterAccess: true,
      hasGlobalClassAccess: false,
      classIds: ["class-a"],
    };

    expect(
      canAccessAttendanceClassName(scope, ["XII TSM 1"], "  xii tsm 1  "),
    ).toBe(true);
  });

  it("auto-scopes a single teacher class when no class filter is provided", () => {
    const scope: AttendanceAccessScope = {
      userId: "teacher-1",
      role: "teacher",
      hasRosterAccess: true,
      hasGlobalClassAccess: false,
      classIds: ["class-a"],
    };

    expect(resolveAttendanceClassNameFilter(scope, ["X-A"])).toEqual({
      ok: true,
      className: "X-A",
    });
  });

  it("requires an explicit class filter when a scoped teacher has multiple classes", () => {
    const scope: AttendanceAccessScope = {
      userId: "teacher-1",
      role: "teacher",
      hasRosterAccess: true,
      hasGlobalClassAccess: false,
      classIds: ["class-a", "class-b"],
    };

    expect(resolveAttendanceClassNameFilter(scope, ["X-A", "X-B"])).toEqual({
      ok: false,
      code: "ATTENDANCE_CLASS_FILTER_REQUIRED",
      message:
        "Pilih satu kelas attendance yang kamu pegang untuk melihat data ini.",
    });
  });

  it("normalizes requested class filter back to the canonical authorized class name", () => {
    const scope: AttendanceAccessScope = {
      userId: "teacher-1",
      role: "teacher",
      hasRosterAccess: true,
      hasGlobalClassAccess: false,
      classIds: ["class-a"],
    };

    expect(
      resolveAttendanceClassNameFilter(scope, ["XII TSM 1"], " xii tsm 1 "),
    ).toEqual({
      ok: true,
      className: "XII TSM 1",
    });
  });
});
