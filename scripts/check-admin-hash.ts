import { eq } from "drizzle-orm";
import { getDatabase } from "@/core/db/connection";
import { users } from "@/core/db/schema";

async function main() {
  const db = await getDatabase({ seedData: false });
  const result = await db
    .select({
      email: users.email,
      passwordHash: users.passwordHash,
    })
    .from(users)
    .where(eq(users.email, "admin@educore.school"))
    .limit(1);

  if (result.length === 0) {
    console.log("Admin email not found");
    return;
  }

  console.log(result[0].passwordHash ?? "Password hash is empty");
}

main().catch((error) => {
  console.error("Failed to inspect admin hash:", error);
  process.exitCode = 1;
});
