export function extractAttendanceRiskFollowUpId(
  link: string | null | undefined,
) {
  if (!link) {
    return null;
  }

  try {
    const url = new URL(link, "https://educore.local");
    return url.searchParams.get("followUpId")?.trim() || null;
  } catch {
    return null;
  }
}
