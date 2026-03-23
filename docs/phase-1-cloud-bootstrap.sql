-- Phase 1 Cloud Bootstrap / Repair (SQLite/libSQL/Turso)
-- Gunakan di SQL editor Turso untuk memastikan tabel inti phase-1 tersedia.
-- Aman dijalankan berulang (CREATE IF NOT EXISTS).

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS "users" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "full_name" TEXT NOT NULL,
  "email" TEXT NOT NULL UNIQUE,
  "role" TEXT NOT NULL,
  "password_hash" TEXT,
  "is_active" INTEGER NOT NULL DEFAULT 1,
  "version" INTEGER NOT NULL DEFAULT 1,
  "hlc" TEXT,
  "created_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  "updated_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  "deleted_at" INTEGER,
  "sync_status" TEXT NOT NULL DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS "classes" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "name" TEXT NOT NULL,
  "academic_year" TEXT NOT NULL,
  "homeroom_teacher_id" TEXT,
  "is_active" INTEGER NOT NULL DEFAULT 1,
  "version" INTEGER NOT NULL DEFAULT 1,
  "hlc" TEXT,
  "created_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  "updated_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  "deleted_at" INTEGER,
  "sync_status" TEXT NOT NULL DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS "subjects" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT NOT NULL UNIQUE,
  "description" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "hlc" TEXT,
  "created_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  "updated_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  "deleted_at" INTEGER,
  "sync_status" TEXT NOT NULL DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS "students" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "nis" TEXT NOT NULL UNIQUE,
  "full_name" TEXT NOT NULL,
  "gender" TEXT NOT NULL,
  "grade" TEXT NOT NULL,
  "nisn" TEXT,
  "tempat_lahir" TEXT,
  "tanggal_lahir" INTEGER,
  "alamat" TEXT,
  "parent_name" TEXT,
  "parent_phone" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "hlc" TEXT,
  "created_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  "updated_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  "deleted_at" INTEGER,
  "sync_status" TEXT NOT NULL DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS "attendance" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "student_id" TEXT NOT NULL,
  "class_id" TEXT NOT NULL,
  "date" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "notes" TEXT,
  "recorded_by" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "hlc" TEXT,
  "created_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  "updated_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  "deleted_at" INTEGER,
  "sync_status" TEXT NOT NULL DEFAULT 'pending',
  FOREIGN KEY ("student_id") REFERENCES "students"("id"),
  FOREIGN KEY ("class_id") REFERENCES "classes"("id")
);

CREATE TABLE IF NOT EXISTS "attendance_settings" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "day_of_week" INTEGER NOT NULL,
  "start_time" TEXT NOT NULL,
  "end_time" TEXT NOT NULL,
  "late_threshold" TEXT NOT NULL,
  "entity_type" TEXT NOT NULL,
  "is_active" INTEGER NOT NULL DEFAULT 1,
  "version" INTEGER NOT NULL DEFAULT 1,
  "hlc" TEXT,
  "created_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  "updated_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  "deleted_at" INTEGER,
  "sync_status" TEXT NOT NULL DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS "holidays" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "date" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "hlc" TEXT,
  "created_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  "updated_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  "deleted_at" INTEGER,
  "sync_status" TEXT NOT NULL DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS "student_daily_attendance" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "student_id" TEXT NOT NULL,
  "snapshot_student_name" TEXT,
  "snapshot_student_nis" TEXT,
  "date" TEXT NOT NULL,
  "check_in_time" INTEGER,
  "check_out_time" INTEGER,
  "status" TEXT NOT NULL DEFAULT 'PRESENT',
  "late_duration" INTEGER NOT NULL DEFAULT 0,
  "version" INTEGER NOT NULL DEFAULT 1,
  "hlc" TEXT,
  "created_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  "updated_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  "deleted_at" INTEGER,
  "sync_status" TEXT NOT NULL DEFAULT 'pending',
  FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "sda_date_idx" ON "student_daily_attendance" ("date");
CREATE INDEX IF NOT EXISTS "sda_student_idx" ON "student_daily_attendance" ("student_id");
CREATE UNIQUE INDEX IF NOT EXISTS "unique_daily_student_attendance"
  ON "student_daily_attendance" ("student_id", "date");

CREATE TABLE IF NOT EXISTS "roles" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "name" TEXT NOT NULL UNIQUE,
  "description" TEXT,
  "version" INTEGER NOT NULL DEFAULT 1,
  "hlc" TEXT,
  "created_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  "updated_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  "deleted_at" INTEGER,
  "sync_status" TEXT NOT NULL DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS "permissions" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "name" TEXT NOT NULL UNIQUE,
  "resource" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "hlc" TEXT,
  "created_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  "updated_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  "deleted_at" INTEGER,
  "sync_status" TEXT NOT NULL DEFAULT 'pending'
);

CREATE TABLE IF NOT EXISTS "user_roles" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "user_id" TEXT NOT NULL,
  "role_id" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "hlc" TEXT,
  "created_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  "updated_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  "deleted_at" INTEGER,
  "sync_status" TEXT NOT NULL DEFAULT 'pending',
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE,
  FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "role_permissions" (
  "id" TEXT PRIMARY KEY NOT NULL,
  "role_id" TEXT NOT NULL,
  "permission_id" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "hlc" TEXT,
  "created_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  "updated_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
  "deleted_at" INTEGER,
  "sync_status" TEXT NOT NULL DEFAULT 'pending',
  FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE CASCADE,
  FOREIGN KEY ("permission_id") REFERENCES "permissions"("id") ON DELETE CASCADE
);
