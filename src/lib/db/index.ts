import Database from "@tauri-apps/plugin-sql";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import { count } from "drizzle-orm";
import { users } from "./schema";
// 👇 KITA IMPORT FUNGSI HASH ASLI DARI FILE YANG KAMU KIRIM TADI
import { hashPassword } from "../auth/hash"; 

// Ganti nama DB ke v2 untuk memaksa reset ulang (karena data v1 hash-nya rusak)
const DB_FILENAME = "educore_v2.db"; 

let _dbPromise: Promise<any> | null = null;

export const getDb = async () => {
  if (_dbPromise) return _dbPromise;

  _dbPromise = (async () => {
    try {
      const sqlite = await Database.load(`sqlite:${DB_FILENAME}`);

      const db = drizzle(async (sql, params, method) => {
        try {
          const rows = await sqlite.select<any[]>(sql, params);
          if (method === "run") {
            const result = await sqlite.execute(sql, params);
            return {
              rows: [],
              rowsAffected: result.rowsAffected,
              insertId: result.lastInsertId,
            };
          }
          const formattedRows = rows.map((row) => Object.values(row));
          return { rows: formattedRows };
        } catch (e: any) {
          console.error("SQL Error:", e);
          throw e;
        }
      }, { schema: await import("./schema") });

      await initTables(sqlite);
      await seedDatabase(db); // <-- Seeding akan dijalankan di sini

      return db;
    } catch (error) {
      console.error("❌ Failed to connect/seed DB:", error);
      _dbPromise = null;
      throw error;
    }
  })();

  return _dbPromise;
};

async function initTables(sqlite: Database) {
  console.log("⚙️ Verifying Database Schema...");

  // USERS
  await sqlite.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id text PRIMARY KEY NOT NULL,
      full_name text NOT NULL,
      email text NOT NULL UNIQUE,
      role text DEFAULT 'teacher' NOT NULL,
      password_hash text,
      created_at integer NOT NULL DEFAULT (strftime('%s', 'now')),
      updated_at integer NOT NULL DEFAULT (strftime('%s', 'now')),
      deleted_at integer,
      sync_status text DEFAULT 'pending' NOT NULL
    );
  `);

  // STUDENTS
  await sqlite.execute(`
    CREATE TABLE IF NOT EXISTS students (
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
    );
  `);

  // CLASSES
  await sqlite.execute(`
    CREATE TABLE IF NOT EXISTS classes (
      id text PRIMARY KEY NOT NULL,
      name text NOT NULL,
      academic_year text NOT NULL,
      homeroom_teacher_id text REFERENCES users(id),
      created_at integer NOT NULL DEFAULT (strftime('%s', 'now')),
      updated_at integer NOT NULL DEFAULT (strftime('%s', 'now')),
      deleted_at integer,
      sync_status text DEFAULT 'pending' NOT NULL
    );
  `);

  // SUBJECTS
  await sqlite.execute(`
    CREATE TABLE IF NOT EXISTS subjects (
      id text PRIMARY KEY NOT NULL,
      name text NOT NULL,
      code text NOT NULL UNIQUE,
      created_at integer NOT NULL DEFAULT (strftime('%s', 'now')),
      updated_at integer NOT NULL DEFAULT (strftime('%s', 'now')),
      deleted_at integer,
      sync_status text DEFAULT 'pending' NOT NULL
    );
  `);

  // SCHEDULE
  await sqlite.execute(`
    CREATE TABLE IF NOT EXISTS schedule (
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
    );
  `);

  // ATTENDANCE
  await sqlite.execute(`
    CREATE TABLE IF NOT EXISTS attendance (
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
    );
  `);

  console.log("✅ Schema Verified.");
}

// 👇 INI BAGIAN UTAMA PERBAIKANNYA
async function seedDatabase(db: any) {
  try {
    const result = await db.select({ count: count() }).from(users);
    const userCount = result[0]?.count || 0;

    if (userCount === 0) {
      console.log("🌱 Seeding Super Admin...");
      
      // ✅ Generate Hash ASLI menggunakan fungsi dari hash.ts
      const adminPasswordHash = await hashPassword("admin123"); 
      
      await db.insert(users).values({
        id: crypto.randomUUID(), 
        fullName: "Super Admin",
        email: "admin@educore.school",
        role: "admin",
        passwordHash: adminPasswordHash, // Hash valid
        syncStatus: "pending",
        createdAt: new Date(),
        updatedAt: new Date()
      });
      console.log("✅ Super Admin created (with valid bcrypt hash)!");
    }
  } catch (e) {
    console.error("Seed error:", e);
  }
}