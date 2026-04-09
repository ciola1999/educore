import { requirePermission } from "@/lib/api/authz";
import { apiError, apiOk } from "@/lib/api/response";
import {
  getAuthorizedAttendanceClasses,
  resolveAttendanceAccessScope,
} from "@/lib/auth/attendance-access";
import { auth } from "@/lib/auth/web/auth";
import { dedupeCanonicalClassOptions } from "@/lib/utils/class-name";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  const guard = requirePermission(session, "attendance:read");
  if (guard) {
    return guard;
  }

  const [{ getDb }] = await Promise.all([import("@/lib/db")]);
  const db = await getDb();
  const scope = await resolveAttendanceAccessScope(db, session?.user);
  if (!scope || !scope.hasRosterAccess) {
    return apiError("Forbidden", 403, "FORBIDDEN");
  }

  const data = await getAuthorizedAttendanceClasses(db, scope);

  return apiOk(dedupeCanonicalClassOptions(data));
}
