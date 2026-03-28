function collectLegacyScheduleErrorMessages(
  error: unknown,
  visited = new Set<unknown>(),
): string[] {
  if (!error || visited.has(error)) {
    return [];
  }

  visited.add(error);

  if (typeof error === "string") {
    return [error];
  }

  if (error instanceof Error) {
    return [
      error.message,
      ...collectLegacyScheduleErrorMessages(
        error as Error & { cause?: unknown },
        visited,
      ),
      ...collectLegacyScheduleErrorMessages(
        (error as Error & { cause?: unknown }).cause,
        visited,
      ),
    ];
  }

  if (typeof error === "object") {
    const record = error as Record<string, unknown>;
    return [
      typeof record.message === "string" ? record.message : "",
      ...collectLegacyScheduleErrorMessages(record.cause, visited),
      ...collectLegacyScheduleErrorMessages(record.proto, visited),
    ].filter(Boolean);
  }

  return [];
}

export function isLegacyScheduleTableMissingError(error: unknown) {
  return collectLegacyScheduleErrorMessages(error).some((message) => {
    const normalized = message.toLowerCase();
    return (
      normalized.includes("no such table") && normalized.includes("schedule")
    );
  });
}
