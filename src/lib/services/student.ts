// Project\educore\src\lib\services\student.ts

import { and, asc, count, desc, eq, isNull, like, or } from "drizzle-orm";
import { getDb } from "../db";
import {
  classes,
  type NewStudent,
  type Student,
  studentIdCards,
  students,
  users,
} from "../db/schema";

export type { NewStudent, Student };

export type StudentFilter = {
  page: number;
  limit: number;
  search?: string;
  sortBy?: keyof Student;
  sortDir?: "asc" | "desc";
};

export type StudentResponse = {
  data: Student[];
  total: number;
  page: number;
  totalPages: number;
};

export type StudentQrPayload = {
  studentId: string;
  nis: string;
  token: string;
  cardNumber: string;
};

export type StudentProfileInput = NewStudent & {
  email?: string | null;
  classId?: string;
};

function toDefaultStudentEmail(nis: string): string {
  const normalized = nis.toLowerCase().replace(/[^a-z0-9]/g, "");
  return `siswa.${normalized}@educore.local`;
}

function getAcademicYearLabel(): string {
  const year = new Date().getFullYear();
  return `${year}/${year + 1}`;
}

async function ensureClassExistsFromGrade(grade: string) {
  const db = await getDb();
  const normalizedGrade = grade.trim();
  if (!normalizedGrade) return;

  const existing = await db
    .select({ id: classes.id })
    .from(classes)
    .where(and(eq(classes.name, normalizedGrade), isNull(classes.deletedAt)))
    .limit(1);

  if (existing.length > 0) return;

  await db.insert(classes).values({
    id: crypto.randomUUID(),
    name: normalizedGrade,
    academicYear: getAcademicYearLabel(),
    isActive: true,
    syncStatus: "pending",
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  });
}

async function resolveClassReference(input: string): Promise<{
  classId: string;
  className: string;
}> {
  const db = await getDb();
  const raw = input.trim();

  const byId = await db
    .select({ id: classes.id, name: classes.name })
    .from(classes)
    .where(and(eq(classes.id, raw), isNull(classes.deletedAt)))
    .limit(1);

  if (byId.length > 0) {
    return {
      classId: byId[0].id,
      className: byId[0].name,
    };
  }

  const byName = await db
    .select({ id: classes.id, name: classes.name })
    .from(classes)
    .where(and(eq(classes.name, raw), isNull(classes.deletedAt)))
    .limit(1);

  if (byName.length > 0) {
    return {
      classId: byName[0].id,
      className: byName[0].name,
    };
  }

  await ensureClassExistsFromGrade(raw);

  const created = await db
    .select({ id: classes.id, name: classes.name })
    .from(classes)
    .where(and(eq(classes.name, raw), isNull(classes.deletedAt)))
    .limit(1);

  if (created.length > 0) {
    return {
      classId: created[0].id,
      className: created[0].name,
    };
  }

  return {
    classId: raw,
    className: raw,
  };
}

type StudentUserProjectionInput = {
  nis: string;
  fullName: string;
  gender: "L" | "P";
  grade: string;
  nisn?: string | null;
  tempatLahir?: string | null;
  tanggalLahir?: Date | null;
  alamat?: string | null;
  email?: string | null;
  classId?: string;
};

async function upsertUserFromStudent(
  studentId: string,
  data: StudentUserProjectionInput,
) {
  const db = await getDb();
  const now = new Date();

  const existingUser = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(eq(users.id, studentId))
    .limit(1);

  const normalizeEmail = (value: string): string => value.trim().toLowerCase();

  const findEmailOwner = async (email: string) => {
    const owner = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    return owner[0]?.id ?? null;
  };

  const resolveUniqueEmail = async (
    preferredEmail: string,
    currentUserId?: string,
  ): Promise<string> => {
    const normalizedPreferred = normalizeEmail(preferredEmail);
    const ownerId = await findEmailOwner(normalizedPreferred);

    if (!ownerId || ownerId === currentUserId) {
      return normalizedPreferred;
    }

    const [rawLocalPart, rawDomain] = normalizedPreferred.split("@");
    const localPart = rawLocalPart || `siswa.${data.nis}`;
    const domain = rawDomain || "educore.local";
    const nisSuffix = data.nis.slice(-4);

    for (let attempt = 1; attempt <= 7; attempt += 1) {
      const candidate = `${localPart}.${nisSuffix}-${attempt}@${domain}`;
      const candidateOwnerId = await findEmailOwner(candidate);
      if (!candidateOwnerId || candidateOwnerId === currentUserId) {
        return candidate;
      }
    }

    return `${localPart}.${crypto.randomUUID().slice(0, 8)}@${domain}`;
  };

  const generatedEmail = toDefaultStudentEmail(data.nis);
  const candidateEmail = normalizeEmail(
    (data.email || "").trim() || generatedEmail,
  );

  if (existingUser.length > 0) {
    const safeEmail = await resolveUniqueEmail(
      candidateEmail,
      existingUser[0].id,
    );

    await db
      .update(users)
      .set({
        fullName: data.fullName,
        email: safeEmail,
        role: "student",
        nis: data.nis,
        nisn: data.nisn ?? null,
        jenisKelamin: data.gender,
        tempatLahir: data.tempatLahir ?? null,
        tanggalLahir: data.tanggalLahir ?? null,
        alamat: data.alamat ?? null,
        kelasId: data.classId ?? null,
        isActive: true,
        deletedAt: null,
        updatedAt: now,
        syncStatus: "pending",
      })
      .where(eq(users.id, studentId));
    return;
  }

  const safeEmail = await resolveUniqueEmail(candidateEmail);

  await db.insert(users).values({
    id: studentId,
    fullName: data.fullName,
    email: safeEmail,
    role: "student",
    passwordHash: null,
    nis: data.nis,
    nisn: data.nisn ?? null,
    tempatLahir: data.tempatLahir ?? null,
    tanggalLahir: data.tanggalLahir ?? null,
    jenisKelamin: data.gender,
    alamat: data.alamat ?? null,
    kelasId: data.classId ?? null,
    isActive: true,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    syncStatus: "pending",
  });
}

