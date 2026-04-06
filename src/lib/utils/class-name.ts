const UUID_LIKE_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ROMAN_CLASS_LEVEL_MAP: Record<string, string> = {
  XII: "12",
  XI: "11",
  X: "10",
  IX: "9",
  VIII: "8",
  VII: "7",
  VI: "6",
  V: "5",
  IV: "4",
  III: "3",
  II: "2",
  I: "1",
};

export function isUuidLikeClassValue(
  value: string | null | undefined,
): boolean {
  return UUID_LIKE_PATTERN.test((value || "").trim());
}

export function sanitizeClassDisplayName(
  ...candidates: Array<string | null | undefined>
): string {
  for (const candidate of candidates) {
    const normalized = candidate?.trim().replace(/\s+/g, " ");
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

export function canonicalizeClassDisplayName(
  value: string | null | undefined,
): string {
  const sanitized = sanitizeClassDisplayName(value);
  if (sanitized === "UNASSIGNED") {
    return sanitized;
  }

  const normalized = sanitized.trim().replace(/\s+/g, " ");
  const upper = normalized.toUpperCase();
  if (!upper.startsWith("KELAS ")) {
    return normalized;
  }

  return upper.replace(
    /\b(XII|XI|X|IX|VIII|VII|VI|V|IV|III|II|I)\b/g,
    (token) => ROMAN_CLASS_LEVEL_MAP[token] || token,
  );
}

export function buildClassNameLookupKeys(
  ...candidates: Array<string | null | undefined>
): string[] {
  const keys = new Set<string>();

  for (const candidate of candidates) {
    const sanitized = sanitizeClassDisplayName(candidate);
    if (sanitized === "UNASSIGNED") {
      continue;
    }

    keys.add(sanitized);
    keys.add(canonicalizeClassDisplayName(sanitized));
  }

  return [...keys];
}

export type ClassOptionLike = {
  id: string;
  name: string | null | undefined;
};

export function dedupeCanonicalClassOptions<T extends ClassOptionLike>(
  rows: T[],
): Array<{ id: string; name: string }> {
  const canonicalRows = new Map<
    string,
    { id: string; name: string; sourceName: string }
  >();

  for (const row of rows) {
    const sourceName = sanitizeClassDisplayName(row.name);
    const canonicalName = canonicalizeClassDisplayName(row.name);
    if (canonicalName === "UNASSIGNED") {
      continue;
    }

    const existing = canonicalRows.get(canonicalName);
    if (!existing) {
      canonicalRows.set(canonicalName, {
        id: row.id,
        name: canonicalName,
        sourceName,
      });
      continue;
    }

    const rowIsCanonical = sourceName === canonicalName;
    const existingIsCanonical = existing.sourceName === canonicalName;

    if (rowIsCanonical && !existingIsCanonical) {
      canonicalRows.set(canonicalName, {
        id: row.id,
        name: canonicalName,
        sourceName,
      });
    }
  }

  return [...canonicalRows.values()]
    .map(({ id, name }) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
