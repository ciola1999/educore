import { and, count, inArray, isNull, sql } from "drizzle-orm";
import { getDb } from "../src/lib/db";
import { classes, guruMapel, students, users } from "../src/lib/db/schema";
import { ensureDefaultAttendanceSettings } from "../src/lib/services/student-projection";

const DEFAULT_PRESERVED_EMAILS = [
  "admin@educore.school",
  "guru@educore.school",
  "staff@educore.school",
] as const;

function getArg(flag: string): string | undefined {
  const directMatch = process.argv.find((arg) => arg.startsWith(`${flag}=`));
  if (directMatch) {
    return directMatch.slice(flag.length + 1);
  }

  const flagIndex = process.argv.indexOf(flag);
  if (flagIndex >= 0) {
    return process.argv[flagIndex + 1];
  }

  return undefined;
}

function parsePreservedEmails(): string[] {
  const fromArgs = getArg("--preserve");
  const raw = fromArgs?.trim();
  if (!raw) {
    return [...DEFAULT_PRESERVED_EMAILS];
  }

  const parsed = raw
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  return parsed.length > 0 ? parsed : [...DEFAULT_PRESERVED_EMAILS];
}

async function execDelete(
  db: Awaited<ReturnType<typeof getDb>>,
  statement: ReturnType<typeof sql>,
) {
  const result = (await db.run(statement)) as {
    rowsAffected?: number;
  };

  return Number(result.rowsAffected ?? 0);
}

async function resetDummyData() {
  const preservedEmails = parsePreservedEmails();
  const db = await getDb();

  console.log("🧹 [ResetDummy] Starting dummy data reset...");
  console.log(
    `ℹ️ [ResetDummy] Preserving core accounts: ${preservedEmails.join(", ")}`,
  );

  const preservedUsers = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(and(inArray(users.email, preservedEmails), isNull(users.deletedAt)));

  const preservedUserIds = preservedUsers.map((row) => row.id);

  if (preservedUserIds.length === 0) {
    throw new Error(
      "Tidak menemukan akun preserve inti. Batalkan reset supaya tidak mengunci akses login.",
    );
  }

  console.log(
    `ℹ️ [ResetDummy] Found ${preservedUserIds.length} preserved account(s).`,
  );

  const preservedUserIdValues = sql.join(
    preservedUserIds.map((id) => sql`${id}`),
    sql`, `,
  );

  const tablesToClearInOrder = [
    "transaksi_stok",
    "peminjaman_aset",
    "aset",
    "stok_barang",
    "kategori_inventaris",
    "gaji_pegawai",
    "cuti",
    "pegawai",
    "peminjaman_buku",
    "anggota_perpustakaan",
    "buku",
    "pesan",
    "peserta_percakapan",
    "percakapan",
    "notifikasi",
    "pengumuman",
    "pembayaran",
    "tagihan",
    "kategori_biaya",
    "raport",
    "nilai",
    "absensi_scan_logs",
    "absensi",
    "student_id_cards",
    "student_daily_attendance",
    "attendance",
    "holidays",
    "attendance_settings",
    "jadwal",
    "guru_mapel",
    "semester",
    "tahun_ajaran",
    "subjects",
    "classes",
    "students",
  ] as const;

  const deletedSummary: Array<{ table: string; deleted: number }> = [];

  for (const table of tablesToClearInOrder) {
    const deleted = await execDelete(db, sql.raw(`DELETE FROM "${table}"`));
    deletedSummary.push({ table, deleted });
  }

  const deletedConversations = await execDelete(
    db,
    sql`DELETE FROM user_roles WHERE user_id NOT IN (${preservedUserIdValues})`,
  );
  deletedSummary.push({ table: "user_roles", deleted: deletedConversations });

  const deletedUsers = await execDelete(
    db,
    sql`DELETE FROM users WHERE id NOT IN (${preservedUserIdValues})`,
  );
  deletedSummary.push({ table: "users", deleted: deletedUsers });

  const settingsSeeded = await ensureDefaultAttendanceSettings();

  console.log("✅ [ResetDummy] Dummy data reset complete.");
  for (const item of deletedSummary) {
    if (item.deleted > 0) {
      console.log(`  - ${item.table}: ${item.deleted} row(s) deleted`);
    }
  }

  console.log(
    `ℹ️ [ResetDummy] Default attendance settings ensured: ${settingsSeeded}`,
  );

  const [{ total: remainingUsers }] = await db
    .select({ total: count() })
    .from(users);
  const [{ total: remainingStudents }] = await db
    .select({ total: count() })
    .from(students);
  const [{ total: remainingAssignments }] = await db
    .select({ total: count() })
    .from(guruMapel);
  const [{ total: remainingClasses }] = await db
    .select({ total: count() })
    .from(classes);

  console.log("📊 [ResetDummy] Remaining snapshot:");
  console.log(`  - users: ${remainingUsers}`);
  console.log(`  - students: ${remainingStudents}`);
  console.log(`  - classes: ${remainingClasses}`);
  console.log(`  - guru_mapel: ${remainingAssignments}`);
}

resetDummyData().catch((error) => {
  console.error("❌ [ResetDummy] Failed to reset dummy data.", error);
  process.exitCode = 1;
});
