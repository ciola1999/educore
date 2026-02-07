import Database from "@tauri-apps/plugin-sql";
import { count } from "drizzle-orm";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { hashPassword } from "../auth/hash";
import { users } from "./schema";

const DB_FILENAME = "educore.db";

let _db: any = null;

export const getDb = async () => {
	if (_db) return _db;

	try {
		// 1. Load Database
		const sqlite = await Database.load(`sqlite:${DB_FILENAME}`);

		// 2. Setup Drizzle Driver
		_db = drizzle(async (sql, params, method) => {
			try {
				const rows = await sqlite.select<any[]>(sql, params);
				const runResult = await sqlite.execute(sql, params);
				return {
					rows: rows.map((row: any) => Object.values(row)),
					rowsAffected: runResult.rowsAffected,
					insertId: runResult.lastInsertId,
				};
			} catch (e: any) {
				console.error("SQL Error:", e);
				throw e; // Biar caller (Drizzle) tahu kalau query gagal
			}
		});

		// 3. --- AUTO MIGRATION (The Fix) ---
		// Kita paksa aplikasi membuat tabel jika belum ada
		await initTables(sqlite);

		// 4. --- AUTO SEED ---
		await seedDatabase(_db);

		return _db;
	} catch (error) {
		console.error("❌ Failed to connect/seed DB:", error);
		throw error;
	}
};

// Fungsi Manual untuk membuat tabel (Raw SQL)
// Ini solusi paling robust agar Tauri tidak bingung path
async function initTables(sqlite: Database) {
	console.log("⚙️ Checking tables...");

	// Create Table: USERS
	await sqlite.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id text PRIMARY KEY NOT NULL,
        full_name text NOT NULL,
        email text NOT NULL UNIQUE,
        role text DEFAULT 'teacher' NOT NULL,
        password_hash text,
        created_at integer DEFAULT (strftime('%s', 'now')),
        updated_at integer DEFAULT (strftime('%s', 'now')),
        sync_status text DEFAULT 'pending'
      );
    `);

	// Create Table: STUDENTS
	await sqlite.execute(`
      CREATE TABLE IF NOT EXISTS students (
        id text PRIMARY KEY NOT NULL,
        nis text NOT NULL UNIQUE,
        full_name text NOT NULL,
        gender text NOT NULL,
        grade text NOT NULL,
        parent_name text,
        parent_phone text,
        created_at integer DEFAULT (strftime('%s', 'now')),
        updated_at integer DEFAULT (strftime('%s', 'now'))
      );
    `);

	// Create Table: CLASSES
	await sqlite.execute(`
      CREATE TABLE IF NOT EXISTS classes (
        id text PRIMARY KEY NOT NULL,
        name text NOT NULL,
        academic_year text NOT NULL,
        homeroom_teacher_id text REFERENCES users(id),
        updated_at integer DEFAULT (strftime('%s', 'now'))
      );
    `);

	// Create Table: SUBJECTS
	await sqlite.execute(`
      CREATE TABLE IF NOT EXISTS subjects (
        id text PRIMARY KEY NOT NULL,
        name text NOT NULL,
        code text NOT NULL UNIQUE,
        updated_at integer DEFAULT (strftime('%s', 'now'))
      );
    `);

	// Create Table: SCHEDULE
	await sqlite.execute(`
      CREATE TABLE IF NOT EXISTS schedule (
        id text PRIMARY KEY NOT NULL,
        class_id text NOT NULL REFERENCES classes(id),
        subject_id text NOT NULL REFERENCES subjects(id),
        teacher_id text NOT NULL REFERENCES users(id),
        day_of_week integer NOT NULL,
        start_time text NOT NULL,
        end_time text NOT NULL,
        updated_at integer DEFAULT (strftime('%s', 'now'))
      );
    `);

	// Create Table: ATTENDANCE
	await sqlite.execute(`
      CREATE TABLE IF NOT EXISTS attendance (
        id text PRIMARY KEY NOT NULL,
        student_id text NOT NULL REFERENCES students(id),
        class_id text NOT NULL REFERENCES classes(id),
        date text NOT NULL,
        status text NOT NULL,
        notes text,
        recorded_by text NOT NULL,
        created_at integer DEFAULT (strftime('%s', 'now')),
        sync_status text DEFAULT 'pending'
      );
    `);

	console.log("✅ Tables checked/created.");
}

async function seedDatabase(db: any) {
	try {
		const result = await db.select({ count: count() }).from(users);
		const userCount = result[0]?.count || 0;

		if (userCount === 0) {
			console.log("🌱 Database empty. Seeding Super Admin...");
			const adminHash = await hashPassword("admin123");

			await db
				.insert(users)
				.values({
					id: "admin-001",
					fullName: "Super Admin",
					email: "admin@educore.school",
					role: "admin",
					passwordHash: adminHash,
					syncStatus: "pending",
				})
				.onConflictDoNothing();
			console.log("✅ Super Admin created!");
		}
	} catch (e) {
		console.error("Seed error:", e);
	}
}
