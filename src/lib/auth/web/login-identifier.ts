const LOGIN_ALIAS_TO_EMAIL: Record<string, string> = {
  admin: "admin@educore.school",
  superadmin: "admin@educore.school",
  super_admin: "admin@educore.school",
  guru: "guru@educore.school",
  staff: "staff@educore.school",
};

export function normalizeLoginIdentifier(value: string): string {
  return value.trim().toLowerCase();
}

export function buildLoginEmailCandidates(identifier: string): string[] {
  const normalized = normalizeLoginIdentifier(identifier);
  if (!normalized) {
    return [];
  }

  if (normalized.includes("@")) {
    return [normalized];
  }

  const candidates = new Set<string>();
  candidates.add(normalized);

  const aliasEmail = LOGIN_ALIAS_TO_EMAIL[normalized];
  if (aliasEmail) {
    candidates.add(aliasEmail);
  }

  candidates.add(`${normalized}@educore.school`);

  return [...candidates];
}
