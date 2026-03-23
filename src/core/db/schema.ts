import { relations, sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { AUTH_ROLE_DEFAULT, AUTH_ROLES } from "@/core/auth/roles";

/**
 * EduCore Unified Database Schema (2026 Elite Pattern)
 * Local-First, Hybrid Desktop + Web, HLC Sync Ready
 */

// --- HELPERS: Metadata & Sync Protocol ---
const syncMetadata = {
  version: integer("version").notNull().default(1),
  hlc: text("hlc"), // Hybrid Logical Clock for 2026 Sync
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(strftime('%s', 'now'))`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(strftime('%s', 'now'))`),
  deletedAt: integer("deleted_at", { mode: "timestamp" }),
  syncStatus: text("sync_status", { enum: ["synced", "pending", "error"] })
    .notNull()
    .default("pending"),
};

const generateId = () => crypto.randomUUID();

// --- 1. RBAC & USERS ---

export const users = sqliteTable("users", {
  id: text("id").primaryKey().$defaultFn(generateId),
  fullName: text("full_name").notNull(),
  email: text("email").notNull().unique(),
  role: text("role", { enum: AUTH_ROLES }).notNull().default(AUTH_ROLE_DEFAULT),
  passwordHash: text("password_hash"),
  nip: text("nip"),
  nis: text("nis"),
  nisn: text("nisn"),
  tempatLahir: text("tempat_lahir"),
  tanggalLahir: integer("tanggal_lahir", { mode: "timestamp" }),
  jenisKelamin: text("jenis_kelamin", { enum: ["L", "P"] }),
  alamat: text("alamat"),
  noTelepon: text("no_telepon"),
  foto: text("foto"),
  kelasId: text("kelas_id"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  lastLoginAt: integer("last_login_at", { mode: "timestamp" }),
  provider: text("provider"),
  providerId: text("provider_id"),
  ...syncMetadata,
});

export const roles = sqliteTable("roles", {
  id: text("id").primaryKey().$defaultFn(generateId),
  name: text("name").notNull().unique(),
  description: text("description"),
  ...syncMetadata,
});

export const permissions = sqliteTable("permissions", {
  id: text("id").primaryKey().$defaultFn(generateId),
  name: text("name").notNull().unique(),
  resource: text("resource").notNull(),
  action: text("action").notNull(),
  ...syncMetadata,
});

export const userRoles = sqliteTable("user_roles", {
  id: text("id").primaryKey().$defaultFn(generateId),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  roleId: text("role_id")
    .notNull()
    .references(() => roles.id, { onDelete: "cascade" }),
  ...syncMetadata,
});

export const rolePermissions = sqliteTable("role_permissions", {
  id: text("id").primaryKey().$defaultFn(generateId),
  roleId: text("role_id")
    .notNull()
    .references(() => roles.id, { onDelete: "cascade" }),
  permissionId: text("permission_id")
    .notNull()
    .references(() => permissions.id, { onDelete: "cascade" }),
  ...syncMetadata,
});

// --- 2. ACADEMIC ---

export const tahunAjaran = sqliteTable("tahun_ajaran", {
  id: text("id").primaryKey().$defaultFn(generateId),
  nama: text("nama").notNull(),
  tanggalMulai: integer("tanggal_mulai", { mode: "timestamp" }).notNull(),
  tanggalSelesai: integer("tanggal_selesai", { mode: "timestamp" }).notNull(),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(false),
  ...syncMetadata,
});

export const semester = sqliteTable("semester", {
  id: text("id").primaryKey().$defaultFn(generateId),
  tahunAjaranId: text("tahun_ajaran_id")
    .notNull()
    .references(() => tahunAjaran.id, { onDelete: "cascade" }),
  nama: text("nama").notNull(),
  tanggalMulai: integer("tanggal_mulai", { mode: "timestamp" }).notNull(),
  tanggalSelesai: integer("tanggal_selesai", { mode: "timestamp" }).notNull(),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(false),
  ...syncMetadata,
});

export const classes = sqliteTable("classes", {
  id: text("id").primaryKey().$defaultFn(generateId),
  name: text("name").notNull(),
  academicYear: text("academic_year").notNull(),
  homeroomTeacherId: text("homeroom_teacher_id"),
  level: integer("level"),
  room: text("room"),
  capacity: integer("capacity"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  ...syncMetadata,
});

export const subjects = sqliteTable("subjects", {
  id: text("id").primaryKey().$defaultFn(generateId),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  description: text("description"),
  category: text("category"),
  ...syncMetadata,
});

export const guruMapel = sqliteTable("guru_mapel", {
  id: text("id").primaryKey().$defaultFn(generateId),
  guruId: text("guru_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  mataPelajaranId: text("mata_pelajaran_id")
    .notNull()
    .references(() => subjects.id, { onDelete: "cascade" }),
  kelasId: text("kelas_id")
    .notNull()
    .references(() => classes.id, { onDelete: "cascade" }),
  semesterId: text("semester_id")
    .notNull()
    .references(() => semester.id, { onDelete: "cascade" }),
  ...syncMetadata,
});

export const jadwal = sqliteTable("jadwal", {
  id: text("id").primaryKey().$defaultFn(generateId),
  guruMapelId: text("guru_mapel_id")
    .notNull()
    .references(() => guruMapel.id, { onDelete: "cascade" }),
  hari: integer("hari").notNull(),
  jamMulai: text("jam_mulai").notNull(),
  jamSelesai: text("jam_selesai").notNull(),
  ruangan: text("ruangan"),
  ...syncMetadata,
});

export const schedule = sqliteTable("schedule", {
  id: text("id").primaryKey().$defaultFn(generateId),
  classId: text("class_id")
    .notNull()
    .references(() => classes.id),
  subjectId: text("subject_id")
    .notNull()
    .references(() => subjects.id),
  teacherId: text("teacher_id")
    .notNull()
    .references(() => users.id),
  dayOfWeek: integer("day_of_week").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  room: text("room"),
  ...syncMetadata,
});

// --- 3. ATTENDANCE ---

export const students = sqliteTable("students", {
  id: text("id").primaryKey().$defaultFn(generateId),
  nis: text("nis").notNull().unique(),
  fullName: text("full_name").notNull(),
  gender: text("gender", { enum: ["L", "P"] }).notNull(),
  grade: text("grade").notNull(),
  parentName: text("parent_name"),
  parentPhone: text("parent_phone"),
  nisn: text("nisn"),
  tempatLahir: text("tempat_lahir"),
  tanggalLahir: integer("tanggal_lahir", { mode: "timestamp" }),
  alamat: text("alamat"),
  ...syncMetadata,
});

export const attendance = sqliteTable("attendance", {
  id: text("id").primaryKey().$defaultFn(generateId),
  studentId: text("student_id")
    .notNull()
    .references(() => students.id),
  classId: text("class_id")
    .notNull()
    .references(() => classes.id),
  date: text("date").notNull(),
  status: text("status").notNull(),
  notes: text("notes"),
  recordedBy: text("recorded_by").notNull(),
  ...syncMetadata,
});

export const attendanceSettings = sqliteTable("attendance_settings", {
  id: text("id").primaryKey().$defaultFn(generateId),
  dayOfWeek: integer("day_of_week").notNull(),
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  lateThreshold: text("late_threshold").notNull(),
  entityType: text("entity_type", { enum: ["student", "employee"] }).notNull(),
  isActive: integer("is_active", { mode: "boolean" }).default(true).notNull(),
  ...syncMetadata,
});

export const holidays = sqliteTable("holidays", {
  id: text("id").primaryKey().$defaultFn(generateId),
  date: text("date").notNull(),
  name: text("name").notNull(),
  ...syncMetadata,
});

export const studentDailyAttendance = sqliteTable(
  "student_daily_attendance",
  {
    id: text("id").primaryKey().$defaultFn(generateId),
    studentId: text("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    snapshotStudentName: text("snapshot_student_name"),
    snapshotStudentNis: text("snapshot_student_nis"),
    date: text("date").notNull(),
    checkInTime: integer("check_in_time", { mode: "timestamp" }),
    checkOutTime: integer("check_out_time", { mode: "timestamp" }),
    status: text("status", { enum: ["PRESENT", "LATE", "EXCUSED", "ABSENT"] })
      .default("PRESENT")
      .notNull(),
    lateDuration: integer("late_duration").default(0),
    ...syncMetadata,
  },
  (table) => ({
    dateIdx: index("sda_date_idx").on(table.date),
    studentIdx: index("sda_student_idx").on(table.studentId),
    uniqueDaily: uniqueIndex("unique_daily_student_attendance").on(
      table.studentId,
      table.date,
    ),
  }),
);

export const absensi = sqliteTable("absensi", {
  id: text("id").primaryKey().$defaultFn(generateId),
  siswaId: text("siswa_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  jadwalId: text("jadwal_id").references(() => jadwal.id),
  tanggal: integer("tanggal", { mode: "timestamp" }).notNull(),
  status: text("status").notNull(),
  keterangan: text("keterangan"),
  jamMasuk: text("jam_masuk"),
  jamKeluar: text("jam_keluar"),
  metodeAbsen: text("metode_absen"),
  ...syncMetadata,
});

export const absensiScanLogs = sqliteTable("absensi_scan_logs", {
  id: text("id").primaryKey().$defaultFn(generateId),
  absensiId: text("absensi_id").references(() => absensi.id),
  studentId: text("student_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  scanMethod: text("scan_method").notNull(),
  scanType: text("scan_type").notNull(),
  sessionId: text("session_id"),
  deviceId: text("device_id"),
  scannerUserId: text("scanner_user_id").references(() => users.id),
  scanTimestamp: integer("scan_timestamp", { mode: "timestamp" }).notNull(),
  ...syncMetadata,
});

export const studentIdCards = sqliteTable("student_id_cards", {
  id: text("id").primaryKey().$defaultFn(generateId),
  studentId: text("student_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull(),
  cardNumber: text("card_number").unique(),
  issuedAt: integer("issued_at", { mode: "timestamp" }).notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  revokedAt: integer("revoked_at", { mode: "timestamp" }),
  revokedReason: text("revoked_reason"),
  lastUsedAt: integer("last_used_at", { mode: "timestamp" }),
  ...syncMetadata,
});

export const absensiConfig = sqliteTable("absensi_config", {
  id: text("id").primaryKey().$defaultFn(generateId),
  key: text("key").unique().notNull(),
  toleranceMinutes: integer("tolerance_minutes").notNull().default(15),
  jamMasukNormal: text("jam_masuk_normal").notNull().default("07:00"),
  jamPulangNormal: text("jam_pulang_normal").notNull().default("14:00"),
  activeDays: text("active_days").notNull().default("1,2,3,4,5"),
  ...syncMetadata,
});

export const absensiExceptions = sqliteTable("absensi_exceptions", {
  id: text("id").primaryKey().$defaultFn(generateId),
  tanggal: integer("tanggal", { mode: "timestamp" }).notNull(),
  nama: text("nama").notNull(),
  tipe: text("tipe").notNull().default("libur"),
  keterangan: text("keterangan"),
  isSetengahHari: integer("is_setengah_hari", { mode: "boolean" })
    .notNull()
    .default(false),
  jamPulangCepat: text("jam_pulang_cepat"),
  ...syncMetadata,
});

// --- 4. NILAI & RAPORT ---

export const nilai = sqliteTable("nilai", {
  id: text("id").primaryKey().$defaultFn(generateId),
  siswaId: text("siswa_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  guruMapelId: text("guru_mapel_id")
    .notNull()
    .references(() => guruMapel.id, { onDelete: "cascade" }),
  jenisPenilaian: text("jenis_penilaian").notNull(),
  kdKe: integer("kd_ke"),
  nilai: integer("nilai").notNull(),
  semester: text("semester").notNull(),
  tahunAjaran: text("tahun_ajaran").notNull(),
  catatan: text("catatan"),
  ...syncMetadata,
});

export const raport = sqliteTable("raport", {
  id: text("id").primaryKey().$defaultFn(generateId),
  siswaId: text("siswa_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  kelasId: text("kelas_id")
    .notNull()
    .references(() => classes.id),
  semesterId: text("semester_id")
    .notNull()
    .references(() => semester.id),
  tahunAjaranId: text("tahun_ajaran_id")
    .notNull()
    .references(() => tahunAjaran.id),
  rataRata: integer("rata_rata"),
  ranking: integer("ranking"),
  sikapSpiritual: text("sikap_spiritual"),
  sikapSosial: text("sikap_sosial"),
  catatanWaliKelas: text("catatan_wali_kelas"),
  keputusan: text("keputusan"),
  tanggalTerbit: integer("tanggal_terbit", { mode: "timestamp" }),
  fileUrl: text("file_url"),
  ...syncMetadata,
});

// --- 5. FINANCE ---

export const kategoriBiaya = sqliteTable("kategori_biaya", {
  id: text("id").primaryKey().$defaultFn(generateId),
  nama: text("nama").notNull(),
  deskripsi: text("deskripsi"),
  tipe: text("tipe").notNull(),
  ...syncMetadata,
});

export const tagihan = sqliteTable("tagihan", {
  id: text("id").primaryKey().$defaultFn(generateId),
  siswaId: text("siswa_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  kategoriId: text("kategori_id")
    .notNull()
    .references(() => kategoriBiaya.id),
  nomorTagihan: text("nomor_tagihan").unique().notNull(),
  bulan: integer("bulan"),
  tahun: integer("tahun"),
  deskripsi: text("deskripsi"),
  jumlah: integer("jumlah").notNull(),
  jatuhTempo: integer("jatuh_tempo", { mode: "timestamp" }).notNull(),
  status: text("status").notNull().default("belum_lunas"),
  tanggalLunas: integer("tanggal_lunas", { mode: "timestamp" }),
  metodePembayaran: text("metode_pembayaran"),
  buktiPembayaran: text("bukti_pembayaran"),
  ...syncMetadata,
});

export const pembayaran = sqliteTable("pembayaran", {
  id: text("id").primaryKey().$defaultFn(generateId),
  tagihanId: text("tagihan_id")
    .notNull()
    .references(() => tagihan.id, { onDelete: "cascade" }),
  jumlah: integer("jumlah").notNull(),
  tanggalBayar: integer("tanggal_bayar", { mode: "timestamp" }).notNull(),
  metode: text("metode").notNull(),
  referensi: text("referensi"),
  catatan: text("catatan"),
  ...syncMetadata,
});

// --- 6. COMMUNICATION ---

export const pengumuman = sqliteTable("pengumuman", {
  id: text("id").primaryKey().$defaultFn(generateId),
  judul: text("judul").notNull(),
  konten: text("konten").notNull(),
  lampiran: text("lampiran"),
  targetRole: text("target_role"),
  targetKelasId: text("kelas_id").references(() => classes.id),
  publishedAt: integer("published_at", { mode: "timestamp" }),
  createdBy: text("created_by").references(() => users.id),
  ...syncMetadata,
});

export const notifikasi = sqliteTable("notifikasi", {
  id: text("id").primaryKey().$defaultFn(generateId),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  judul: text("judul").notNull(),
  pesan: text("pesan").notNull(),
  tipe: text("tipe"),
  link: text("link"),
  isRead: integer("is_read", { mode: "boolean" }).notNull().default(false),
  ...syncMetadata,
});

export const percakapan = sqliteTable("percakapan", {
  id: text("id").primaryKey().$defaultFn(generateId),
  nama: text("nama"),
  tipe: text("tipe").notNull(),
  createdBy: text("created_by").references(() => users.id),
  ...syncMetadata,
});

export const pesertaPercakapan = sqliteTable("peserta_percakapan", {
  id: text("id").primaryKey().$defaultFn(generateId),
  percakapanId: text("percakapan_id")
    .notNull()
    .references(() => percakapan.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  lastReadAt: integer("last_read_at", { mode: "timestamp" }),
  ...syncMetadata,
});

export const pesan = sqliteTable("pesan", {
  id: text("id").primaryKey().$defaultFn(generateId),
  percakapanId: text("percakapan_id")
    .notNull()
    .references(() => percakapan.id, { onDelete: "cascade" }),
  pengirimId: text("pengirim_id")
    .notNull()
    .references(() => users.id),
  konten: text("konten").notNull(),
  tipeKonten: text("tipe_konten").default("text"),
  lampiran: text("lampiran"),
  isDeleted: integer("is_deleted", { mode: "boolean" }).default(false),
  ...syncMetadata,
});

// --- 7. LIBRARY ---

export const buku = sqliteTable("buku", {
  id: text("id").primaryKey().$defaultFn(generateId),
  isbn: text("isbn"),
  judul: text("judul").notNull(),
  pengarang: text("pengarang"),
  penerbit: text("penerbit"),
  tahunTerbit: integer("tahun_terbit"),
  jumlahEksemplar: integer("jumlah_eksemplar").notNull().default(1),
  lokasi: text("lokasi"),
  deskripsi: text("deskripsi"),
  kategori: text("kategori"),
  ...syncMetadata,
});

export const anggotaPerpustakaan = sqliteTable("anggota_perpustakaan", {
  id: text("id").primaryKey().$defaultFn(generateId),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  nomorAnggota: text("nomor_anggota").unique().notNull(),
  tanggalDaftar: integer("tanggal_daftar", { mode: "timestamp" }).notNull(),
  status: text("status").notNull().default("aktif"),
  ...syncMetadata,
});

export const peminjamanBuku = sqliteTable("peminjaman_buku", {
  id: text("id").primaryKey().$defaultFn(generateId),
  anggotaId: text("anggota_id")
    .notNull()
    .references(() => anggotaPerpustakaan.id, { onDelete: "cascade" }),
  bukuId: text("buku_id")
    .notNull()
    .references(() => buku.id, { onDelete: "cascade" }),
  tanggalPinjam: integer("tanggal_pinjam", { mode: "timestamp" }).notNull(),
  tanggalJatuhTempo: integer("tanggal_jatuh_tempo", {
    mode: "timestamp",
  }).notNull(),
  tanggalKembali: integer("tanggal_kembali", { mode: "timestamp" }),
  denda: integer("denda"),
  status: text("status").notNull().default("dipinjam"),
  petugasId: text("petugas_id").references(() => users.id),
  ...syncMetadata,
});

// --- 8. HR ---

export const pegawai = sqliteTable("pegawai", {
  id: text("id").primaryKey().$defaultFn(generateId),
  userId: text("user_id")
    .notNull()
    .unique()
    .references(() => users.id, { onDelete: "cascade" }),
  nip: text("nip").unique(),
  statusKepegawaian: text("status_kepegawaian"),
  tanggalMasuk: integer("tanggal_masuk", { mode: "timestamp" }),
  tanggalKeluar: integer("tanggal_keluar", { mode: "timestamp" }),
  jabatan: text("jabatan"),
  departemen: text("departemen"),
  gajiPokok: integer("gaji_pokok"),
  tunjangan: integer("tunjangan"),
  nomorRekening: text("nomor_rekening"),
  bank: text("bank"),
  ...syncMetadata,
});

export const cuti = sqliteTable("cuti", {
  id: text("id").primaryKey().$defaultFn(generateId),
  pegawaiId: text("pegawai_id")
    .notNull()
    .references(() => pegawai.id, { onDelete: "cascade" }),
  jenisCuti: text("jenis_cuti"),
  tanggalMulai: integer("tanggal_mulai", { mode: "timestamp" }).notNull(),
  tanggalSelesai: integer("tanggal_selesai", { mode: "timestamp" }).notNull(),
  alasan: text("alasan"),
  status: text("status").notNull().default("pending"),
  disetujuiOleh: text("disetujui_oleh").references(() => users.id),
  catatanPersetujuan: text("catatan_persetujuan"),
  ...syncMetadata,
});

export const gajiPegawai = sqliteTable("gaji_pegawai", {
  id: text("id").primaryKey().$defaultFn(generateId),
  pegawaiId: text("pegawai_id")
    .notNull()
    .references(() => pegawai.id, { onDelete: "cascade" }),
  bulan: integer("bulan").notNull(),
  tahun: integer("tahun").notNull(),
  gajiPokok: integer("gaji_pokok").notNull(),
  tunjangan: integer("tunjangan").notNull().default(0),
  potongan: integer("potongan").notNull().default(0),
  bonus: integer("bonus").notNull().default(0),
  totalGaji: integer("total_gaji").notNull(),
  keterangan: text("keterangan"),
  ...syncMetadata,
});

// --- 9. INVENTORY ---

export const kategoriInventaris = sqliteTable("kategori_inventaris", {
  id: text("id").primaryKey().$defaultFn(generateId),
  nama: text("nama").notNull(),
  ...syncMetadata,
});

export const aset = sqliteTable("aset", {
  id: text("id").primaryKey().$defaultFn(generateId),
  kode: text("kode").unique().notNull(),
  nama: text("nama").notNull(),
  kategoriId: text("kategori_id").references(() => kategoriInventaris.id),
  deskripsi: text("deskripsi"),
  lokasi: text("lokasi"),
  kondisi: text("kondisi"),
  status: text("status"),
  tanggalPerolehan: integer("tanggal_perolehan", { mode: "timestamp" }),
  nilaiPerolehan: integer("nilai_perolehan"),
  masaManfaat: integer("masa_manfaat"),
  ...syncMetadata,
});

export const peminjamanAset = sqliteTable("peminjaman_aset", {
  id: text("id").primaryKey().$defaultFn(generateId),
  asetId: text("aset_id")
    .notNull()
    .references(() => aset.id, { onDelete: "cascade" }),
  peminjamId: text("peminjam_id")
    .notNull()
    .references(() => users.id),
  tanggalPinjam: integer("tanggal_pinjam", { mode: "timestamp" }).notNull(),
  tanggalRencanaKembali: integer("tanggal_rencana_kembali", {
    mode: "timestamp",
  }),
  tanggalKembali: integer("tanggal_kembali", { mode: "timestamp" }),
  keperluan: text("keperluan"),
  status: text("status").notNull().default("dipinjam"),
  ...syncMetadata,
});

export const stokBarang = sqliteTable("stok_barang", {
  id: text("id").primaryKey().$defaultFn(generateId),
  kode: text("kode").unique().notNull(),
  nama: text("nama").notNull(),
  kategoriId: text("kategori_id").references(() => kategoriInventaris.id),
  deskripsi: text("deskripsi"),
  satuan: text("satuan").notNull().default("pcs"),
  stokSaatIni: integer("stok_saat_ini").notNull().default(0),
  stokMinimum: integer("stok_minimum").notNull().default(10),
  hargaSatuan: integer("harga_satuan"),
  lokasiPenyimpanan: text("lokasi_penyimpanan"),
  ...syncMetadata,
});

export const transaksiStok = sqliteTable("transaksi_stok", {
  id: text("id").primaryKey().$defaultFn(generateId),
  barangId: text("barang_id")
    .notNull()
    .references(() => stokBarang.id, { onDelete: "cascade" }),
  tipe: text("tipe").notNull(),
  jumlah: integer("jumlah").notNull(),
  stokSebelum: integer("stok_sebelum").notNull(),
  stokSesudah: integer("stok_sesudah").notNull(),
  keterangan: text("keterangan"),
  referensi: text("referensi"),
  userId: text("user_id").references(() => users.id),
  ...syncMetadata,
});

// --- 10. TRANSPORT ---

export const kendaraan = sqliteTable("kendaraan", {
  id: text("id").primaryKey().$defaultFn(generateId),
  nomorPolisi: text("nomor_polisi").unique().notNull(),
  merk: text("merk"),
  model: text("model"),
  kapasitas: integer("kapasitas"),
  sopirId: text("sopir_id").references(() => users.id),
  rute: text("rute"),
  ...syncMetadata,
});

// --- RELATIONS ---

export const usersRelations = relations(users, ({ many, one }) => ({
  userRoles: many(userRoles),
  guruMapel: many(guruMapel),
  kelas: one(classes, {
    fields: [users.kelasId],
    references: [classes.id],
  }),
}));

export const classesRelations = relations(classes, ({ many, one }) => ({
  students: many(users),
  homeroomTeacher: one(users, {
    fields: [classes.homeroomTeacherId],
    references: [users.id],
  }),
}));

// --- TYPE EXPORTS ---
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Student = typeof students.$inferSelect;
export type NewStudent = typeof students.$inferInsert;
export type Class = typeof classes.$inferSelect;
export type NewClass = typeof classes.$inferInsert;
export type Subject = typeof subjects.$inferSelect;
export type NewSubject = typeof subjects.$inferInsert;
export type AttendanceSetting = typeof attendanceSettings.$inferSelect;
export type NewAttendanceSetting = typeof attendanceSettings.$inferInsert;
export type Holiday = typeof holidays.$inferSelect;
export type NewHoliday = typeof holidays.$inferInsert;
export type StudentDailyAttendanceEntry =
  typeof studentDailyAttendance.$inferSelect;
export type NewStudentDailyAttendanceEntry =
  typeof studentDailyAttendance.$inferInsert;
export type StudentIdCard = typeof studentIdCards.$inferSelect;
