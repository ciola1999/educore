import { and, count, desc, eq, inArray, isNull, like, or } from "drizzle-orm";
import { z } from "zod";
import { requireRole } from "@/lib/api/authz";
import { apiError, apiOk } from "@/lib/api/response";
import { hashPassword } from "@/lib/auth/hash";
import { auth } from "@/lib/auth/web/auth";
import { getDb } from "@/lib/db";
import { classes, students, users } from "@/lib/db/schema";
import { sanitizeClassDisplayName } from "@/lib/utils/class-name";
import { studentInsertSchema } from "@/lib/validations/schemas";

type StudentListItem = {
  id: string;
  nis: string;
  nisn: string | null;
  fullName: string;
  gender: "L" | "P";
  grade: string;
  parentName: string | null;
  parentPhone: string | null;
  tempatLahir: string | null;
  tanggalLahir: Date | null;
  alamat: string | null;
  hasAccount: boolean;
  accountEmail: string | null;
  createdAt: Date;
};

type StudentRowWithAccountClass = {
  grade: string;
  accountClassName?: string | null;
};

type SessionUserLike = {
  id?: string;
  role?: string;
};

const studentCreateRequestSchema = studentInsertSchema.extend({
  account: z
    .object({
      email: z.string().email("Email akun siswa tidak valid"),
      password: z.string().min(8, "Password akun siswa minimal 8 karakter"),
    })
    .optional(),
});

function getAcademicYearLabel(): string {
  const year = new Date().getFullYear();
  return `${year}/${year + 1}`;
}

