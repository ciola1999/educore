import { describe, expect, it } from "vitest";
import {
  buildClassNameLookupKeys,
  canonicalizeClassDisplayName,
  dedupeCanonicalClassOptions,
  sanitizeClassDisplayName,
} from "./class-name";

describe("class-name utils", () => {
  it("canonicalizes roman numeral kelas labels into numeric labels", () => {
    expect(canonicalizeClassDisplayName("KELAS XII TSM")).toBe("KELAS 12 TSM");
    expect(canonicalizeClassDisplayName("kelas ix")).toBe("KELAS 9");
  });

  it("keeps non-kelas labels stable while still sanitizing uuid-like values", () => {
    expect(canonicalizeClassDisplayName("X-TSM")).toBe("X-TSM");
    expect(sanitizeClassDisplayName("  X-TSM  ")).toBe("X-TSM");
    expect(
      sanitizeClassDisplayName("2361c8a3-0355-4836-99a1-136f78fe299d"),
    ).toBe("UNASSIGNED");
  });

  it("builds lookup keys that include sanitized and canonical aliases", () => {
    expect(buildClassNameLookupKeys("KELAS XII TSM")).toEqual([
      "KELAS XII TSM",
      "KELAS 12 TSM",
    ]);
  });

  it("deduplicates class options into canonical display names", () => {
    expect(
      dedupeCanonicalClassOptions([
        { id: "legacy-1", name: "KELAS XII TSM" },
        { id: "canonical-1", name: "KELAS 12 TSM" },
        { id: "kelas-7", name: "kelas vii" },
        { id: "uuid-like", name: "2361c8a3-0355-4836-99a1-136f78fe299d" },
      ]),
    ).toEqual([
      { id: "canonical-1", name: "KELAS 12 TSM" },
      { id: "kelas-7", name: "KELAS 7" },
    ]);
  });
});
