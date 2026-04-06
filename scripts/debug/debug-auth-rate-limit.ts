import { createAuthDbClient } from "@/lib/auth/web/db";

async function main() {
  const client = createAuthDbClient();
  const result = await client.execute({
    sql: `SELECT scope, key, attempts, first_attempt_at, blocked_until, updated_at
          FROM auth_rate_limits
          WHERE scope IN ('login:email', 'login:ip')
          ORDER BY updated_at DESC
          LIMIT 20`,
  });

  console.log(JSON.stringify(result.rows, null, 2));
}

main().catch((error) => {
  console.error("debug-auth-rate-limit failed:", error);
  process.exit(1);
});
