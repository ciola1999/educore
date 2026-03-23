import { isNull } from "drizzle-orm";
import { requirePermission } from "@/lib/api/authz";
import { apiOk } from "@/lib/api/response";
import { auth } from "@/lib/auth/web/auth";
import { getDb } from "@/lib/db";
import { classes } from "@/lib/db/schema";

export async function GET() {
  const session = await auth();
  const guard = requirePermission(session, "attendance:read");
  if (guard) {
    return guard;
  }

  const db = await getDb();
  const data = await db
    .select({ id: classes.id, name: classes.name })
    .from(classes)
    .where(isNull(classes.deletedAt));

  return apiOk(data);
}
