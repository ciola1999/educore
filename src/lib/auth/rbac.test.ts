import { describe, expect, it } from "vitest";
import {
  checkPermission,
  getPermissions,
  getUserRole,
  hasAllPermissions,
  hasPermission,
  requireAnyRole,
  requirePermission,
} from "./rbac";

describe("RBAC service", () => {
  it("reads roles from direct and nested session shapes", () => {
    expect(getUserRole({ role: "admin" })).toBe("admin");
    expect(getUserRole({ user: { role: "teacher" } })).toBe("teacher");
    expect(getUserRole({ user: { role: "unknown" } })).toBeNull();
  });

  it("maps permissions consistently for canonical roles", () => {
    expect(hasPermission("super_admin", "users:delete")).toBe(true);
    expect(hasPermission("admin", "settings:manage")).toBe(true);
    expect(hasPermission("teacher", "users:delete")).toBe(false);
    expect(
      hasAllPermissions("teacher", ["academic:read", "attendance:write"]),
    ).toBe(true);
    expect(getPermissions("parent")).toContain("finance:read");
  });

  it("checks permissions from session-like user objects", () => {
    expect(checkPermission({ user: { role: "staff" } }, "finance:write")).toBe(
      true,
    );
    expect(checkPermission({ role: "student" }, "settings:manage")).toBe(false);
    expect(checkPermission({ role: "student" }, "academic:read")).toBe(false);
  });

  it("throws clear errors when permission or role is missing", () => {
    expect(() =>
      requirePermission({ role: "student" }, "finance:write"),
    ).toThrow("finance:write");

    expect(() =>
      requireAnyRole({ role: "parent" }, ["admin", "teacher"]),
    ).toThrow("admin, teacher");
  });
});
