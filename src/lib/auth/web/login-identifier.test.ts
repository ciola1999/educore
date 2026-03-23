import { describe, expect, it } from "vitest";
import {
  buildLoginEmailCandidates,
  normalizeLoginIdentifier,
} from "./login-identifier";

describe("login-identifier", () => {
  it("normalizes identifier", () => {
    expect(normalizeLoginIdentifier("  Guru  ")).toBe("guru");
  });

  it("returns exact email when identifier is an email", () => {
    expect(buildLoginEmailCandidates("User@School.Com")).toEqual([
      "user@school.com",
    ]);
  });

  it("expands legacy username aliases safely", () => {
    expect(buildLoginEmailCandidates("guru")).toContain("guru@educore.school");
    expect(buildLoginEmailCandidates("staff")).toContain(
      "staff@educore.school",
    );
    expect(buildLoginEmailCandidates("admin")).toContain(
      "admin@educore.school",
    );
  });
});
