import { describe, expect, it } from "vitest";
import { requireAnyPermission, requirePermission, requireRole } from "./authz";

describe("api authz guards", () => {
  it("returns 401 when session is missing", () => {
    const response = requirePermission(null, "attendance:read");
    expect(response?.status).toBe(401);
  });

  it("returns 403 when role is not allowed", () => {
    const response = requireRole({ user: { role: "teacher" } }, ["admin"]);
    expect(response?.status).toBe(403);
  });

  it("allows when one permission matches", () => {
    const response = requireAnyPermission({ user: { role: "staff" } }, [
      "attendance:write",
      "settings:manage",
    ]);
    expect(response).toBeNull();
  });
});
