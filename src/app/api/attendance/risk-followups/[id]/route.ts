import {
  markAttendanceRiskNotificationRead,
  updateAttendanceRiskFollowUp,
} from "@/core/services/attendance-service";
import { requirePermission } from "@/lib/api/authz";
import { apiError, apiOk } from "@/lib/api/response";
import { auth } from "@/lib/auth/web/auth";

type SessionUserLike = {
  id?: string;
  role?: string;
};

export async function PATCH(
  request: Request,
  context: { params: Promise<unknown> },
) {
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
    const params = (await context.params) as { id?: string };
    const id = params.id;
    if (!id) {
      return apiError("ID follow-up tidak valid", 400, "VALIDATION_ERROR");
    }

    const body = (await request.json().catch(() => null)) as {
      note?: string | null;
      deadline?: string | null;
      markDone?: boolean;
      assigneeUserId?: string | null;
    } | null;
    const canManageAnyAssignee =
      sessionUser.role === "admin" || sessionUser.role === "super_admin";

    if (
      body &&
      ("note" in body || "deadline" in body || "assigneeUserId" in body)
    ) {
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

      if (
        "assigneeUserId" in body &&
        body.assigneeUserId !== undefined &&
        !canManageAnyAssignee
      ) {
        return apiError(
          "Hanya admin yang dapat melakukan reassign follow-up",
          403,
          "FORBIDDEN",
        );
      }

      await updateAttendanceRiskFollowUp(
        id,
        sessionUser.id,
        {
          note: body.note,
          deadline: body.deadline,
          isRead: body.markDone === true ? true : undefined,
          assigneeUserId: body.assigneeUserId,
        },
        { allowAnyAssignee: canManageAnyAssignee },
      );
      return apiOk({ success: true });
    }

    await markAttendanceRiskNotificationRead(id, sessionUser.id, {
      allowAnyAssignee: canManageAnyAssignee,
    });
    return apiOk({ success: true });
  } catch (error) {
    return apiError(
      error instanceof Error ? error.message : "Gagal menandai follow-up",
      400,
      "VALIDATION_ERROR",
    );
  }
}
