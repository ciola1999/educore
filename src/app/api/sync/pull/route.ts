import { requirePermission } from "@/lib/api/authz";
import { apiOk } from "@/lib/api/response";
import { auth } from "@/lib/auth/web/auth";

export const dynamic = "force-dynamic";

function isDesktopEmbeddedServerRuntime() {
  return process.env.EDUCORE_DESKTOP_RUNTIME === "embedded-local-web-server";
}

export async function POST() {
  const session = await auth();
  const guard = requirePermission(session, "settings:manage");
  if (guard) {
    return guard;
  }

  if (isDesktopEmbeddedServerRuntime()) {
    const { pullFromCloud } = await import("@/lib/sync/turso-sync");
    return apiOk(await pullFromCloud());
  }

  return apiOk({
    status: "success",
    message: "Web version is always live-to-cloud.",
  });
}
