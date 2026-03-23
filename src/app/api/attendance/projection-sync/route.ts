import { requireAnyPermission } from "@/lib/api/authz";
import { apiOk } from "@/lib/api/response";
import { auth } from "@/lib/auth/web/auth";
import { syncUsersToStudentsProjection } from "@/lib/services/student-projection";

export async function POST() {
  const session = await auth();
  const guard = requireAnyPermission(session, [
    "attendance:write",
    "academic:write",
  ]);
  if (guard) {
    return guard;
  }

  const result = await syncUsersToStudentsProjection();
  return apiOk(result);
}
