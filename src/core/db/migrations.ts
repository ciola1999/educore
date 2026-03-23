/**
 * Interface that matches both @tauri-apps/plugin-sql and @libsql/client
 */
export interface DatabaseLike {
  select<T>(sql: string, params?: unknown[]): Promise<T[]>;
  execute(
    sql: string,
    params?: unknown[],
  ): Promise<{
    rowsAffected?: number;
    lastInsertId?: number | string;
    changes?: number;
    rows?: unknown[];
  }>;
}

const DEFAULT_ADMIN_EMAIL = "admin@educore.school";
const DEFAULT_ACTIVE_DAYS = [1, 2, 3, 4, 5] as const;
const UUID_LIKE_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface MigrationOptions {
  seedData?: boolean;
  forceResetAdmin?: boolean;
}

function parseBooleanEnv(value: string | undefined): boolean {
  if (!value) return false;

  const normalized = value.trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes";
}

function resolveMigrationOptions(
  options?: MigrationOptions,
): Required<MigrationOptions> {
  return {
    seedData: options?.seedData ?? true,
    forceResetAdmin:
      options?.forceResetAdmin ??
      parseBooleanEnv(process.env.FORCE_RESET_ADMIN),
  };
}

function getAcademicYearLabel(): string {
  const year = new Date().getFullYear();
  return `${year}/${year + 1}`;
}

function isUuidLikeClassValue(value: string | null | undefined): boolean {
  return UUID_LIKE_PATTERN.test((value || "").trim());
}

async function seedClassesFromLegacyData(db: DatabaseLike): Promise<void> {
  const classFromUsers = await db.select<{ kelas_id: string | null }>(
    `SELECT DISTINCT kelas_id
     FROM users
     WHERE deleted_at IS NULL
       AND role = 'student'
       AND kelas_id IS NOT NULL
       AND TRIM(kelas_id) != ''`,
  );

  const classFromStudents = await db.select<{ grade: string | null }>(
    `SELECT DISTINCT grade
     FROM students
     WHERE deleted_at IS NULL
       AND grade IS NOT NULL
       AND TRIM(grade) != ''`,
  );

  const classCandidates = new Set<string>();

  for (const row of classFromUsers) {
    if (row.kelas_id && !isUuidLikeClassValue(row.kelas_id)) {
      classCandidates.add(row.kelas_id.trim());
    }
  }

  for (const row of classFromStudents) {
    if (row.grade && !isUuidLikeClassValue(row.grade)) {
      classCandidates.add(row.grade.trim());
    }
  }

  if (classCandidates.size === 0) {
    return;
  }

  const now = Math.floor(Date.now() / 1000);
  const academicYear = getAcademicYearLabel();

  for (const className of classCandidates) {
    if (!className) continue;

    const existing = await db.select<{ id: string }>(
      `SELECT id
       FROM classes
       WHERE name = ? AND deleted_at IS NULL
       LIMIT 1`,
      [className],
    );

    if (existing.length > 0) {
      continue;
    }

    await db.execute(
      `INSERT INTO classes (
         id,
         name,
         academic_year,
         is_active,
         version,
         hlc,
         created_at,
         updated_at,
         deleted_at,
         sync_status
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        crypto.randomUUID(),
        className,
        academicYear,
        1,
        1,
        null,
        now,
        now,
        null,
        "pending",
      ],
    );
  }
}

async function syncStudentsFromUsers(db: DatabaseLike): Promise<void> {
  const usersData = await db.select<
    {
      id: string;
      full_name: string;
      nis: string | null;
      nisn: string | null;
      jenis_kelamin: string | null;
      tempat_lahir: string | null;
      tanggal_lahir: number | null;
      alamat: string | null;
      kelas_id: string | null;
    }[]
  >(
    `SELECT id, full_name, nis, nisn, jenis_kelamin, tempat_lahir, tanggal_lahir, alamat, kelas_id
     FROM users
     WHERE deleted_at IS NULL
       AND is_active = 1
       AND role = 'student'
       AND nis IS NOT NULL
       AND TRIM(nis) != ''`,
  );

  if (usersData.length === 0) {
    return;
  }

  const now = Math.floor(Date.now() / 1000);

  for (const row of usersData) {
    const user = row as unknown as {
      id: string;
      full_name: string;
      nis: string | null;
      nisn: string | null;
      jenis_kelamin: string | null;
      tempat_lahir: string | null;
      tanggal_lahir: number | null;
      alamat: string | null;
      kelas_id: string | null;
    };
    const nis = user.nis?.trim();
    if (!nis) continue;

    let grade = "UNASSIGNED";
    const rawClassRef = user.kelas_id?.trim();

    if (rawClassRef && !isUuidLikeClassValue(rawClassRef)) {
      const classById = await db.select<{ name: string }>(
        `SELECT name
         FROM classes
         WHERE id = ? AND deleted_at IS NULL
         LIMIT 1`,
        [rawClassRef],
      );

      grade = classById[0]?.name?.trim() || rawClassRef;
    } else if (rawClassRef) {
      const classById = await db.select<{ name: string }>(
        `SELECT name
         FROM classes
         WHERE id = ? AND deleted_at IS NULL
         LIMIT 1`,
        [rawClassRef],
      );

      const resolvedName = classById[0]?.name?.trim();
      grade =
        resolvedName && !isUuidLikeClassValue(resolvedName)
          ? resolvedName
          : "UNASSIGNED";
    }

    const gender = user.jenis_kelamin === "P" ? "P" : "L";

    const existing = await db.select<{ id: string }>(
      `SELECT id
       FROM students
       WHERE nis = ?
       LIMIT 1`,
      [nis],
    );

    if (existing.length === 0) {
      await db.execute(
        `INSERT INTO students (
           id,
           nis,
           full_name,
           gender,
           grade,
           parent_name,
           parent_phone,
           nisn,
           tempat_lahir,
           tanggal_lahir,
           alamat,
           version,
           hlc,
           created_at,
           updated_at,
           deleted_at,
           sync_status
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          user.id,
          nis,
          user.full_name,
          gender,
          grade,
          null,
          null,
          user.nisn,
          user.tempat_lahir,
          user.tanggal_lahir,
          user.alamat,
          1,
          null,
          now,
          now,
          null,
          "pending",
        ],
      );
      continue;
    }

    await db.execute(
      `UPDATE students
       SET full_name = ?,
           gender = ?,
           grade = ?,
           nisn = ?,
           tempat_lahir = ?,
           tanggal_lahir = ?,
           alamat = ?,
           deleted_at = NULL,
           updated_at = ?,
           sync_status = 'pending'
       WHERE nis = ?`,
      [
        user.full_name,
        gender,
        grade,
        user.nisn,
        user.tempat_lahir,
        user.tanggal_lahir,
        user.alamat,
        now,
        nis,
      ],
    );
  }
}

