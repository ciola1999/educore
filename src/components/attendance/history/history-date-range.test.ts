import { describe, expect, it } from "vitest";
import {
  formatLocalDateInput,
  getDaysAgoDateString,
  getMonthStartDateString,
  getQuickRangeDateRange,
  getTodayDateString,
  isQuickRangeDateRangeActive,
} from "./history-date-range";

describe("history date range utils", () => {
  const now = new Date(2026, 3, 6, 9, 45, 0);

  it("formats local date input without relying on UTC serialization", () => {
    expect(formatLocalDateInput(now)).toBe("2026-04-06");
    expect(getTodayDateString(now)).toBe("2026-04-06");
    expect(getMonthStartDateString(now)).toBe("2026-04-01");
    expect(getDaysAgoDateString(6, now)).toBe("2026-03-31");
  });

  it("builds quick ranges using local calendar arithmetic", () => {
    expect(getQuickRangeDateRange("today", now)).toEqual({
      startDate: "2026-04-06",
      endDate: "2026-04-06",
    });
    expect(getQuickRangeDateRange("7d", now)).toEqual({
      startDate: "2026-03-31",
      endDate: "2026-04-06",
    });
    expect(getQuickRangeDateRange("30d", now)).toEqual({
      startDate: "2026-03-08",
      endDate: "2026-04-06",
    });
    expect(getQuickRangeDateRange("month", now)).toEqual({
      startDate: "2026-04-01",
      endDate: "2026-04-06",
    });
    expect(getQuickRangeDateRange("all", now)).toEqual({
      startDate: "",
      endDate: "",
    });
    expect(getQuickRangeDateRange("custom", now)).toBeNull();
  });

  it("detects active quick range selections from explicit dates", () => {
    expect(
      isQuickRangeDateRangeActive("today", "2026-04-06", "2026-04-06", now),
    ).toBe(true);
    expect(
      isQuickRangeDateRangeActive("7d", "2026-03-31", "2026-04-06", now),
    ).toBe(true);
    expect(
      isQuickRangeDateRangeActive("30d", "2026-03-08", "2026-04-06", now),
    ).toBe(true);
    expect(
      isQuickRangeDateRangeActive("month", "2026-04-01", "2026-04-06", now),
    ).toBe(true);
    expect(isQuickRangeDateRangeActive("all", "", "", now)).toBe(true);
    expect(
      isQuickRangeDateRangeActive("today", "2026-04-05", "2026-04-06", now),
    ).toBe(false);
  });
});
