import { describe, expect, it } from "vitest";
import { isUuidLikeClassValue, sanitizeClassDisplayName } from "./class-name";

describe("class-name", () => {
  it("detects uuid-like class values", () => {
    expect(isUuidLikeClassValue("55c3881a-6362-4220-9fc1-dce2a4902eb6")).toBe(
      true,
    );
    expect(isUuidLikeClassValue("XII TSM 1")).toBe(false);
  });

  it("never returns uuid-like values for display", () => {
    expect(
      sanitizeClassDisplayName(
        "55c3881a-6362-4220-9fc1-dce2a4902eb6",
        "XII TSM 1",
      ),
    ).toBe("XII TSM 1");
    expect(
      sanitizeClassDisplayName("55c3881a-6362-4220-9fc1-dce2a4902eb6"),
    ).toBe("UNASSIGNED");
  });
});
