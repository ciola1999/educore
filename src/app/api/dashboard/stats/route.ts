import { requireRole } from "@/lib/api/authz";
import { apiOk } from "@/lib/api/response";
import { auth } from "@/lib/auth/web/auth";

export const dynamic = "force-dynamic";

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

  const { getDashboardStats } = await import("@/lib/services/dashboard");
  const stats = await getDashboardStats();
  return apiOk(stats);
}
