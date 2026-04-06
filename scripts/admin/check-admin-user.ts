import { eq } from "drizzle-orm";
import { getDatabase } from "@/core/db/connection";
import { users } from "@/core/db/schema";

async function main() {
  const db = await getDatabase({ seedData: false });
  const result = await db
    .select({
      id: users.id,
      email: users.email,
      role: users.role,
      isActive: users.isActive,
      hasPassword: users.passwordHash,
      syncStatus: users.syncStatus,
    })
    .from(users)
    .where(eq(users.email, "admin@educore.school"))
    .limit(1);

  if (result.length === 0) {
    console.log("Admin user not found");
    return;
  }

  const admin = result[0];
  console.log(
    JSON.stringify(
      {
        id: admin.id,
        email: admin.email,
        role: admin.role,
        isActive: admin.isActive,
        hasPassword: Boolean(admin.hasPassword),
        syncStatus: admin.syncStatus,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error("Failed to inspect admin user:", error);
  process.exitCode = 1;
});
