import Database from "@tauri-apps/plugin-sql";
import { count } from "drizzle-orm";
import { drizzle } from "drizzle-orm/sqlite-proxy";

import { hashPassword } from "@/lib/auth/hash";
import * as schema from "@/lib/db/schema";
import { users } from "@/lib/db/schema";

// 📦 CONFIGURATION
// Menggunakan V3 untuk memastikan fresh start (Clean Slate Architecture)
const DB_FILENAME = "educore_v3.db";

// Singleton Pattern untuk koneksi database
let _dbPromise: Promise<ReturnType<typeof drizzle<typeof schema>>> | null =
	null;

export const getDb = async () => {
	if (_dbPromise) return _dbPromise;

	_dbPromise = (async () => {
		try {
			// 1. Load Driver Tauri
			const sqlite = await Database.load(`sqlite:${DB_FILENAME}`);

			// 2. Init Drizzle Proxy
			const db = drizzle(
				async (sql, params, method) => {
					try {
						const rows = await sqlite.select<any[]>(sql, params);

						if (method === "run") {
							const result = await sqlite.execute(sql, params);

							// Gunakan 'any' untuk memintas pengecekan tipe sementara,
							// karena kita tahu properti aslinya bernama 'changes'
							const rawResult = result as any;

							return {
								rows: [],
								// Ganti .rowsAffected -> .changes
								rowsAffected: rawResult.changes ?? rawResult.rowsAffected ?? 0,
								// Ganti .lastInsertId -> .lastInsertRowid
								insertId:
									rawResult.lastInsertRowid ?? rawResult.lastInsertId ?? 0,
							};
						}
						// Normalize rows for Drizzle
						const formattedRows = rows.map((row) => Object.values(row));
						return { rows: formattedRows };
					} catch (e) {
						console.error("[SQL_ERROR]", e);
						throw e;
					}
				},
				{ schema },
			);

			// 3. Migration & Seeding Strategy
			await initTables(sqlite);
			await seedDatabase(db);

			return db;
		} catch (error) {
			console.error("❌ [DB_FATAL] Failed to connect/seed DB:", error);
			_dbPromise = null;
			throw error;
		}
	})();

	return _dbPromise;
};