async function resolveStudentGrades<T extends StudentRowWithAccountClass>(
  db: Awaited<ReturnType<typeof getDb>>,
  rows: T[],
): Promise<Array<Omit<T, "accountClassName"> & { grade: string }>> {
  const classIds = [
    ...new Set(rows.map((row) => row.grade.trim()).filter(Boolean)),
  ];
  if (classIds.length === 0) {
    return rows;
  }

  const classRows = await db
    .select({ id: classes.id, name: classes.name })
    .from(classes)
    .where(and(inArray(classes.id, classIds), isNull(classes.deletedAt)));
  const classNameById = new Map(classRows.map((row) => [row.id, row.name]));

  return rows.map(({ accountClassName, ...row }) => ({
    ...row,
    grade: sanitizeClassDisplayName(
      accountClassName,
      classNameById.get(row.grade.trim()),
      row.grade,
    ),
  }));
}

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return apiError("Unauthorized", 401);
  }

  const sessionUser = session.user as SessionUserLike;
  const role = sessionUser.role;
  const userId = sessionUser.id;
  const db = await getDb();

  if (role === "student" && userId) {
    const account = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(
        and(
          eq(users.id, userId),
          eq(users.role, "student"),
          eq(users.isActive, true),
          isNull(users.deletedAt),
        ),
      )
      .limit(1);

    const ownRecord = await db
      .select({
        id: students.id,
        nis: students.nis,
        nisn: students.nisn,
        fullName: students.fullName,
        gender: students.gender,
        grade: students.grade,
        parentName: students.parentName,
        parentPhone: students.parentPhone,
        tempatLahir: students.tempatLahir,
        tanggalLahir: students.tanggalLahir,
        alamat: students.alamat,
        createdAt: students.createdAt,
        accountClassName: classes.name,
      })
      .from(students)
      .leftJoin(users, and(eq(users.id, students.id), isNull(users.deletedAt)))
      .leftJoin(
        classes,
        and(eq(users.kelasId, classes.id), isNull(classes.deletedAt)),
      )
      .where(and(eq(students.id, userId), isNull(students.deletedAt)))
      .limit(1);

    const data = (await resolveStudentGrades(
      db,
      ownRecord.map((item) => ({
        ...item,
        hasAccount: account.length > 0,
        accountEmail: account[0]?.email ?? null,
      })),
    )) as StudentListItem[];

    return apiOk({
      data,
      total: data.length,
      page: 1,
      totalPages: 1,
    });
  }

  const guard = requireRole(session, ["admin", "super_admin"]);
  if (guard) {
    return guard;
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(Number(searchParams.get("page") || "1"), 1);
  const limit = Math.min(
    Math.max(Number(searchParams.get("limit") || "12"), 1),
    50,
  );
  const search = searchParams.get("search")?.trim() || "";
  const sortBy = searchParams.get("sortBy") || "createdAt";
  const sortDir = searchParams.get("sortDir") === "asc" ? "asc" : "desc";
  const offset = (page - 1) * limit;

  let conditions = isNull(students.deletedAt);
  if (search) {
    const q = `%${search}%`;
    const searchCondition = or(
      like(students.fullName, q),
      like(students.nis, q),
      like(students.grade, q),
      like(students.nisn, q),
    );

    if (searchCondition) {
      const mergedCondition = and(conditions, searchCondition);
      if (mergedCondition) {
        conditions = mergedCondition;
      }
    }
  }

  const [rawRows, totalResult] = await Promise.all([
    db
      .select({
        id: students.id,
        nis: students.nis,
        nisn: students.nisn,
        fullName: students.fullName,
        gender: students.gender,
        grade: students.grade,
        parentName: students.parentName,
        parentPhone: students.parentPhone,
        tempatLahir: students.tempatLahir,
        tanggalLahir: students.tanggalLahir,
        alamat: students.alamat,
        createdAt: students.createdAt,
        accountClassName: classes.name,
      })
      .from(students)
      .leftJoin(
        users,
        and(
          eq(users.id, students.id),
          eq(users.role, "student"),
          isNull(users.deletedAt),
        ),
      )
      .leftJoin(
        classes,
        and(eq(users.kelasId, classes.id), isNull(classes.deletedAt)),
      )
      .where(conditions)
      .orderBy(
        sortBy === "fullName"
          ? sortDir === "asc"
            ? students.fullName
            : desc(students.fullName)
          : sortBy === "nis"
            ? sortDir === "asc"
              ? students.nis
              : desc(students.nis)
            : sortBy === "grade"
              ? sortDir === "asc"
                ? students.grade
                : desc(students.grade)
              : sortDir === "asc"
                ? students.createdAt
                : desc(students.createdAt),
      )
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(students).where(conditions),
  ]);

  const rows = await resolveStudentGrades(db, rawRows);
  const total = Number(totalResult[0]?.value || 0);
  const studentIds = rows.map((row) => row.id);
  let accountIds = new Set<string>();
  if (studentIds.length > 0) {
    const accounts = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(
        and(
          inArray(users.id, studentIds),
          eq(users.role, "student"),
          eq(users.isActive, true),
          isNull(users.deletedAt),
        ),
      );
    accountIds = new Set(accounts.map((item) => item.id));
    const accountById = new Map(accounts.map((item) => [item.id, item.email]));
    return apiOk({
      data: rows.map((row) => ({
        ...row,
        hasAccount: accountIds.has(row.id),
        accountEmail: accountById.get(row.id) ?? null,
      })) satisfies StudentListItem[],
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  }

  return apiOk({
    data: rows.map((row) => ({
      ...row,
      hasAccount: accountIds.has(row.id),
      accountEmail: null,
    })) satisfies StudentListItem[],
    total,
    page,
    totalPages: Math.max(1, Math.ceil(total / limit)),
  });
}

export async function POST(request: Request) {
  const session = await auth();
  const guard = requireRole(session, ["admin", "super_admin"]);
  if (guard) {
    return guard;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return apiError("Payload tidak valid", 400, "INVALID_PAYLOAD");
  }

  const validation = studentCreateRequestSchema.safeParse(body);
  if (!validation.success) {
    return apiError(
      validation.error.issues[0]?.message || "Data siswa tidak valid",
      400,
      "VALIDATION_ERROR",
    );
  }

  const db = await getDb();
  const data = validation.data;
  const normalizedNis = data.nis.trim();
  const normalizedAccountEmail = data.account?.email.trim().toLowerCase();

  const existing = await db
    .select({ id: students.id })
    .from(students)
    .where(and(eq(students.nis, normalizedNis), isNull(students.deletedAt)))
    .limit(1);

  if (existing.length > 0) {
    return apiError("NIS sudah terdaftar", 409, "NIS_EXISTS");
  }

  if (normalizedAccountEmail) {
    const existingUserByEmail = await db
      .select({ id: users.id })
      .from(users)
      .where(
        and(eq(users.email, normalizedAccountEmail), isNull(users.deletedAt)),
      )
      .limit(1);

    if (existingUserByEmail.length > 0) {
      return apiError("Email akun siswa sudah terdaftar", 409, "EMAIL_EXISTS");
    }
  }

  const id = data.id || crypto.randomUUID();
  const now = new Date();
  const normalizedGrade = sanitizeClassDisplayName(data.grade);

  await db.insert(students).values({
    id,
    nis: normalizedNis,
    nisn: data.nisn || null,
    fullName: data.fullName.trim(),
    gender: data.gender,
    grade: normalizedGrade,
    parentName: data.parentName || null,
    parentPhone: data.parentPhone || null,
    tempatLahir: data.tempatLahir || null,
    tanggalLahir: data.tanggalLahir || null,
    alamat: data.alamat || null,
    syncStatus: "pending",
    createdAt: now,
    updatedAt: now,
  });

  let userCreated = false;
  if (data.account && normalizedAccountEmail) {
    const gradeName = normalizedGrade;
    let kelasId: string | null = null;
    if (gradeName && gradeName !== "UNASSIGNED") {
      const classRows = await db
        .select({ id: classes.id })
        .from(classes)
        .where(and(eq(classes.name, gradeName), isNull(classes.deletedAt)))
        .limit(1);

      if (classRows.length > 0) {
        kelasId = classRows[0]?.id ?? null;
      } else {
        kelasId = crypto.randomUUID();
        await db.insert(classes).values({
          id: kelasId,
          name: gradeName,
          academicYear: getAcademicYearLabel(),
          isActive: true,
          syncStatus: "pending",
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    const passwordHash = await hashPassword(data.account.password);
    await db.insert(users).values({
      id,
      fullName: data.fullName.trim(),
      email: normalizedAccountEmail,
      role: "student",
      passwordHash,
      nis: normalizedNis,
      nisn: data.nisn || null,
      tempatLahir: data.tempatLahir || null,
      tanggalLahir: data.tanggalLahir || null,
      jenisKelamin: data.gender,
      alamat: data.alamat || null,
      kelasId,
      isActive: true,
      syncStatus: "pending",
      createdAt: now,
      updatedAt: now,
    });
    userCreated = true;
  }

  return apiOk({ id, created: true, userCreated });
}