async function seedDefaultAttendanceSettings(db: DatabaseLike): Promise<void> {
  const existing = await db.select<{ total: number }>(
    `SELECT COUNT(*) AS total
     FROM attendance_settings
     WHERE deleted_at IS NULL
       AND entity_type = 'student'`,
  );

  if ((existing[0]?.total ?? 0) > 0) {
    return;
  }

  const now = Math.floor(Date.now() / 1000);

  for (const dayOfWeek of DEFAULT_ACTIVE_DAYS) {
    await db.execute(
      `INSERT INTO attendance_settings (
         id,
         day_of_week,
         start_time,
         end_time,
         late_threshold,
         entity_type,
         is_active,
         version,
         hlc,
         created_at,
         updated_at,
         deleted_at,
         sync_status
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        crypto.randomUUID(),
        dayOfWeek,
        "07:00",
        "15:00",
        "07:15",
        "student",
        1,
        1,
        null,
        now,
        now,
        null,
        "pending",
      ],
    );
  }
}

async function ensureUserStudentProjectionTriggers(
  db: DatabaseLike,
): Promise<void> {
  await db.execute(`
    CREATE TRIGGER IF NOT EXISTS users_student_projection_after_insert
    AFTER INSERT ON users
    WHEN NEW.role = 'student'
      AND NEW.deleted_at IS NULL
      AND NEW.is_active = 1
      AND NEW.nis IS NOT NULL
      AND TRIM(NEW.nis) != ''
    BEGIN
      INSERT INTO classes (
        id,
        name,
        academic_year,
        is_active,
        version,
        hlc,
        created_at,
        updated_at,
        deleted_at,
        sync_status
      )
      SELECT
        NEW.kelas_id,
        NEW.kelas_id,
        (strftime('%Y', 'now') || '/' || (CAST(strftime('%Y', 'now') AS INTEGER) + 1)),
        1,
        1,
        NULL,
        strftime('%s', 'now'),
        strftime('%s', 'now'),
        NULL,
        'pending'
      WHERE NEW.kelas_id IS NOT NULL
        AND TRIM(NEW.kelas_id) != ''
        AND NEW.kelas_id NOT GLOB '????????-????-????-????-????????????'
        AND NOT EXISTS (
          SELECT 1 FROM classes
          WHERE deleted_at IS NULL
            AND (id = NEW.kelas_id OR name = NEW.kelas_id)
          LIMIT 1
        );

      INSERT INTO students (
        id,
        nis,
        full_name,
        gender,
        grade,
        parent_name,
        parent_phone,
        nisn,
        tempat_lahir,
        tanggal_lahir,
        alamat,
        version,
        hlc,
        created_at,
        updated_at,
        deleted_at,
        sync_status
      ) VALUES (
        NEW.id,
        NEW.nis,
        NEW.full_name,
        CASE WHEN NEW.jenis_kelamin = 'P' THEN 'P' ELSE 'L' END,
        COALESCE(
          NULLIF((SELECT name FROM classes WHERE id = NEW.kelas_id AND deleted_at IS NULL LIMIT 1), NEW.kelas_id),
          'UNASSIGNED'
        ),
        NULL,
        NULL,
        NEW.nisn,
        NEW.tempat_lahir,
        NEW.tanggal_lahir,
        NEW.alamat,
        1,
        NULL,
        strftime('%s', 'now'),
        strftime('%s', 'now'),
        NULL,
        'pending'
      )
      ON CONFLICT(nis) DO UPDATE SET
        full_name = excluded.full_name,
        gender = excluded.gender,
        grade = excluded.grade,
        nisn = excluded.nisn,
        tempat_lahir = excluded.tempat_lahir,
        tanggal_lahir = excluded.tanggal_lahir,
        alamat = excluded.alamat,
        deleted_at = NULL,
        updated_at = strftime('%s', 'now'),
        sync_status = 'pending';
    END;
  `);

  await db.execute(`
    CREATE TRIGGER IF NOT EXISTS users_student_projection_after_update
    AFTER UPDATE ON users
    WHEN NEW.role = 'student'
      AND NEW.deleted_at IS NULL
      AND NEW.is_active = 1
      AND NEW.nis IS NOT NULL
      AND TRIM(NEW.nis) != ''
    BEGIN
      INSERT INTO classes (
        id,
        name,
        academic_year,
        is_active,
        version,
        hlc,
        created_at,
        updated_at,
        deleted_at,
        sync_status
      )
      SELECT
        NEW.kelas_id,
        NEW.kelas_id,
        (strftime('%Y', 'now') || '/' || (CAST(strftime('%Y', 'now') AS INTEGER) + 1)),
        1,
        1,
        NULL,
        strftime('%s', 'now'),
        strftime('%s', 'now'),
        NULL,
        'pending'
      WHERE NEW.kelas_id IS NOT NULL
        AND TRIM(NEW.kelas_id) != ''
        AND NEW.kelas_id NOT GLOB '????????-????-????-????-????????????'
        AND NOT EXISTS (
          SELECT 1 FROM classes
          WHERE deleted_at IS NULL
            AND (id = NEW.kelas_id OR name = NEW.kelas_id)
          LIMIT 1
        );

      UPDATE students
      SET nis = NEW.nis,
          full_name = NEW.full_name,
          gender = CASE WHEN NEW.jenis_kelamin = 'P' THEN 'P' ELSE 'L' END,
          grade = COALESCE(
            NULLIF((SELECT name FROM classes WHERE id = NEW.kelas_id AND deleted_at IS NULL LIMIT 1), NEW.kelas_id),
            'UNASSIGNED'
          ),
          nisn = NEW.nisn,
          tempat_lahir = NEW.tempat_lahir,
          tanggal_lahir = NEW.tanggal_lahir,
          alamat = NEW.alamat,
          deleted_at = NULL,
          updated_at = strftime('%s', 'now'),
          sync_status = 'pending'
      WHERE id = NEW.id OR nis = OLD.nis;

      INSERT INTO students (
        id,
        nis,
        full_name,
        gender,
        grade,
        parent_name,
        parent_phone,
        nisn,
        tempat_lahir,
        tanggal_lahir,
        alamat,
        version,
        hlc,
        created_at,
        updated_at,
        deleted_at,
        sync_status
      )
      SELECT
        NEW.id,
        NEW.nis,
        NEW.full_name,
        CASE WHEN NEW.jenis_kelamin = 'P' THEN 'P' ELSE 'L' END,
        COALESCE(
          NULLIF((SELECT name FROM classes WHERE id = NEW.kelas_id AND deleted_at IS NULL LIMIT 1), NEW.kelas_id),
          'UNASSIGNED'
        ),
        NULL,
        NULL,
        NEW.nisn,
        NEW.tempat_lahir,
        NEW.tanggal_lahir,
        NEW.alamat,
        1,
        NULL,
        strftime('%s', 'now'),
        strftime('%s', 'now'),
        NULL,
        'pending'
      WHERE NOT EXISTS (SELECT 1 FROM students WHERE nis = NEW.nis LIMIT 1);
    END;
  `);

  await db.execute(`
    CREATE TRIGGER IF NOT EXISTS users_student_projection_after_update_deactivate
    AFTER UPDATE ON users
    WHEN OLD.role = 'student'
      AND (
        NEW.role != 'student'
        OR NEW.deleted_at IS NOT NULL
        OR NEW.is_active = 0
      )
    BEGIN
      UPDATE students
      SET deleted_at = COALESCE(NEW.deleted_at, strftime('%s', 'now')),
          updated_at = strftime('%s', 'now'),
          sync_status = 'pending'
      WHERE id = OLD.id OR nis = OLD.nis;
    END;
  `);
}

async function seedDefaultAdmin(
  db: DatabaseLike,
  options: Required<MigrationOptions>,
): Promise<void> {
  const now = Math.floor(Date.now() / 1000);

  const existing = await db.select<Record<string, unknown>>(
    "SELECT * FROM users WHERE email = ? LIMIT 1",
    [DEFAULT_ADMIN_EMAIL],
  );

  // REPAIR MECHANISM - Force recreate admin with invalid hash format
  const admin = existing[0] as Record<string, unknown> | undefined;
  const currentHash = admin
    ? (admin.password_hash as string | undefined) ||
      (admin.passwordHash as string | undefined) ||
      null
    : null;

  // Check if hash is valid Argon2id format (must have proper structure)
  // Valid format: $argon2id$v=19$m=65536,t=3,p=4$[salt]$[hash]
  // Invalid hash has short hash part (like y6T8X/Y3G7pZ6H9W2O1V5A)
  const isValidArgon2Hash =
    typeof currentHash === "string" &&
    currentHash.startsWith("$argon2id$") &&
    currentHash.split("$").length === 6 &&
    currentHash.length > 80; // Valid hash should be ~100+ chars

  const shouldReset = options.forceResetAdmin || (admin && !isValidArgon2Hash);

  if (shouldReset) {
    if (options.forceResetAdmin && admin) {
      console.warn(
        `[Seed] 🛠️ FORCE_RESET_ADMIN enabled. Purging admin ${DEFAULT_ADMIN_EMAIL}...`,
      );
    } else if (admin) {
      console.warn(
        `[Seed] 🛠️ INVALID/BROKEN HASH DETECTED for ${DEFAULT_ADMIN_EMAIL}. Hash length: ${currentHash?.length || 0}. Purging and recreating...`,
      );
    }
    await db.execute("DELETE FROM users WHERE email = ?", [
      DEFAULT_ADMIN_EMAIL,
    ]);
    // Force existing to be empty so it falls through to the creation block
    existing.length = 0;
  } else if (admin) {
    console.info(
      `[Seed] Admin ${DEFAULT_ADMIN_EMAIL} has valid Argon2id hash (${currentHash?.length} chars).`,
    );
  }

  if (existing.length === 0) {
    console.info(
      `[Seed] 🚀 Creating fresh default admin: ${DEFAULT_ADMIN_EMAIL}`,
    );
    const passwordHash =
      "$argon2id$v=19$m=65536,t=3,p=4$9+c59FN6Z2xHL2A3jy+Egg$PN/cvonv7WS47qVhhjqsok+sFRWtDvyl4oHCgyTCVOw";
    console.info(
      `[Seed] Using password hash (len: ${passwordHash.length}): ${passwordHash.substring(0, 20)}...`,
    );
    const id = crypto.randomUUID();

    // Explicitly use snake_case since that's what's in the PRAGMA table_info
    await db.execute(
      `INSERT INTO users (id, full_name, email, role, password_hash, is_active, version, hlc, deleted_at, created_at, updated_at, sync_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        "Super Admin",
        DEFAULT_ADMIN_EMAIL,
        "admin",
        passwordHash,
        1,
        1,
        null,
        null,
        now,
        now,
        "pending",
      ],
    );
    console.info(`✅ [Seed] Default admin created successfully.`);
    return;
  }

  console.info(
    `[Seed] ✅ Admin ${DEFAULT_ADMIN_EMAIL} is healthy with valid credentials.`,
  );
}