// 🛠️ INTERNAL MIGRATIONS
// Manual SQL digunakan karena Tauri environment belum support full Drizzle Kit migration runtime.
async function initTables(sqlite: Database) {
	console.info("⚙️ [SYSTEM] Verifying Database Schema...");

	const tables = [
		// 1. USERS
		`CREATE TABLE IF NOT EXISTS users (
      id text PRIMARY KEY NOT NULL,
      full_name text NOT NULL,
      email text NOT NULL UNIQUE,
      role text DEFAULT 'teacher' NOT NULL,
      password_hash text,
      created_at integer NOT NULL DEFAULT (strftime('%s', 'now')),
      updated_at integer NOT NULL DEFAULT (strftime('%s', 'now')),
      deleted_at integer,
      sync_status text DEFAULT 'pending' NOT NULL
    );`,

		// 2. STUDENTS
		`CREATE TABLE IF NOT EXISTS students (
      id text PRIMARY KEY NOT NULL,
      nis text NOT NULL UNIQUE,
      full_name text NOT NULL,
      gender text NOT NULL,
      grade text NOT NULL,
      parent_name text,
      parent_phone text,
      created_at integer NOT NULL DEFAULT (strftime('%s', 'now')),
      updated_at integer NOT NULL DEFAULT (strftime('%s', 'now')),
      deleted_at integer,
      sync_status text DEFAULT 'pending' NOT NULL
    );`,

		// 3. CLASSES
		`CREATE TABLE IF NOT EXISTS classes (
      id text PRIMARY KEY NOT NULL,
      name text NOT NULL,
      academic_year text NOT NULL,
      homeroom_teacher_id text REFERENCES users(id),
      created_at integer NOT NULL DEFAULT (strftime('%s', 'now')),
      updated_at integer NOT NULL DEFAULT (strftime('%s', 'now')),
      deleted_at integer,
      sync_status text DEFAULT 'pending' NOT NULL
    );`,

		// 4. SUBJECTS
		`CREATE TABLE IF NOT EXISTS subjects (
      id text PRIMARY KEY NOT NULL,
      name text NOT NULL,
      code text NOT NULL UNIQUE,
      created_at integer NOT NULL DEFAULT (strftime('%s', 'now')),
      updated_at integer NOT NULL DEFAULT (strftime('%s', 'now')),
      deleted_at integer,
      sync_status text DEFAULT 'pending' NOT NULL
    );`,

		// 5. SCHEDULE
		`CREATE TABLE IF NOT EXISTS schedule (
      id text PRIMARY KEY NOT NULL,
      class_id text NOT NULL REFERENCES classes(id),
      subject_id text NOT NULL REFERENCES subjects(id),
      teacher_id text NOT NULL REFERENCES users(id),
      day_of_week integer NOT NULL,
      start_time text NOT NULL,
      end_time text NOT NULL,
      created_at integer NOT NULL DEFAULT (strftime('%s', 'now')),
      updated_at integer NOT NULL DEFAULT (strftime('%s', 'now')),
      deleted_at integer,
      sync_status text DEFAULT 'pending' NOT NULL
    );`,

		// 6. ATTENDANCE (Jurnal Kelas)
		`CREATE TABLE IF NOT EXISTS attendance (
      id text PRIMARY KEY NOT NULL,
      student_id text NOT NULL REFERENCES students(id),
      class_id text NOT NULL REFERENCES classes(id),
      date text NOT NULL,
      status text NOT NULL,
      notes text,
      recorded_by text NOT NULL,
      created_at integer NOT NULL DEFAULT (strftime('%s', 'now')),
      updated_at integer NOT NULL DEFAULT (strftime('%s', 'now')),
      deleted_at integer,
      sync_status text DEFAULT 'pending' NOT NULL
    );`,

		// 7. ATTENDANCE_SETTINGS
		`CREATE TABLE IF NOT EXISTS attendance_settings (
      id text PRIMARY KEY NOT NULL,
      day_of_week integer NOT NULL,
      start_time text NOT NULL,
      end_time text NOT NULL,
      late_threshold text NOT NULL,
      entity_type text NOT NULL,
      is_active integer DEFAULT 1 NOT NULL,
      created_at integer NOT NULL DEFAULT (strftime('%s', 'now')),
      updated_at integer NOT NULL DEFAULT (strftime('%s', 'now')),
      deleted_at integer,
      sync_status text DEFAULT 'pending' NOT NULL
    );`,

		// 8. HOLIDAYS
		`CREATE TABLE IF NOT EXISTS holidays (
      id text PRIMARY KEY NOT NULL,
      date text NOT NULL,
      name text NOT NULL,
      created_at integer NOT NULL DEFAULT (strftime('%s', 'now')),
      updated_at integer NOT NULL DEFAULT (strftime('%s', 'now')),
      deleted_at integer,
      sync_status text DEFAULT 'pending' NOT NULL
    );`,

		// 9. STUDENT DAILY ATTENDANCE (Schema V3)
		`CREATE TABLE IF NOT EXISTS student_daily_attendance (
      id text PRIMARY KEY NOT NULL,
      student_id text NOT NULL REFERENCES students(id),
      snapshot_student_name text,
      snapshot_student_nis text,
      date text NOT NULL,
      check_in_time integer,
      check_out_time integer,
      status text DEFAULT 'PRESENT' NOT NULL,
      late_duration integer DEFAULT 0,
      created_at integer NOT NULL DEFAULT (strftime('%s', 'now')),
      updated_at integer NOT NULL DEFAULT (strftime('%s', 'now')),
      deleted_at integer,
      sync_status text DEFAULT 'pending' NOT NULL
    );`,
	];

	// Eksekusi Pembuatan Tabel
	for (const query of tables) {
		await sqlite.execute(query);
	}

	// Performance Indexes
	await sqlite.execute(
		`CREATE INDEX IF NOT EXISTS sda_date_idx ON student_daily_attendance(date);`,
	);
	await sqlite.execute(
		`CREATE INDEX IF NOT EXISTS sda_student_idx ON student_daily_attendance(student_id);`,
	);
	await sqlite.execute(
		`CREATE UNIQUE INDEX IF NOT EXISTS unique_daily_student_attendance ON student_daily_attendance(student_id, date);`,
	);

	console.info("✅ [SYSTEM] Schema V3 Verified.");
}

// 🌱 SEEDER
async function seedDatabase(db: ReturnType<typeof drizzle<typeof schema>>) {
	try {
		const result = await db.select({ count: count() }).from(users);
		const userCount = result[0]?.count || 0;

		if (userCount === 0) {
			console.info("🌱 [SEED] Creating Super Admin...");
			const adminPasswordHash = await hashPassword("admin123");

			await db.insert(users).values({
				id: crypto.randomUUID(),
				fullName: "Super Admin",
				email: "admin@educore.school",
				role: "admin",
				passwordHash: adminPasswordHash,
				syncStatus: "pending",
				createdAt: new Date(),
				updatedAt: new Date(),
			});
			console.info("✅ [SEED] Super Admin Ready!");
		}
	} catch (e) {
		console.error("❌ [SEED_ERROR]", e);
	}
}
