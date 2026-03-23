import { requirePermission } from "@/lib/api/authz";
import { apiOk } from "@/lib/api/response";
import { auth } from "@/lib/auth/web/auth";

export async function POST() {
  const session = await auth();
  const guard = requirePermission(session, "settings:manage");
  if (guard) {
    return guard;
  }

  return apiOk({
    status: "success",
    message: "Web version is always live-to-cloud.",
  });
}
