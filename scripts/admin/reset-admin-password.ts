import { hashPassword } from "@/lib/auth/hash";
import { createAuthDbClient } from "@/lib/auth/web/db";

function getArg(name: string, fallback: string): string {
  const prefixed = `${name}=`;
  const match = process.argv.find((arg) => arg.startsWith(prefixed));
  if (!match) {
    return fallback;
  }

  const value = match.slice(prefixed.length).trim();
  return value || fallback;
}

async function main() {
  const email = getArg("--email", "admin@educore.school").toLowerCase();
  const password = getArg("--password", "admin123");

  if (password.length < 8) {
    throw new Error("Password minimal 8 karakter.");
  }

  const client = createAuthDbClient();
  const passwordHash = await hashPassword(password);

  const updateResult = await client.execute({
    sql: `UPDATE users
          SET password_hash = ?, updated_at = CAST(strftime('%s', 'now') AS INTEGER), sync_status = 'pending'
          WHERE lower(email) = lower(?)`,
    args: [passwordHash, email],
  });

  if (!updateResult.rowsAffected) {
    throw new Error(`User dengan email ${email} tidak ditemukan.`);
  }

  // Clear all login lockout buckets so local E2E can retry immediately.
  await client.execute({
    sql: `DELETE FROM auth_rate_limits
          WHERE scope IN ('login:email', 'login:ip')`,
  });

  console.log(
    `✅ Password untuk ${email} berhasil direset dan rate-limit login dibersihkan.`,
  );
}

main().catch((error) => {
  console.error("❌ Gagal reset password admin:", error);
  process.exitCode = 1;
});
