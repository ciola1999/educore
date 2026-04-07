import { describe, expect, it } from "vitest";
import {
  buildMissingClassReferenceMessage,
  normalizeStudentGradeInput,
} from "@/lib/students/class-reference";

describe("student class reference helpers", () => {
  it("normalizes roman numeral class names into canonical labels", () => {
    expect(normalizeStudentGradeInput("KELAS XII TSM")).toBe("KELAS 12 TSM");
    expect(normalizeStudentGradeInput(" kelas ix ")).toBe("KELAS 9");
  });

  it("builds a clear validation message for missing classes", () => {
    expect(
      buildMissingClassReferenceMessage(["KELAS XII TSM", "KELAS 9"]),
    ).toBe(
      "Kelas berikut belum tersedia di master kelas: KELAS 12 TSM, KELAS 9. Tambahkan dulu di halaman Kelas.",
    );
  });
});
