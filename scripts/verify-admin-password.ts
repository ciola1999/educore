import { verifyPassword } from "@/lib/auth/hash";
import { createAuthDbClient } from "@/lib/auth/web/db";

async function main() {
  const email = (process.argv[2] || "admin@educore.school").toLowerCase();
  const plainPassword = process.argv[3] || "admin123";

  const client = createAuthDbClient();
  const result = await client.execute({
    sql: "SELECT email, password_hash FROM users WHERE lower(email)=lower(?) LIMIT 1",
    args: [email],
  });

  const row = result.rows[0] as
    | {
        email?: string;
        password_hash?: string;
      }
    | undefined;

  if (!row?.email) {
    console.log(`❌ User ${email} tidak ditemukan.`);
    return;
  }

  const hash = row.password_hash || "";
  const isValid = await verifyPassword(plainPassword, hash);

  console.log(
    JSON.stringify(
      {
        email: row.email,
        verifyPassword: isValid,
        hashPrefix: hash.slice(0, 24),
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error("❌ Gagal verifikasi password admin:", error);
  process.exitCode = 1;
});
