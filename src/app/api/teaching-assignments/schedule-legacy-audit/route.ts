import { z } from "zod";
import { requirePermission } from "@/lib/api/authz";
import { apiError, apiOk } from "@/lib/api/response";
import { auth } from "@/lib/auth/web/auth";
import {
  getLegacyScheduleAuditReport,
  type LegacyScheduleAuditStatus,
} from "@/lib/services/legacy-schedule-audit";

const searchSchema = z.object({
  status: z
    .enum([
      "already_canonical",
      "ready_to_backfill",
      "ambiguous_assignment",
      "missing_assignment",
    ])
    .optional(),
  limit: z.coerce.number().int().min(1).max(500).optional(),
});

export async function GET(request: Request) {
  const session = await auth();
  const guard = requirePermission(session, "academic:write");
  if (guard) {
    return guard;
  }

  const url = new URL(request.url);
  const validation = searchSchema.safeParse({
    status: url.searchParams.get("status") ?? undefined,
    limit: url.searchParams.get("limit") ?? undefined,
  });

  if (!validation.success) {
    return apiError(
      validation.error.issues[0]?.message ||
        "Filter audit jadwal legacy tidak valid",
      400,
      "VALIDATION_ERROR",
    );
  }

  const report = await getLegacyScheduleAuditReport({
    status: validation.data.status as LegacyScheduleAuditStatus | undefined,
    limit: validation.data.limit,
  });

  return apiOk(report);
}
