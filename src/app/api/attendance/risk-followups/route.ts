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
      studentName?: string;
      nis?: string;
      className?: string;
      riskFlags?: string[];
      note?: string;
      deadline?: string | null;
    };

    if (
      !body.studentId ||
      !body.studentName ||
      !body.nis ||
      !body.className ||
      !Array.isArray(body.riskFlags) ||
      body.riskFlags.length === 0
    ) {
      return apiError("Payload follow-up tidak valid", 400, "VALIDATION_ERROR");
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
      studentName: body.studentName,
      nis: body.nis,
      className: body.className,
      riskFlags: body.riskFlags,
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