/**
 * Get Students with SQL-based Pagination, Search & Sort
 * ✅ Performance Optimized (60 FPS Safe)
 */
export async function getStudents(
  filter: StudentFilter = { page: 1, limit: 10 },
): Promise<StudentResponse> {
  try {
    const db = await getDb();
    const {
      page,
      limit,
      search,
      sortBy = "createdAt",
      sortDir = "desc",
    } = filter;
    const offset = (page - 1) * limit;

    // 1. Construct Search Condition (Dynamic WHERE)
    const searchCondition = search
      ? or(
          like(students.fullName, `%${search}%`),
          like(students.nis, `%${search}%`),
          like(students.grade, `%${search}%`),
          like(students.nisn, `%${search}%`),
        )
      : undefined;

    const whereCondition = searchCondition
      ? and(isNull(students.deletedAt), searchCondition)
      : isNull(students.deletedAt);

    // 2. Count Total Records (untuk Pagination UI)
    // Query terpisah agar efisien
    const totalResult = await db
      .select({ value: count() })
      .from(students)
      .where(whereCondition);

    const totalItems = totalResult[0]?.value || 0;

    // 3. Get Data (Paginated)
    const data = await db
      .select()
      .from(students)
      .where(whereCondition)
      .orderBy(
        sortDir === "asc"
          ? asc(students[sortBy] || students.createdAt)
          : desc(students[sortBy] || students.createdAt),
      )
      .limit(limit)
      .offset(offset);

    return {
      data,
      total: totalItems,
      page,
      totalPages: Math.ceil(totalItems / limit),
    };
  } catch (error) {
    console.error("Error fetching students:", error);
    throw error;
  }
}

// --- CRUD OPERATIONS (Standard) ---

export async function createStudent(data: StudentProfileInput) {
  const db = await getDb();
  // Generate ID jika belum ada (biasanya UUID v7 diurus di frontend atau default)
  const id = data.id || crypto.randomUUID();

  const classRef = await resolveClassReference(data.grade);

  await db.insert(students).values({
    id,
    nis: data.nis,
    fullName: data.fullName,
    gender: data.gender,
    grade: classRef.className,
    parentName: data.parentName ?? null,
    parentPhone: data.parentPhone ?? null,
    nisn: data.nisn ?? null,
    tempatLahir: data.tempatLahir ?? null,
    tanggalLahir: data.tanggalLahir ?? null,
    alamat: data.alamat ?? null,
    syncStatus: "pending", // Wajib pending agar ke-upload saat online
    updatedAt: new Date(),
  });

  await upsertUserFromStudent(id, {
    nis: data.nis,
    fullName: data.fullName,
    gender: data.gender,
    grade: classRef.className,
    nisn: data.nisn ?? null,
    tempatLahir: data.tempatLahir ?? null,
    tanggalLahir: data.tanggalLahir ?? null,
    alamat: data.alamat ?? null,
    email: data.email ?? null,
    classId: classRef.classId,
  });

  return id;
}

