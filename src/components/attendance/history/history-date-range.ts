import type { HistoryQuickRange } from "./history-types";

export function formatLocalDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getTodayDateString(now: Date = new Date()) {
  return formatLocalDateInput(now);
}

export function getMonthStartDateString(now: Date = new Date()) {
  return formatLocalDateInput(new Date(now.getFullYear(), now.getMonth(), 1));
}

export function getDaysAgoDateString(days: number, now: Date = new Date()) {
  const date = new Date(now);
  date.setDate(date.getDate() - days);
  return formatLocalDateInput(date);
}

export function getQuickRangeDateRange(
  range: HistoryQuickRange,
  now: Date = new Date(),
) {
  const today = getTodayDateString(now);

  switch (range) {
    case "today":
      return {
        startDate: today,
        endDate: today,
      };
    case "7d":
      return {
        startDate: getDaysAgoDateString(6, now),
        endDate: today,
      };
    case "30d":
      return {
        startDate: getDaysAgoDateString(29, now),
        endDate: today,
      };
    case "month":
      return {
        startDate: getMonthStartDateString(now),
        endDate: today,
      };
    case "all":
      return {
        startDate: "",
        endDate: "",
      };
    default:
      return null;
  }
}

export function isQuickRangeDateRangeActive(
  range: HistoryQuickRange,
  startDate: string,
  endDate: string,
  now: Date = new Date(),
) {
  const expected = getQuickRangeDateRange(range, now);
  if (!expected) {
    return false;
  }

  return (
    expected.startDate === startDate.trim() &&
    expected.endDate === endDate.trim()
  );
}
