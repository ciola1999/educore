import { requirePermission } from "@/lib/api/authz";
import { apiOk } from "@/lib/api/response";
import { auth } from "@/lib/auth/web/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  const guard = requirePermission(session, "attendance:read");
  if (guard) {
    return guard;
  }

  const [{ isNull }, { getDb }, { classes }] = await Promise.all([
    import("drizzle-orm"),
    import("@/lib/db"),
    import("@/lib/db/schema"),
  ]);
  const db = await getDb();
  const data = await db
    .select({ id: classes.id, name: classes.name })
    .from(classes)
    .where(isNull(classes.deletedAt));

  return apiOk(data);
}