export async function updateStudent(
  id: string,
  data: Partial<StudentProfileInput>,
) {
  const db = await getDb();
  const existing = await db
    .select()
    .from(students)
    .where(eq(students.id, id))
    .limit(1);

  if (existing.length === 0) {
    throw new Error("Student not found");
  }

  const current = existing[0];
  const targetGrade = data.grade ?? current.grade;
  const classRef = await resolveClassReference(targetGrade);

  await db
    .update(students)
    .set({
      nis: data.nis ?? current.nis,
      fullName: data.fullName ?? current.fullName,
      gender: data.gender ?? current.gender,
      grade: classRef.className,
      parentName: data.parentName ?? current.parentName,
      parentPhone: data.parentPhone ?? current.parentPhone,
      nisn: data.nisn ?? current.nisn,
      tempatLahir: data.tempatLahir ?? current.tempatLahir,
      tanggalLahir: data.tanggalLahir ?? current.tanggalLahir,
      alamat: data.alamat ?? current.alamat,
      syncStatus: "pending",
      updatedAt: new Date(),
    })
    .where(eq(students.id, id));

  await upsertUserFromStudent(id, {
    nis: data.nis ?? current.nis,
    fullName: data.fullName ?? current.fullName,
    gender: data.gender ?? current.gender,
    grade: classRef.className,
    nisn: data.nisn ?? current.nisn ?? null,
    tempatLahir: data.tempatLahir ?? current.tempatLahir ?? null,
    tanggalLahir: data.tanggalLahir ?? current.tanggalLahir ?? null,
    alamat: data.alamat ?? current.alamat ?? null,
    email: data.email ?? null,
    classId: classRef.classId,
  });
}

export async function deleteStudent(id: string) {
  const db = await getDb();
  // Soft Delete (Praktik terbaik untuk aplikasi Sync)
  await db
    .update(students)
    .set({
      deletedAt: new Date(),
      syncStatus: "pending",
      updatedAt: new Date(),
    })
    .where(eq(students.id, id));

  await db
    .update(users)
    .set({
      deletedAt: new Date(),
      isActive: false,
      syncStatus: "pending",
      updatedAt: new Date(),
    })
    .where(eq(users.id, id));
}

// Helper untuk Dashboard Stats
export async function getStudentStats() {
  const db = await getDb();

  // 1. Query Total
  const totalRes = await db.select({ value: count() }).from(students);

  // 2. Query Laki-laki
  const maleRes = await db
    .select({ value: count() })
    .from(students)
    .where(eq(students.gender, "L"));

  // 3. Query Perempuan
  const femaleRes = await db
    .select({ value: count() })
    .from(students)
    .where(eq(students.gender, "P"));

  return {
    total: totalRes[0]?.value || 0,
    male: maleRes[0]?.value || 0,
    female: femaleRes[0]?.value || 0,
  };
}

export async function getOrCreateStudentCard(
  studentId: string,
): Promise<StudentQrPayload | null> {
  const db = await getDb();

  // 1. Cek apakah muridnya ada
  const student = await db
    .select({ id: students.id, nis: students.nis, fullName: students.fullName })
    .from(students)
    .where(and(eq(students.id, studentId), isNull(students.deletedAt)))
    .limit(1);

  if (student.length === 0) {
    return null;
  }

  // 2. Cek apakah sudah ada kartu yang AKTIF
  const activeCard = await db
    .select({
      token: studentIdCards.token,
      cardNumber: studentIdCards.cardNumber,
    })
    .from(studentIdCards)
    .where(
      and(
        eq(studentIdCards.studentId, studentId),
        eq(studentIdCards.isActive, true),
        isNull(studentIdCards.revokedAt),
        isNull(studentIdCards.deletedAt),
      ),
    )
    .limit(1);

  // Jika ada kartu aktif, langsung kembalikan datanya
  if (activeCard.length > 0) {
    return {
      studentId,
      nis: student[0].nis,
      token: activeCard[0].token,
      cardNumber: activeCard[0].cardNumber ?? student[0].nis,
    };
  }

  // 3. Jika tidak ada kartu aktif, kita buat yang baru
  const now = new Date();
  const cardToken = crypto.randomUUID();
  const baseCardNumber = `STD-${student[0].nis}`;
  let finalCardNumber = baseCardNumber;
  let attempt = 1;

  // LOOP: Pastikan cardNumber benar-benar unik di seluruh database
  // Termasuk mengecek kartu yang sudah di-soft-delete atau di-revoke
  while (true) {
    const existing = await db
      .select({ id: studentIdCards.id })
      .from(studentIdCards)
      .where(eq(studentIdCards.cardNumber, finalCardNumber))
      .limit(1);

    if (existing.length === 0) {
      // Jika tidak ada yang pakai nomor ini, keluar dari loop
      break;
    }

    // Jika sudah dipakai, tambahkan suffix -1, -2, dst.
    finalCardNumber = `${baseCardNumber}-${attempt}`;
    attempt++;
  }

  // 4. Masukkan data dengan cardNumber yang sudah dijamin unik
  await db.insert(studentIdCards).values({
    id: crypto.randomUUID(),
    studentId,
    token: cardToken,
    cardNumber: finalCardNumber,
    issuedAt: now,
    expiresAt: new Date(now.getTime() + 3650 * 24 * 60 * 60 * 1000), // Masa aktif 10 tahun
    isActive: true,
    revokedAt: null,
    revokedReason: null,
    lastUsedAt: null,
    syncStatus: "pending",
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  });

  return {
    studentId,
    nis: student[0].nis,
    token: cardToken,
    cardNumber: finalCardNumber,
  };
}
