const UUID_LIKE_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isUuidLikeClassValue(
  value: string | null | undefined,
): boolean {
  return UUID_LIKE_PATTERN.test((value || "").trim());
}

export function sanitizeClassDisplayName(
  ...candidates: Array<string | null | undefined>
): string {
  for (const candidate of candidates) {
    const normalized = candidate?.trim();
    if (!normalized) {
      continue;
    }
    if (isUuidLikeClassValue(normalized)) {
      continue;
    }
    return normalized;
  }

  return "UNASSIGNED";
}
