import { describe, expect, it } from "vitest";
import {
  DASHBOARD_ROLE_DEFAULT_PATH,
  isAllowedDashboardPath,
} from "./dashboard-access";

describe("dashboard access policy", () => {
  it("allows student only to students and attendance", () => {
    expect(isAllowedDashboardPath("student", "/dashboard/students")).toBe(true);
    expect(isAllowedDashboardPath("student", "/dashboard/attendance")).toBe(
      true,
    );
    expect(isAllowedDashboardPath("student", "/dashboard")).toBe(false);
    expect(isAllowedDashboardPath("student", "/dashboard/courses")).toBe(false);
    expect(isAllowedDashboardPath("student", "/dashboard/teachers")).toBe(
      false,
    );
  });

  it("allows admin and super_admin to teachers page", () => {
    expect(isAllowedDashboardPath("admin", "/dashboard/teachers")).toBe(true);
    expect(isAllowedDashboardPath("super_admin", "/dashboard/teachers")).toBe(
      true,
    );
  });

  it("uses expected default path for student", () => {
    expect(DASHBOARD_ROLE_DEFAULT_PATH.student).toBe("/dashboard/students");
  });

  it("keeps teacher and staff away from user management", () => {
    expect(isAllowedDashboardPath("teacher", "/dashboard/teachers")).toBe(
      false,
    );
    expect(isAllowedDashboardPath("staff", "/dashboard/teachers")).toBe(false);
    expect(isAllowedDashboardPath("teacher", "/dashboard/attendance")).toBe(
      true,
    );
    expect(isAllowedDashboardPath("staff", "/dashboard/courses")).toBe(true);
  });

  it("keeps student away from settings and courses", () => {
    expect(isAllowedDashboardPath("student", "/dashboard/settings")).toBe(
      false,
    );
    expect(isAllowedDashboardPath("student", "/dashboard/courses")).toBe(false);
  });
});