async function seedDefaultStaffAccounts(db: DatabaseLike): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const defaultAccounts = [
    {
      fullName: "Guru Default",
      email: "guru@educore.school",
      role: "teacher",
      passwordHash:
        "$argon2id$v=19$m=19456,t=2,p=1$ABPxeDjIPpirmcvDRbiJBg$/zVBHUf8YpiWLvvbF1sNJHIKJSQOU8NmThJN040nwwE",
    },
    {
      fullName: "Staff Default",
      email: "staff@educore.school",
      role: "staff",
      passwordHash:
        "$argon2id$v=19$m=19456,t=2,p=1$aR/qtnO9mHSlo1aOT5i4tg$Abr9GfnkgVSpEtUnxEaSfA/dtS150//pwgow490RJzk",
    },
  ] as const;

  for (const account of defaultAccounts) {
    const existing = await db.select<{
      id: string;
      password_hash: string | null;
    }>("SELECT id, password_hash FROM users WHERE email = ? LIMIT 1", [
      account.email,
    ]);

    const nextHash = account.passwordHash;
    if (existing.length === 0) {
      await db.execute(
        `INSERT INTO users (id, full_name, email, role, password_hash, is_active, version, hlc, deleted_at, created_at, updated_at, sync_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          crypto.randomUUID(),
          account.fullName,
          account.email,
          account.role,
          nextHash,
          1,
          1,
          null,
          null,
          now,
          now,
          "pending",
        ],
      );
      continue;
    }

    const currentHash = existing[0]?.password_hash;
    if (!currentHash || !currentHash.startsWith("$argon2id$")) {
      await db.execute(
        `UPDATE users
         SET password_hash = ?, role = ?, is_active = 1, deleted_at = NULL, updated_at = ?, sync_status = 'pending'
         WHERE email = ?`,
        [nextHash, account.role, now, account.email],
      );
    }
  }
}

/**
 * Seed default roles and permissions for RBAC
 */
async function seedRolesAndPermissions(db: DatabaseLike): Promise<void> {
  const now = Math.floor(Date.now() / 1000);

  // Define default roles
  const defaultRoles = [
    {
      id: "role_admin",
      name: "admin",
      description: "Administrator with full access",
    },
    { id: "role_teacher", name: "teacher", description: "Teacher/Guru" },
    { id: "role_staff", name: "staff", description: "Staff/Tata Usaha" },
    { id: "role_student", name: "student", description: "Student/Siswa" },
    { id: "role_parent", name: "parent", description: "Parent/Orang Tua" },
  ];

  // Define default permissions (resource:action format)
  const defaultPermissions = [
    // User management
    {
      id: "perm_users_read",
      name: "users:read",
      resource: "users",
      action: "read",
    },
    {
      id: "perm_users_write",
      name: "users:write",
      resource: "users",
      action: "write",
    },
    {
      id: "perm_users_delete",
      name: "users:delete",
      resource: "users",
      action: "delete",
    },
    // Academic
    {
      id: "perm_academic_read",
      name: "academic:read",
      resource: "academic",
      action: "read",
    },
    {
      id: "perm_academic_write",
      name: "academic:write",
      resource: "academic",
      action: "write",
    },
    // Attendance
    {
      id: "perm_attendance_read",
      name: "attendance:read",
      resource: "attendance",
      action: "read",
    },
    {
      id: "perm_attendance_write",
      name: "attendance:write",
      resource: "attendance",
      action: "write",
    },
    // Finance
    {
      id: "perm_finance_read",
      name: "finance:read",
      resource: "finance",
      action: "read",
    },
    {
      id: "perm_finance_write",
      name: "finance:write",
      resource: "finance",
      action: "write",
    },
    // Reports
    {
      id: "perm_reports",
      name: "reports:generate",
      resource: "reports",
      action: "generate",
    },
    // Settings
    {
      id: "perm_settings",
      name: "settings:manage",
      resource: "settings",
      action: "manage",
    },
  ];

  // Seed roles
  for (const role of defaultRoles) {
    const existingRole = await db.select<{ id: string }>(
      "SELECT id FROM roles WHERE id = ?",
      [role.id],
    );

    if (existingRole.length === 0) {
      await db.execute(
        `INSERT INTO roles (id, name, description, version, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [role.id, role.name, role.description, 1, now, now, null],
      );
      console.info(`✅ [Seed] Role '${role.name}' created.`);
    }
  }

  // Seed permissions
  for (const perm of defaultPermissions) {
    const existingPerm = await db.select<{ id: string }>(
      "SELECT id FROM permissions WHERE id = ?",
      [perm.id],
    );

    if (existingPerm.length === 0) {
      await db.execute(
        `INSERT INTO permissions (id, name, resource, action, version, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [perm.id, perm.name, perm.resource, perm.action, 1, now, now, null],
      );
      console.info(`✅ [Seed] Permission '${perm.name}' created.`);
    }
  }

  // Assign all permissions to admin role
  const adminRoleId = "role_admin";
  for (const perm of defaultPermissions) {
    const existingAssignment = await db.select<{ id: string }>(
      "SELECT id FROM role_permissions WHERE role_id = ? AND permission_id = ?",
      [adminRoleId, perm.id],
    );

    if (existingAssignment.length === 0) {
      await db.execute(
        `INSERT INTO role_permissions (id, role_id, permission_id, version, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [crypto.randomUUID(), adminRoleId, perm.id, 1, now, now, null],
      );
    }
  }

  // Assign teacher permissions
  const teacherRoleId = "role_teacher";
  const teacherPerms = [
    "perm_academic_read",
    "perm_academic_write",
    "perm_attendance_read",
    "perm_attendance_write",
    "perm_reports",
  ];
  for (const permName of teacherPerms) {
    const perm = defaultPermissions.find((p) => p.name === permName);
    if (!perm) continue;

    const existingAssignment = await db.select<{ id: string }>(
      "SELECT id FROM role_permissions WHERE role_id = ? AND permission_id = ?",
      [teacherRoleId, perm.id],
    );

    if (existingAssignment.length === 0) {
      await db.execute(
        `INSERT INTO role_permissions (id, role_id, permission_id, version, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [crypto.randomUUID(), teacherRoleId, perm.id, 1, now, now, null],
      );
    }
  }

  console.info(`✅ [Seed] Roles and permissions seeded successfully.`);
}

/**
 * EduCore Database Migration System (2026 Elite Pattern)
 *
 * Safe, idempotent migrations that use CREATE TABLE IF NOT EXISTS
 * and ALTER TABLE ADD COLUMN with error catching for existing columns.
 *
 * This runs at app startup before Drizzle ORM takes over.
 */

/**
 * Add a column safely — ignores error if column already exists
 */
async function safeAddColumn(
  db: DatabaseLike,
  table: string,
  column: string,
  type: string,
): Promise<void> {
  try {
    await db.execute(`ALTER TABLE "${table}" ADD COLUMN "${column}" ${type}`);
    console.info(`✅ [Migration] Added column ${table}.${column}`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("duplicate column") || msg.includes("already exists")) {
      // Column already exists — safe to ignore
    } else {
      console.warn(`⚠️ [Migration] ${table}.${column}: ${msg}`);
    }
  }
}

/**
 * Run all migrations — safe to call multiple times (idempotent)
 */
export async function runMigrations(
  db: DatabaseLike,
  options?: MigrationOptions,
): Promise<void> {
  const resolvedOptions = resolveMigrationOptions(options);

  console.info("🔄 [Migration] Starting database sync...");

  // ============================================================
  // PHASE 0: Ensure core tables exist for fresh database files
  // ============================================================

  await db.execute(`
    CREATE TABLE IF NOT EXISTS "users" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "full_name" TEXT NOT NULL,
      "email" TEXT NOT NULL UNIQUE,
      "role" TEXT NOT NULL DEFAULT 'teacher',
      "password_hash" TEXT,
      "nip" TEXT,
      "nis" TEXT,
      "nisn" TEXT,
      "tempat_lahir" TEXT,
      "tanggal_lahir" INTEGER,
      "jenis_kelamin" TEXT,
      "alamat" TEXT,
      "no_telepon" TEXT,
      "foto" TEXT,
      "kelas_id" TEXT,
      "is_active" INTEGER NOT NULL DEFAULT 1,
      "last_login_at" INTEGER,
      "provider" TEXT,
      "provider_id" TEXT,
      "version" INTEGER NOT NULL DEFAULT 1,
      "hlc" TEXT,
      "created_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      "updated_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      "deleted_at" INTEGER,
      "sync_status" TEXT NOT NULL DEFAULT 'pending'
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS "classes" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "name" TEXT NOT NULL,
      "academic_year" TEXT NOT NULL,
      "homeroom_teacher_id" TEXT,
      "level" INTEGER,
      "room" TEXT,
      "capacity" INTEGER,
      "is_active" INTEGER NOT NULL DEFAULT 1,
      "version" INTEGER NOT NULL DEFAULT 1,
      "hlc" TEXT,
      "created_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      "updated_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      "deleted_at" INTEGER,
      "sync_status" TEXT NOT NULL DEFAULT 'pending',
      FOREIGN KEY ("homeroom_teacher_id") REFERENCES "users"("id")
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS "subjects" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "name" TEXT NOT NULL,
      "code" TEXT NOT NULL UNIQUE,
      "description" TEXT,
      "category" TEXT,
      "version" INTEGER NOT NULL DEFAULT 1,
      "hlc" TEXT,
      "created_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      "updated_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      "deleted_at" INTEGER,
      "sync_status" TEXT NOT NULL DEFAULT 'pending'
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS "students" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "nis" TEXT NOT NULL UNIQUE,
      "full_name" TEXT NOT NULL,
      "gender" TEXT NOT NULL,
      "grade" TEXT NOT NULL,
      "parent_name" TEXT,
      "parent_phone" TEXT,
      "nisn" TEXT,
      "tempat_lahir" TEXT,
      "tanggal_lahir" INTEGER,
      "alamat" TEXT,
      "version" INTEGER NOT NULL DEFAULT 1,
      "hlc" TEXT,
      "created_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      "updated_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      "deleted_at" INTEGER,
      "sync_status" TEXT NOT NULL DEFAULT 'pending'
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS "attendance" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "student_id" TEXT NOT NULL REFERENCES "students"("id"),
      "class_id" TEXT NOT NULL REFERENCES "classes"("id"),
      "date" TEXT NOT NULL,
      "status" TEXT NOT NULL,
      "notes" TEXT,
      "recorded_by" TEXT NOT NULL,
      "version" INTEGER NOT NULL DEFAULT 1,
      "hlc" TEXT,
      "created_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      "updated_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      "deleted_at" INTEGER,
      "sync_status" TEXT NOT NULL DEFAULT 'pending'
    )
  `);

  await db.execute(`
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
    )
  `);

  await db.execute(`
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
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS "schedule" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "class_id" TEXT NOT NULL REFERENCES "classes"("id"),
      "subject_id" TEXT NOT NULL REFERENCES "subjects"("id"),
      "teacher_id" TEXT NOT NULL REFERENCES "users"("id"),
      "day_of_week" INTEGER NOT NULL,
      "start_time" TEXT NOT NULL,
      "end_time" TEXT NOT NULL,
      "room" TEXT,
      "version" INTEGER NOT NULL DEFAULT 1,
      "hlc" TEXT,
      "created_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      "updated_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      "deleted_at" INTEGER,
      "sync_status" TEXT NOT NULL DEFAULT 'pending'
    )
  `);

  try {
    await db.execute(
      `CREATE UNIQUE INDEX IF NOT EXISTS "users_email_unique" ON "users" ("email")`,
    );
  } catch {
    // no-op
  }

  try {
    await db.execute(
      `CREATE UNIQUE INDEX IF NOT EXISTS "subjects_code_unique" ON "subjects" ("code")`,
    );
  } catch {
    // no-op
  }

  try {
    await db.execute(
      `CREATE UNIQUE INDEX IF NOT EXISTS "students_nis_unique" ON "students" ("nis")`,
    );
  } catch {
    // no-op
  }

  // ============================================================
  // PHASE 1: ALTER existing tables — add new columns
  // ============================================================

  // --- users: new columns from 2026 refactoring ---
  await safeAddColumn(db, "users", "password_hash", "TEXT");
  await safeAddColumn(db, "users", "nip", "TEXT");
  await safeAddColumn(db, "users", "nis", "TEXT");
  await safeAddColumn(db, "users", "nisn", "TEXT");
  await safeAddColumn(db, "users", "tempat_lahir", "TEXT");
  await safeAddColumn(db, "users", "tanggal_lahir", "INTEGER");
  await safeAddColumn(db, "users", "jenis_kelamin", "TEXT");
  await safeAddColumn(db, "users", "alamat", "TEXT");
  await safeAddColumn(db, "users", "no_telepon", "TEXT");
  await safeAddColumn(db, "users", "foto", "TEXT");
  await safeAddColumn(db, "users", "kelas_id", "TEXT");
  await safeAddColumn(db, "users", "is_active", "INTEGER NOT NULL DEFAULT 1");
  await safeAddColumn(db, "users", "last_login_at", "INTEGER");
  await safeAddColumn(db, "users", "provider", "TEXT");
  await safeAddColumn(db, "users", "provider_id", "TEXT");
  await safeAddColumn(db, "users", "version", "INTEGER NOT NULL DEFAULT 1");
  await safeAddColumn(db, "users", "hlc", "TEXT");

  // --- classes: new columns ---
  await safeAddColumn(db, "classes", "level", "INTEGER");
  await safeAddColumn(db, "classes", "room", "TEXT");
  await safeAddColumn(db, "classes", "capacity", "INTEGER");
  await safeAddColumn(db, "classes", "is_active", "INTEGER NOT NULL DEFAULT 1");
  await safeAddColumn(db, "classes", "version", "INTEGER NOT NULL DEFAULT 1");
  await safeAddColumn(db, "classes", "hlc", "TEXT");

  // --- subjects: new columns ---
  await safeAddColumn(db, "subjects", "description", "TEXT");
  await safeAddColumn(db, "subjects", "category", "TEXT");
  await safeAddColumn(db, "subjects", "version", "INTEGER NOT NULL DEFAULT 1");
  await safeAddColumn(db, "subjects", "hlc", "TEXT");

  // --- students: new columns ---
  await safeAddColumn(db, "students", "nisn", "TEXT");
  await safeAddColumn(db, "students", "tempat_lahir", "TEXT");
  await safeAddColumn(db, "students", "tanggal_lahir", "INTEGER");
  await safeAddColumn(db, "students", "alamat", "TEXT");
  await safeAddColumn(db, "students", "version", "INTEGER NOT NULL DEFAULT 1");
  await safeAddColumn(db, "students", "hlc", "TEXT");

  // --- attendance: version & hlc ---
  await safeAddColumn(
    db,
    "attendance",
    "version",
    "INTEGER NOT NULL DEFAULT 1",
  );
  await safeAddColumn(db, "attendance", "hlc", "TEXT");

  // --- attendance_settings: version & hlc ---
  await safeAddColumn(
    db,
    "attendance_settings",
    "version",
    "INTEGER NOT NULL DEFAULT 1",
  );
  await safeAddColumn(db, "attendance_settings", "hlc", "TEXT");

  // --- holidays: version & hlc ---
  await safeAddColumn(db, "holidays", "version", "INTEGER NOT NULL DEFAULT 1");
  await safeAddColumn(db, "holidays", "hlc", "TEXT");

  // --- schedule: room, version, hlc ---
  await safeAddColumn(db, "schedule", "room", "TEXT");
  await safeAddColumn(db, "schedule", "version", "INTEGER NOT NULL DEFAULT 1");
  await safeAddColumn(db, "schedule", "hlc", "TEXT");

  // ============================================================
  // PHASE 2: CREATE new tables that don't exist yet
  // ============================================================

  // --- RBAC ---
  await db.execute(`
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
    )
  `);

  await db.execute(`
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
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS "user_roles" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "user_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "role_id" TEXT NOT NULL REFERENCES "roles"("id") ON DELETE CASCADE,
      "version" INTEGER NOT NULL DEFAULT 1,
      "hlc" TEXT,
      "created_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      "updated_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      "deleted_at" INTEGER,
      "sync_status" TEXT NOT NULL DEFAULT 'pending'
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS "role_permissions" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "role_id" TEXT NOT NULL REFERENCES "roles"("id") ON DELETE CASCADE,
      "permission_id" TEXT NOT NULL REFERENCES "permissions"("id") ON DELETE CASCADE,
      "version" INTEGER NOT NULL DEFAULT 1,
      "hlc" TEXT,
      "created_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      "updated_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      "deleted_at" INTEGER,
      "sync_status" TEXT NOT NULL DEFAULT 'pending'
    )
  `);

  // --- ACADEMIC ---
  await db.execute(`
    CREATE TABLE IF NOT EXISTS "tahun_ajaran" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "nama" TEXT NOT NULL,
      "tanggal_mulai" INTEGER NOT NULL,
      "tanggal_selesai" INTEGER NOT NULL,
      "is_active" INTEGER NOT NULL DEFAULT 0,
      "version" INTEGER NOT NULL DEFAULT 1,
      "hlc" TEXT,
      "created_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      "updated_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      "deleted_at" INTEGER,
      "sync_status" TEXT NOT NULL DEFAULT 'pending'
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS "semester" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "tahun_ajaran_id" TEXT NOT NULL REFERENCES "tahun_ajaran"("id") ON DELETE CASCADE,
      "nama" TEXT NOT NULL,
      "tanggal_mulai" INTEGER NOT NULL,
      "tanggal_selesai" INTEGER NOT NULL,
      "is_active" INTEGER NOT NULL DEFAULT 0,
      "version" INTEGER NOT NULL DEFAULT 1,
      "hlc" TEXT,
      "created_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      "updated_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      "deleted_at" INTEGER,
      "sync_status" TEXT NOT NULL DEFAULT 'pending'
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS "guru_mapel" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "guru_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "mata_pelajaran_id" TEXT NOT NULL REFERENCES "subjects"("id") ON DELETE CASCADE,
      "kelas_id" TEXT NOT NULL REFERENCES "classes"("id") ON DELETE CASCADE,
      "semester_id" TEXT NOT NULL REFERENCES "semester"("id") ON DELETE CASCADE,
      "version" INTEGER NOT NULL DEFAULT 1,
      "hlc" TEXT,
      "created_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      "updated_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      "deleted_at" INTEGER,
      "sync_status" TEXT NOT NULL DEFAULT 'pending'
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS "jadwal" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "guru_mapel_id" TEXT NOT NULL REFERENCES "guru_mapel"("id") ON DELETE CASCADE,
      "hari" INTEGER NOT NULL,
      "jam_mulai" TEXT NOT NULL,
      "jam_selesai" TEXT NOT NULL,
      "ruangan" TEXT,
      "version" INTEGER NOT NULL DEFAULT 1,
      "hlc" TEXT,
      "created_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      "updated_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      "deleted_at" INTEGER,
      "sync_status" TEXT NOT NULL DEFAULT 'pending'
    )
  `);

  // --- ATTENDANCE (new tables) ---
  await db.execute(`
    CREATE TABLE IF NOT EXISTS "student_daily_attendance" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "student_id" TEXT NOT NULL REFERENCES "students"("id") ON DELETE CASCADE,
      "snapshot_student_name" TEXT,
      "snapshot_student_nis" TEXT,
      "date" TEXT NOT NULL,
      "check_in_time" INTEGER,
      "check_out_time" INTEGER,
      "status" TEXT NOT NULL DEFAULT 'PRESENT',
      "late_duration" INTEGER DEFAULT 0,
      "version" INTEGER NOT NULL DEFAULT 1,
      "hlc" TEXT,
      "created_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      "updated_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      "deleted_at" INTEGER,
      "sync_status" TEXT NOT NULL DEFAULT 'pending'
    )
  `);
  // Indexes for student_daily_attendance
  try {
    await db.execute(
      `CREATE INDEX IF NOT EXISTS "sda_date_idx" ON "student_daily_attendance" ("date")`,
    );
  } catch {}
  try {
    await db.execute(
      `CREATE INDEX IF NOT EXISTS "sda_student_idx" ON "student_daily_attendance" ("student_id")`,
    );
  } catch {}
  try {
    await db.execute(
      `CREATE UNIQUE INDEX IF NOT EXISTS "unique_daily_student_attendance" ON "student_daily_attendance" ("student_id", "date")`,
    );
  } catch {}

  await db.execute(`
    CREATE TABLE IF NOT EXISTS "absensi" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "siswa_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "jadwal_id" TEXT REFERENCES "jadwal"("id"),
      "tanggal" INTEGER NOT NULL,
      "status" TEXT NOT NULL,
      "keterangan" TEXT,
      "jam_masuk" TEXT,
      "jam_keluar" TEXT,
      "metode_absen" TEXT,
      "version" INTEGER NOT NULL DEFAULT 1,
      "hlc" TEXT,
      "created_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      "updated_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      "deleted_at" INTEGER,
      "sync_status" TEXT NOT NULL DEFAULT 'pending'
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS "absensi_scan_logs" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "absensi_id" TEXT REFERENCES "absensi"("id"),
      "student_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "scan_method" TEXT NOT NULL,
      "scan_type" TEXT NOT NULL,
      "session_id" TEXT,
      "device_id" TEXT,
      "scanner_user_id" TEXT REFERENCES "users"("id"),
      "scan_timestamp" INTEGER NOT NULL,
      "version" INTEGER NOT NULL DEFAULT 1,
      "hlc" TEXT,
      "created_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      "updated_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      "deleted_at" INTEGER,
      "sync_status" TEXT NOT NULL DEFAULT 'pending'
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS "student_id_cards" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "student_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "token" TEXT NOT NULL,
      "card_number" TEXT UNIQUE,
      "issued_at" INTEGER NOT NULL,
      "expires_at" INTEGER NOT NULL,
      "is_active" INTEGER NOT NULL DEFAULT 1,
      "revoked_at" INTEGER,
      "revoked_reason" TEXT,
      "last_used_at" INTEGER,
      "version" INTEGER NOT NULL DEFAULT 1,
      "hlc" TEXT,
      "created_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      "updated_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      "deleted_at" INTEGER,
      "sync_status" TEXT NOT NULL DEFAULT 'pending'
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS "absensi_config" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "key" TEXT UNIQUE NOT NULL,
      "tolerance_minutes" INTEGER NOT NULL DEFAULT 15,
      "jam_masuk_normal" TEXT NOT NULL DEFAULT '07:00',
      "jam_pulang_normal" TEXT NOT NULL DEFAULT '14:00',
      "active_days" TEXT NOT NULL DEFAULT '1,2,3,4,5',
      "version" INTEGER NOT NULL DEFAULT 1,
      "hlc" TEXT,
      "created_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      "updated_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      "deleted_at" INTEGER,
      "sync_status" TEXT NOT NULL DEFAULT 'pending'
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS "absensi_exceptions" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "tanggal" INTEGER NOT NULL,
      "nama" TEXT NOT NULL,
      "tipe" TEXT NOT NULL DEFAULT 'libur',
      "keterangan" TEXT,
      "is_setengah_hari" INTEGER NOT NULL DEFAULT 0,
      "jam_pulang_cepat" TEXT,
      "version" INTEGER NOT NULL DEFAULT 1,
      "hlc" TEXT,
      "created_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      "updated_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      "deleted_at" INTEGER,
      "sync_status" TEXT NOT NULL DEFAULT 'pending'
    )
  `);

  // --- NILAI & RAPORT ---
  await db.execute(`
    CREATE TABLE IF NOT EXISTS "nilai" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "siswa_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "guru_mapel_id" TEXT NOT NULL REFERENCES "guru_mapel"("id") ON DELETE CASCADE,
      "jenis_penilaian" TEXT NOT NULL,
      "kd_ke" INTEGER,
      "nilai" INTEGER NOT NULL,
      "semester" TEXT NOT NULL,
      "tahun_ajaran" TEXT NOT NULL,
      "catatan" TEXT,
      "version" INTEGER NOT NULL DEFAULT 1,
      "hlc" TEXT,
      "created_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      "updated_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      "deleted_at" INTEGER,
      "sync_status" TEXT NOT NULL DEFAULT 'pending'
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS "raport" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "siswa_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "kelas_id" TEXT NOT NULL REFERENCES "classes"("id"),
      "semester_id" TEXT NOT NULL REFERENCES "semester"("id"),
      "tahun_ajaran_id" TEXT NOT NULL REFERENCES "tahun_ajaran"("id"),
      "rata_rata" INTEGER,
      "ranking" INTEGER,
      "sikap_spiritual" TEXT,
      "sikap_sosial" TEXT,
      "catatan_wali_kelas" TEXT,
      "keputusan" TEXT,
      "tanggal_terbit" INTEGER,
      "file_url" TEXT,
      "version" INTEGER NOT NULL DEFAULT 1,
      "hlc" TEXT,
      "created_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      "updated_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      "deleted_at" INTEGER,
      "sync_status" TEXT NOT NULL DEFAULT 'pending'
    )
  `);

  // --- FINANCE ---
  await db.execute(`
    CREATE TABLE IF NOT EXISTS "kategori_biaya" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "nama" TEXT NOT NULL,
      "deskripsi" TEXT,
      "tipe" TEXT NOT NULL,
      "version" INTEGER NOT NULL DEFAULT 1,
      "hlc" TEXT,
      "created_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      "updated_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      "deleted_at" INTEGER,
      "sync_status" TEXT NOT NULL DEFAULT 'pending'
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS "tagihan" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "siswa_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "kategori_id" TEXT NOT NULL REFERENCES "kategori_biaya"("id"),
      "nomor_tagihan" TEXT UNIQUE NOT NULL,
      "bulan" INTEGER,
      "tahun" INTEGER,
      "deskripsi" TEXT,
      "jumlah" INTEGER NOT NULL,
      "jatuh_tempo" INTEGER NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'belum_lunas',
      "tanggal_lunas" INTEGER,
      "metode_pembayaran" TEXT,
      "bukti_pembayaran" TEXT,
      "version" INTEGER NOT NULL DEFAULT 1,
      "hlc" TEXT,
      "created_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      "updated_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      "deleted_at" INTEGER,
      "sync_status" TEXT NOT NULL DEFAULT 'pending'
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS "pembayaran" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "tagihan_id" TEXT NOT NULL REFERENCES "tagihan"("id") ON DELETE CASCADE,
      "jumlah" INTEGER NOT NULL,
      "tanggal_bayar" INTEGER NOT NULL,
      "metode" TEXT NOT NULL,
      "referensi" TEXT,
      "catatan" TEXT,
      "version" INTEGER NOT NULL DEFAULT 1,
      "hlc" TEXT,
      "created_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      "updated_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      "deleted_at" INTEGER,
      "sync_status" TEXT NOT NULL DEFAULT 'pending'
    )
  `);

  // --- COMMUNICATION ---
  await db.execute(`
    CREATE TABLE IF NOT EXISTS "pengumuman" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "judul" TEXT NOT NULL,
      "konten" TEXT NOT NULL,
      "lampiran" TEXT,
      "target_role" TEXT,
      "kelas_id" TEXT REFERENCES "classes"("id"),
      "published_at" INTEGER,
      "created_by" TEXT REFERENCES "users"("id"),
      "version" INTEGER NOT NULL DEFAULT 1,
      "hlc" TEXT,
      "created_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      "updated_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      "deleted_at" INTEGER,
      "sync_status" TEXT NOT NULL DEFAULT 'pending'
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS "notifikasi" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "user_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "judul" TEXT NOT NULL,
      "pesan" TEXT NOT NULL,
      "tipe" TEXT,
      "link" TEXT,
      "is_read" INTEGER NOT NULL DEFAULT 0,
      "version" INTEGER NOT NULL DEFAULT 1,
      "hlc" TEXT,
      "created_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      "updated_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      "deleted_at" INTEGER,
      "sync_status" TEXT NOT NULL DEFAULT 'pending'
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS "percakapan" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "nama" TEXT,
      "tipe" TEXT NOT NULL,
      "created_by" TEXT REFERENCES "users"("id"),
      "version" INTEGER NOT NULL DEFAULT 1,
      "hlc" TEXT,
      "created_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      "updated_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      "deleted_at" INTEGER,
      "sync_status" TEXT NOT NULL DEFAULT 'pending'
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS "peserta_percakapan" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "percakapan_id" TEXT NOT NULL REFERENCES "percakapan"("id") ON DELETE CASCADE,
      "user_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "last_read_at" INTEGER,
      "version" INTEGER NOT NULL DEFAULT 1,
      "hlc" TEXT,
      "created_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      "updated_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      "deleted_at" INTEGER,
      "sync_status" TEXT NOT NULL DEFAULT 'pending'
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS "pesan" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "percakapan_id" TEXT NOT NULL REFERENCES "percakapan"("id") ON DELETE CASCADE,
      "pengirim_id" TEXT NOT NULL REFERENCES "users"("id"),
      "konten" TEXT NOT NULL,
      "tipe_konten" TEXT DEFAULT 'text',
      "lampiran" TEXT,
      "is_deleted" INTEGER DEFAULT 0,
      "version" INTEGER NOT NULL DEFAULT 1,
      "hlc" TEXT,
      "created_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      "updated_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      "deleted_at" INTEGER,
      "sync_status" TEXT NOT NULL DEFAULT 'pending'
    )
  `);

  // --- LIBRARY ---
  await db.execute(`
    CREATE TABLE IF NOT EXISTS "buku" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "isbn" TEXT,
      "judul" TEXT NOT NULL,
      "pengarang" TEXT,
      "penerbit" TEXT,
      "tahun_terbit" INTEGER,
      "jumlah_eksemplar" INTEGER NOT NULL DEFAULT 1,
      "lokasi" TEXT,
      "deskripsi" TEXT,
      "kategori" TEXT,
      "version" INTEGER NOT NULL DEFAULT 1,
      "hlc" TEXT,
      "created_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      "updated_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      "deleted_at" INTEGER,
      "sync_status" TEXT NOT NULL DEFAULT 'pending'
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS "anggota_perpustakaan" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "user_id" TEXT NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
      "nomor_anggota" TEXT UNIQUE NOT NULL,
      "tanggal_daftar" INTEGER NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'aktif',
      "version" INTEGER NOT NULL DEFAULT 1,
      "hlc" TEXT,
      "created_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      "updated_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      "deleted_at" INTEGER,
      "sync_status" TEXT NOT NULL DEFAULT 'pending'
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS "peminjaman_buku" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "anggota_id" TEXT NOT NULL REFERENCES "anggota_perpustakaan"("id") ON DELETE CASCADE,
      "buku_id" TEXT NOT NULL REFERENCES "buku"("id") ON DELETE CASCADE,
      "tanggal_pinjam" INTEGER NOT NULL,
      "tanggal_jatuh_tempo" INTEGER NOT NULL,
      "tanggal_kembali" INTEGER,
      "denda" INTEGER,
      "status" TEXT NOT NULL DEFAULT 'dipinjam',
      "petugas_id" TEXT REFERENCES "users"("id"),
      "version" INTEGER NOT NULL DEFAULT 1,
      "hlc" TEXT,
      "created_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      "updated_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      "deleted_at" INTEGER,
      "sync_status" TEXT NOT NULL DEFAULT 'pending'
    )
  `);

  // --- HR ---
  await db.execute(`
    CREATE TABLE IF NOT EXISTS "pegawai" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "user_id" TEXT NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
      "nip" TEXT UNIQUE,
      "status_kepegawaian" TEXT,
      "tanggal_masuk" INTEGER,
      "tanggal_keluar" INTEGER,
      "jabatan" TEXT,
      "departemen" TEXT,
      "gaji_pokok" INTEGER,
      "tunjangan" INTEGER,
      "nomor_rekening" TEXT,
      "bank" TEXT,
      "version" INTEGER NOT NULL DEFAULT 1,
      "hlc" TEXT,
      "created_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      "updated_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      "deleted_at" INTEGER,
      "sync_status" TEXT NOT NULL DEFAULT 'pending'
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS "cuti" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "pegawai_id" TEXT NOT NULL REFERENCES "pegawai"("id") ON DELETE CASCADE,
      "jenis_cuti" TEXT,
      "tanggal_mulai" INTEGER NOT NULL,
      "tanggal_selesai" INTEGER NOT NULL,
      "alasan" TEXT,
      "status" TEXT NOT NULL DEFAULT 'pending',
      "disetujui_oleh" TEXT REFERENCES "users"("id"),
      "catatan_persetujuan" TEXT,
      "version" INTEGER NOT NULL DEFAULT 1,
      "hlc" TEXT,
      "created_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      "updated_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      "deleted_at" INTEGER,
      "sync_status" TEXT NOT NULL DEFAULT 'pending'
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS "gaji_pegawai" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "pegawai_id" TEXT NOT NULL REFERENCES "pegawai"("id") ON DELETE CASCADE,
      "bulan" INTEGER NOT NULL,
      "tahun" INTEGER NOT NULL,
      "gaji_pokok" INTEGER NOT NULL,
      "tunjangan" INTEGER NOT NULL DEFAULT 0,
      "potongan" INTEGER NOT NULL DEFAULT 0,
      "bonus" INTEGER NOT NULL DEFAULT 0,
      "total_gaji" INTEGER NOT NULL,
      "keterangan" TEXT,
      "version" INTEGER NOT NULL DEFAULT 1,
      "hlc" TEXT,
      "created_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      "updated_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      "deleted_at" INTEGER,
      "sync_status" TEXT NOT NULL DEFAULT 'pending'
    )
  `);

  // --- INVENTORY ---
  await db.execute(`
    CREATE TABLE IF NOT EXISTS "kategori_inventaris" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "nama" TEXT NOT NULL,
      "version" INTEGER NOT NULL DEFAULT 1,
      "hlc" TEXT,
      "created_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      "updated_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      "deleted_at" INTEGER,
      "sync_status" TEXT NOT NULL DEFAULT 'pending'
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS "aset" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "kode" TEXT UNIQUE NOT NULL,
      "nama" TEXT NOT NULL,
      "kategori_id" TEXT REFERENCES "kategori_inventaris"("id"),
      "deskripsi" TEXT,
      "lokasi" TEXT,
      "kondisi" TEXT,
      "status" TEXT,
      "tanggal_perolehan" INTEGER,
      "nilai_perolehan" INTEGER,
      "masa_manfaat" INTEGER,
      "version" INTEGER NOT NULL DEFAULT 1,
      "hlc" TEXT,
      "created_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      "updated_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      "deleted_at" INTEGER,
      "sync_status" TEXT NOT NULL DEFAULT 'pending'
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS "peminjaman_aset" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "aset_id" TEXT NOT NULL REFERENCES "aset"("id") ON DELETE CASCADE,
      "peminjam_id" TEXT NOT NULL REFERENCES "users"("id"),
      "tanggal_pinjam" INTEGER NOT NULL,
      "tanggal_rencana_kembali" INTEGER,
      "tanggal_kembali" INTEGER,
      "keperluan" TEXT,
      "status" TEXT NOT NULL DEFAULT 'dipinjam',
      "version" INTEGER NOT NULL DEFAULT 1,
      "hlc" TEXT,
      "created_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      "updated_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      "deleted_at" INTEGER,
      "sync_status" TEXT NOT NULL DEFAULT 'pending'
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS "stok_barang" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "kode" TEXT UNIQUE NOT NULL,
      "nama" TEXT NOT NULL,
      "kategori_id" TEXT REFERENCES "kategori_inventaris"("id"),
      "deskripsi" TEXT,
      "satuan" TEXT NOT NULL DEFAULT 'pcs',
      "stok_saat_ini" INTEGER NOT NULL DEFAULT 0,
      "stok_minimum" INTEGER NOT NULL DEFAULT 10,
      "harga_satuan" INTEGER,
      "lokasi_penyimpanan" TEXT,
      "version" INTEGER NOT NULL DEFAULT 1,
      "hlc" TEXT,
      "created_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      "updated_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      "deleted_at" INTEGER,
      "sync_status" TEXT NOT NULL DEFAULT 'pending'
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS "transaksi_stok" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "barang_id" TEXT NOT NULL REFERENCES "stok_barang"("id") ON DELETE CASCADE,
      "tipe" TEXT NOT NULL,
      "jumlah" INTEGER NOT NULL,
      "stok_sebelum" INTEGER NOT NULL,
      "stok_sesudah" INTEGER NOT NULL,
      "keterangan" TEXT,
      "referensi" TEXT,
      "user_id" TEXT REFERENCES "users"("id"),
      "version" INTEGER NOT NULL DEFAULT 1,
      "hlc" TEXT,
      "created_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      "updated_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      "deleted_at" INTEGER,
      "sync_status" TEXT NOT NULL DEFAULT 'pending'
    )
  `);

  // --- TRANSPORT ---
  await db.execute(`
    CREATE TABLE IF NOT EXISTS "kendaraan" (
      "id" TEXT PRIMARY KEY NOT NULL,
      "nomor_polisi" TEXT UNIQUE NOT NULL,
      "merk" TEXT,
      "model" TEXT,
      "kapasitas" INTEGER,
      "sopir_id" TEXT REFERENCES "users"("id"),
      "rute" TEXT,
      "version" INTEGER NOT NULL DEFAULT 1,
      "hlc" TEXT,
      "created_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      "updated_at" INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      "deleted_at" INTEGER,
      "sync_status" TEXT NOT NULL DEFAULT 'pending'
    )
  `);

  const usersTable = await db.select<{ name: string }>(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'users' LIMIT 1`,
  );

  if (usersTable.length === 0) {
    throw new Error("Migration failed: required table 'users' was not created");
  }

  if (resolvedOptions.seedData) {
    await seedDefaultAdmin(db, resolvedOptions);
    await seedDefaultStaffAccounts(db);
    await seedRolesAndPermissions(db);
    await seedClassesFromLegacyData(db);
    await syncStudentsFromUsers(db);
    await seedDefaultAttendanceSettings(db);
  } else {
    console.info("ℹ️ [Migration] Seed phase skipped for read-only inspection.");
  }

  await ensureUserStudentProjectionTriggers(db);

  console.info("✅ [Migration] Database sync complete!");
}
