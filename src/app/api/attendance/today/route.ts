import { getTodayAttendanceRecords } from "@/core/services/attendance-service";
import { requirePermission } from "@/lib/api/authz";
import { apiOk } from "@/lib/api/response";
import { auth } from "@/lib/auth/web/auth";

type SessionUserLike = {
  id?: string;
  role?: string;
};

export async function GET() {
  const session = await auth();
  const guard = requirePermission(session, "attendance:read");
  if (guard) {
    return guard;
  }

  const sessionUser = session?.user as SessionUserLike | undefined;
  const records = await getTodayAttendanceRecords();
  const scopedRecords =
    sessionUser?.role === "student" && sessionUser.id
      ? records.filter((record) => record.studentId === sessionUser.id)
      : records;
  return apiOk(scopedRecords);
}
