import { z } from "zod";
import { requirePermission } from "@/lib/api/authz";
import { apiError, apiOk } from "@/lib/api/response";
import { auth } from "@/lib/auth/web/auth";
import {
  bulkArchiveAlreadyCanonicalLegacySchedules,
  bulkRepairReadyLegacySchedules,
  repairLegacySchedule,
} from "@/lib/services/legacy-schedule-repair";

const repairSchema = z.object({
  legacyScheduleId: z.string().uuid("Legacy schedule wajib valid."),
  guruMapelId: z.string().uuid("Assignment guru-mapel tidak valid.").optional(),
});

const bulkRepairSchema = z.object({
  mode: z.enum(["ready_to_backfill", "already_canonical"]),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

export async function POST(request: Request) {
  const session = await auth();
  const guard = requirePermission(session, "academic:write");
  if (guard) {
    return guard;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Payload tidak valid", 400, "INVALID_PAYLOAD");
  }

  const validation = repairSchema.safeParse(body);
  const bulkValidation = bulkRepairSchema.safeParse(body);

  if (bulkValidation.success) {
    if (bulkValidation.data.mode === "already_canonical") {
      return apiOk(
        await bulkArchiveAlreadyCanonicalLegacySchedules({
          limit: bulkValidation.data.limit,
        }),
      );
    }

    return apiOk(
      await bulkRepairReadyLegacySchedules({
        limit: bulkValidation.data.limit,
      }),
    );
  }

  if (!validation.success) {
    return apiError(
      validation.error.issues[0]?.message ||
        "Data repair schedule legacy tidak valid",
      400,
      "VALIDATION_ERROR",
    );
  }

  const result = await repairLegacySchedule(validation.data);
  if (!result.success) {
    return apiError(
      result.error,
      result.code === "NOT_FOUND"
        ? 404
        : result.code === "LEGACY_TABLE_RETIRED"
          ? 410
          : result.code === "AMBIGUOUS_ASSIGNMENT"
            ? 409
            : result.code === "MISSING_ASSIGNMENT" ||
                result.code === "INVALID_ASSIGNMENT_SELECTION"
              ? 400
              : 500,
      result.code,
    );
  }

  return apiOk(result);
}
