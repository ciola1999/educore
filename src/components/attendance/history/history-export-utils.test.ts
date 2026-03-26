import { describe, expect, it } from "vitest";
import {
  buildAttendanceHistoryQueryParams,
  escapeAttendanceHistoryHtml,
  getAttendanceHistoryStudentLabel,
} from "./history-export-utils";

describe("history-export-utils", () => {
  it("builds shared attendance history params without leaking all filters", () => {
    const params = buildAttendanceHistoryQueryParams({
      exportData: true,
      analyticsBundle: true,
      limit: 20,
      offset: 0,
      sortBy: "latest",
      studentId: "student-1",
      searchQuery: "  alfa  ",
      status: "late",
      source: "qr",
      startDate: "2026-03-01",
      endDate: "2026-03-31",
      className: "X IPA 1",
    });

    expect(params.get("export")).toBe("true");
    expect(params.get("analyticsBundle")).toBe("true");
    expect(params.get("limit")).toBe("20");
    expect(params.get("offset")).toBe("0");
    expect(params.get("sortBy")).toBe("latest");
    expect(params.get("studentId")).toBe("student-1");
    expect(params.get("searchQuery")).toBe("alfa");
    expect(params.get("status")).toBe("late");
    expect(params.get("source")).toBe("qr");
    expect(params.get("startDate")).toBe("2026-03-01");
    expect(params.get("endDate")).toBe("2026-03-31");
    expect(params.get("className")).toBe("X IPA 1");
  });

  it("resolves student label from options with fallback", () => {
    expect(
      getAttendanceHistoryStudentLabel("all", [
        { id: "student-1", fullName: "A", nis: "100", grade: "10" },
      ]),
    ).toBe("all-students");

    expect(
      getAttendanceHistoryStudentLabel("student-1", [
        { id: "student-1", fullName: "A", nis: "100", grade: "10" },
      ]),
    ).toBe("100");

    expect(getAttendanceHistoryStudentLabel("missing", [])).toBe("missing");
  });

  it("escapes html-sensitive content before print rendering", () => {
    expect(
      escapeAttendanceHistoryHtml(
        `<script>alert("x")</script>'quoted' & "double"`,
      ),
    ).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;&#39;quoted&#39; &amp; &quot;double&quot;",
    );
  });
});
