import { requireRole } from "@/lib/api/authz";
import { apiOk } from "@/lib/api/response";
import { auth } from "@/lib/auth/web/auth";
import { getDashboardStats } from "@/lib/services/dashboard";

export async function GET() {
  const session = await auth();
  const guard = requireRole(session, [
    "admin",
    "super_admin",
    "teacher",
    "staff",
  ]);

  if (guard) {
    return guard;
  }

  const stats = await getDashboardStats();
  return apiOk(stats);
}
