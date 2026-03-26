import { createAttendanceRiskFollowUp } from "@/core/services/attendance-service";
import { requirePermission } from "@/lib/api/authz";
import { apiError, apiOk } from "@/lib/api/response";
import { auth } from "@/lib/auth/web/auth";

type SessionUserLike = {
  id?: string;
};

export async function POST(request: Request) {
  const session = await auth();
  const guard = requirePermission(session, "attendance:write");
  if (guard) {
    return guard;
  }

  const sessionUser = session?.user as SessionUserLike | undefined;
  if (!sessionUser?.id) {
    return apiError("Unauthorized", 401);
  }

  try {
    const body = (await request.json()) as {
      studentId?: string;
      riskFlags?: unknown[];
      note?: string;
      deadline?: string | null;
    };
    const normalizedRiskFlags = Array.isArray(body.riskFlags)
      ? body.riskFlags
          .filter((item): item is string => typeof item === "string")
          .map((item) => item.trim())
          .filter(Boolean)
      : [];

    if (!body.studentId || normalizedRiskFlags.length === 0) {
      return apiError("Payload follow-up tidak valid", 400, "VALIDATION_ERROR");
    }
    if (
      normalizedRiskFlags.length > 10 ||
      normalizedRiskFlags.some((item) => item.length > 120)
    ) {
      return apiError(
        "Indikator follow-up tidak valid",
        400,
        "VALIDATION_ERROR",
      );
    }

    if (typeof body.note === "string" && body.note.trim().length > 300) {
      return apiError(
        "Catatan follow-up maksimal 300 karakter",
        400,
        "VALIDATION_ERROR",
      );
    }

    if (
      body.deadline !== null &&
      body.deadline !== undefined &&
      (typeof body.deadline !== "string" ||
        !/^\d{4}-\d{2}-\d{2}$/.test(body.deadline))
    ) {
      return apiError(
        "Deadline follow-up harus berformat YYYY-MM-DD",
        400,
        "VALIDATION_ERROR",
      );
    }

    await createAttendanceRiskFollowUp({
      actorUserId: sessionUser.id,
      studentId: body.studentId,
      riskFlags: normalizedRiskFlags,
      note: typeof body.note === "string" ? body.note : undefined,
      deadline: typeof body.deadline === "string" ? body.deadline : null,
    });

    return apiOk({ success: true });
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : "Gagal membuat follow-up",
      400,
      "VALIDATION_ERROR",
    );
  }
}
