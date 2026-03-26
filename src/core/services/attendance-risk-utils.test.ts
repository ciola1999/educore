import { describe, expect, it } from "vitest";
import { extractAttendanceRiskFollowUpId } from "./attendance-risk-utils";

describe("extractAttendanceRiskFollowUpId", () => {
  it("extracts exact followUpId from relative attendance links", () => {
    expect(
      extractAttendanceRiskFollowUpId(
        "/dashboard/attendance?tab=history&studentId=student-1&followUpId=followup-1",
      ),
    ).toBe("followup-1");
  });

  it("returns null for invalid or missing followUpId", () => {
    expect(extractAttendanceRiskFollowUpId(null)).toBeNull();
    expect(extractAttendanceRiskFollowUpId("/dashboard/attendance")).toBeNull();
    expect(extractAttendanceRiskFollowUpId("not-a-valid-link")).toBeNull();
  });
});
