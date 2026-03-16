# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

EduCore is a local-first, hybrid desktop (Tauri v2) + web (Next.js 16) school management system (Sistem Manajemen Sekolah Terpadu) built with TypeScript, React 19, and SQLite/Drizzle ORM.

## Development Commands

```bash
# Development
bun run dev              # Start Next.js dev server on http://localhost:3000

# Build
bun run build            # Production build (static export to ./out)

# Code Quality
bun run lint              # Biome linting
bun run format            # Biome auto-format
bun run typecheck         # TypeScript type checking

# Database
bun run db:generate       # Generate Drizzle migrations from schema changes
bun run db:migrate        # Run database migrations
bun run db:studio         # Open Drizzle Studio

# E2E Testing (Playwright)
bun run test              # Run all Playwright tests
bun run test:ui           # Run tests with UI
bun run test:debug        # Debug tests

# Desktop (Tauri)
cd src-tauri && cargo tauri build   # Build desktop application
```

## Architecture

### Runtime Environment Detection

The app runs in two environments:
- **Tauri Desktop**: SQLite via `@tauri-apps/plugin-sql`, local-first
- **Web Browser**: Turso (libSQL)

Use `isTauri()` and `isWeb()` from `src/core/env.ts` to detect runtime. Never access Tauri APIs on web.

### Database Layer

- **Schema**: Single source of truth in `src/core/db/schema.ts`
- **Connection**: `src/core/db/connection.ts` abstracts Tauri SQLite vs web API
- **Types**: Auto-derived from schema via `InferSelectModel`/`InferInsertModel` in `src/types/index.ts`
- **Migrations**: Managed by Drizzle Kit (`drizzle/migrations/`)

All tables include: `id` (UUID v7), `version`, `createdAt`, `updatedAt`, `deletedAt` (soft delete).

### Sync Engine

Offline-first sync using Hybrid Logical Clock (HLC):
- `src/core/sync/hlc.ts` - HLC timestamp generation and comparison
- `src/core/sync/engine.ts` - Background sync queue with conflict resolution (Last-Write-Wins)
- Conflict resolution: Compare HLC timestamps, newer wins

### Service Layer Pattern

Business logic lives in `src/core/services/*.ts`. Services:
- Use `getDatabase()` for queries
- Return typed results from `src/types/index.ts`
- Handle soft deletes (`deleted_at IS NULL`)

Example: `src/core/services/master-data-service.ts`

### State Management

- **Global state**: Zustand (`src/stores/`)
- **URL state**: Nuqs for search params
- **No manual `useMemo`/`useCallback`** - React 19 Compiler handles optimization

### Key Directories

```
src/
├── app/                    # Next.js App Router pages
├── components/
│   ├── accessibility/      # WCAG 2.2 components (SkipLink, FocusTrap)
│   ├── layout/             # MainLayout, Sidebar
│   ├── providers/          # ThemeProvider, DatabaseInitProvider
│   ├── sync/               # SyncStatusIndicator
│   └── ui/                  # shadcn/ui components
├── core/
│   ├── db/                  # Schema, connection, migrations
│   ├── services/            # CRUD services for each domain
│   ├── sync/                # HLC and sync engine
│   ├── validation/          # Zod schemas
│   └── env.ts               # Runtime detection utilities
├── hooks/                   # Custom React hooks
├── stores/                  # Zustand stores
├── types/                   # TypeScript types derived from Drizzle
└── lib/                     # Utilities
tests/
├── fixtures/                # Test data fixtures
├── page-objects/            # Playwright page objects
└── *.spec.ts                # E2E test files
```

## Code Conventions

### TypeScript
- **Strict mode enabled** - no `any`, no `@ts-ignore`
- Path alias: `@/` maps to `./src/`
- Types derived from Drizzle schema, not manually defined

### Database Queries
Services use raw SQL via the `DatabaseConnection` interface:
```typescript
const db = getDatabase();
const results = await db.select<SomeType>(
  `SELECT * FROM table WHERE deleted_at IS NULL`,
  [params]
);
```

### Soft Deletes
All tables support soft delete. Queries must filter:
```typescript
`SELECT * FROM users WHERE deleted_at IS NULL`
```

### React Patterns
- Use `useOptimistic` for instant UI feedback
- Use `useFormStatus` for granular loading states
- Error handling via Sonner toasts
- WCAG 2.2 AA compliance required (keyboard nav, focus management)

### Styling
- Tailwind CSS v4 with CSS variables
- Dark theme default (OLED friendly)
- Framer Motion for animations

## Testing

Playwright E2E tests with page object pattern:
```typescript
// tests/page-objects/base-page.ts provides common methods
// tests/auth.spec.ts has login test examples
```

Run tests against `http://localhost:3000` - webServer starts automatically in config.

## Important Files

- `src/core/db/schema.ts` - All database table definitions
- `src/core/db/connection.ts` - Database connection abstraction
- `src/core/sync/engine.ts` - Sync queue management
- `src/types/index.ts` - TypeScript types for all entities
- `.cursorrules` - Full development guidelines and tech stack rules

## Default Credentials

```
Admin: admin / admin123
Guru: guru / guru123
Staff: staff / staff123
```

## Environment Variables

```env
DATABASE_URL=file:./local.db           # Local SQLite path
GOOGLE_GENERATIVE_AI_API_KEY=...       # AI features (optional)
NEXT_PUBLIC_APP_NAME=EduCore
NEXT_PUBLIC_APP_VERSION=1.0.0
```

## Planning (This is for reference only, do not modify)

# 📋 RENCANA PENGEMBANGAN APLIKASI EDUCORE
## Pendekatan Terstruktur, Incremental, dan Quality‑First

Dokumen ini adalah **master plan** pengembangan EduCore. Setiap fase dirancang untuk membangun fondasi yang kokoh, menghindari utang teknis, dan memastikan setiap fitur siap digunakan secara **offline‑first** serta dapat **diuji** sebelum melanjutkan ke fase berikutnya.

---

## 🧱 FASE 0: INISIALISASI & PERSIAPAN LINGKUNGAN
*Tujuan: Memastikan environment development sesuai stack, setup tooling, dan konfigurasi dasar.*

### 📌 Aktivitas
1. **Verifikasi environment** (Tauri v2, Next.js 16, React 19, Bun, Tailwind v4, Drizzle).
2. **Inisialisasi monorepo** (opsional) atau struktur proyek terpisah untuk desktop dan web dengan shared code (`packages/`).
3. **Setup tooling**:
   - Biome untuk linting/formatting.
   - Husky + lint-staged untuk pre-commit hooks.
   - Vitest + React Testing Library + Playwright.
4. **Konfigurasi Tauri**:
   - Atur `tauri.conf.json` dengan identifier unik.
   - Definisikan `capabilities` minimal (hanya izin baca/tulis file di direktori app, akses keychain).
   - Setup CSP ketat.
5. **Bootstrap Next.js**:
   - App Router, layout dasar.
   - Integrasi Tailwind v4 + shadcn/ui (dengan theming dark default).
   - Setup font Geist.
6. **Buat shared package** untuk:
   - Typescript definitions global.
   - Utility functions (format tanggal, dll).
   - Zod schemas dasar.
   - Drizzle schema (akan diisi bertahap).

### ✅ Definition of Done
- Bisa menjalankan `bun dev` untuk web dan `bun tauri dev` untuk desktop tanpa error.
- Halaman “Hello World” menampilkan state runtime (web/desktop).
- Test runner berjalan.

---

## 🗄️ FASE 1: FONDASI DATA & AUTHENTIKASI
*Tujuan: Membangun inti data yang akan digunakan semua modul.*

### 📌 Aktivitas
1. **Setup database lokal (SQLite encrypted)**:
   - Integrasi Tauri plugin SQL dengan SQLCipher.
   - Buat service untuk inisialisasi DB, migrasi, dan koneksi.
2. **Setup Drizzle ORM**:
   - Buat schema awal: `users`, `roles`, `permissions`, `user_roles`, `sessions`.
   - Generate migrasi dengan `drizzle-kit`.
3. **Implementasi autentikasi**:
   - **Desktop**: Gunakan Tauri plugin `authenticator` atau simpan hash di SQLite dengan Argon2id.
   - **Web**: NextAuth.js (Auth.js) dengan provider credentials (fallback) dan OAuth (opsional).
   - Shared logic validasi password via Zod.
4. **RBAC dasar**:
   - Seed data role: `admin`, `guru`, `staff`, `siswa`, `ortu`.
   - Middleware/guard untuk proteksi route dan command.
5. **Setup sync engine awal** (untuk user data):
   - Buat service `sync` dengan metode push/pull delta.
   - Gunakan Turso sebagai cloud DB (siapkan schema sama dengan lokal).
   - Implementasi HLC (Hybrid Logical Clock) untuk versioning.
   - Uji coba sinkronisasi akun antar device.

### ✅ Definition of Done
- Registrasi dan login berfungsi di web dan desktop.
- Session persist di desktop (via keychain) dan web (cookies/httpOnly).
- User bisa ganti password, logout.
- Data user tersinkronisasi antar device (misal: ubah profil di web muncul di desktop setelah sync).

---

## 🧑‍🏫 FASE 2: MANAJEMEN AKADEMIK INTI
*Tujuan: Modul yang langsung digunakan untuk operasional sehari‑hari.*

### 📌 Aktivitas
2.1 **Master Data**  
   - Schema: `tahun_ajaran`, `semester`, `kelas`, `mata_pelajaran`, `guru_mapel`.  
   - CRUD + validasi Zod.  
   - UI dengan tabel (shadcn/ui data-table), form, filter.  
   - Sync enabled.

2.2 **Jadwal Pelajaran**  
   - Schema: `jadwal` (relasi ke kelas, guru_mapel, ruang, waktu).  
   - Tampilan grid mingguan (drag‑drop untuk atur jadwal).  
   - **AI‑assisted**: Generate jadwal otomatis hindari bentrok (gunakan algoritma genetika sederhana dulu, bisa ditingkatkan dengan AI nanti).  
   - Notifikasi perubahan jadwal (internal event → nanti di fase komunikasi).

2.3 **Absensi** (versi manual & QR)  
   - Schema: `absensi` (siswa, jadwal/hari, status, waktu).  
   - Mode offline: simpan lokal, antri sync.  
   - Guru pilih kelas, lihat daftar siswa, tandai hadir/sakit/izin/alpha.  
   - **QR Code**: Generate QR per pertemuan, siswa scan (gunakan kamera via Tauri atau web).  
   - Rekap harian/bulanan dalam bentuk grafik.

2.4 **Keuangan Dasar**  
   - Schema: `tagihan`, `pembayaran`, `kategori_biaya`.  
   - Buat tagihan manual atau otomatis (berdasarkan rule per siswa).  
   - Catat pembayaran tunai/transfer (upload bukti opsional).  
   - Hitung tunggakan.  
   - Laporan sederhana (Excel/PDF).

### ✅ Definition of Done per Sub‑Modul
- CRUD berfungsi offline dan sync.
- UI responsif, aksesibel.
- Test coverage >70% untuk logic kritis.

---

## 🔗 FASE 3: KOMUNIKASI & NOTIFIKASI
*Tujuan: Membangun sistem notifikasi dan pesan real‑time.*

### 📌 Aktivitas
1. **Infrastruktur real‑time**:
   - Untuk web: gunakan Server‑Sent Events (SSE) atau WebSocket (dengan `serverActions` tidak cocok untuk real‑time). Bisa pakai `pusher` atau `ably` jika tidak ingin kelola sendiri.
   - Untuk desktop: gunakan Tauri IPC + event dari Rust ke frontend.
2. **Pengumuman**:
   - Schema: `announcements` (judul, konten, lampiran, target role/kategori).
   - Fitur broadcast ke semua atau grup.
   - Tampilkan di dashboard.
3. **Notifikasi push**:
   - Untuk web: Service Worker + Web Push API.
   - Untuk desktop: Tauri notification plugin.
   - Notifikasi event: absen masuk, tagihan jatuh tempo, pengumuman baru.
4. **Pesan internal (chat)** sederhana:
   - Schema: `conversations`, `messages`.
   - Real‑time update.
   - Enkripsi end‑to‑end opsional (gunakan Web Crypto API).

### ✅ Definition of Done
- Pengguna menerima notifikasi saat ada pengumuman.
- Chat antar pengguna berfungsi real‑time (dengan fallback polling saat offline).
- Notifikasi tersimpan dan bisa dilihat riwayat.

---

## 📚 FASE 4: MODUL LANJUTAN (PERPUSTAKAAN, HR, INVENTARIS, DLL)
*Tujuan: Menambahkan fitur pendukung sesuai kebutuhan sekolah.*

### 📌 Aktivitas (dapat diparalelkan)
4.1 **Perpustakaan**  
   - Katalog buku, barcode, peminjaman, denda.  
   - Scan buku/kartu anggota via kamera.

4.2 **HR & Penggajian**  
   - Data pegawai, cuti, izin.  
   - Payroll dengan komponen gaji.  
   - Slip gaji PDF.

4.3 **Inventaris & Aset**  
   - Daftar aset, peminjaman, stok habis pakai.  
   - Notifikasi stok menipis.

4.4 **Transportasi & Asrama** (jika relevan)  
   - Manajemen rute, kendaraan, absensi penjemputan.  
   - Asrama: kamar, penghuni, absensi asrama.

Setiap sub‑modul mengikuti pola yang sama:  
   - Schema Drizzle.  
   - Zustand store + persist.  
   - Sync delta.  
   - UI komponen.  
   - Validasi Zod.

### ✅ Definition of Done
- Semua modul dapat digunakan offline.
- Data sinkron dengan cloud saat online.
- Tidak ada error lint/test.

---

## 🤖 FASE 5: AI & ANALITIK
*Tujuan: Menambahkan kecerdasan buatan untuk meningkatkan nilai aplikasi.*

### 📌 Aktivitas
1. **Setup Vercel AI SDK** dengan provider:
   - Gemini Flash 2.0 untuk cloud tasks.
   - Chrome Built‑in AI (Nano) untuk tasks lokal (jika browser support).
2. **Asisten Virtual (Chatbot)**:
   - Konteks: jadwal, tagihan, pengumuman.
   - RAG sederhana dengan data lokal.
3. **Generate Komentar Raport**:
   - Input nilai dan catatan guru → AI buat paragraf deskriptif.
4. **Prediksi Siswa Berisiko**:
   - Model analitik berdasarkan kehadiran, nilai, perilaku.
   - Tampilkan di dashboard konselor.
5. **Gamifikasi** (poin, badge) berdasarkan aturan yang bisa dikonfigurasi.
6. **Adaptive Learning** (rekomendasi materi) – mulai sederhana, bisa diperluas.

### ✅ Definition of Done
- Fitur AI berjalan di web dan desktop (dengan fallback jika tidak ada AI lokal).
- Privasi terjaga: data sensitif tidak dikirim ke cloud.
- User bisa mengaktifkan/menonaktifkan fitur AI.

---

## 🧪 FASE 6: PENGUJIAN, OPTIMASI & PRODUCTION READY
*Tujuan: Memastikan aplikasi stabil, aman, dan siap digunakan di dunia nyata.*

### 📌 Aktivitas
1. **Pengujian End‑to‑End**:
   - Playwright untuk skenario kritis (login, absen, pembayaran).
   - Simulasi offline mode.
2. **Penetration Testing**:
   - Audit keamanan Tauri (capabilities minimal).
   - Cek CSP, SQL injection, XSS.
3. **Performance Profiling**:
   - Web: Lighthouse target LCP ≤2s, INP <150ms.
   - Desktop: cold start <800ms, memory usage.
4. **Dokumentasi**:
   - Panduan instalasi untuk desktop.
   - Panduan penggunaan untuk tiap role.
   - ADR (Architecture Decision Records) untuk keputusan penting.
5. **Deployment**:
   - Web: Vercel (dengan environment variables aman).
   - Desktop: Build dan distribusi (GitHub Releases, atau store).
   - CI/CD: GitHub Actions untuk test dan build otomatis.

### ✅ Definition of Done
- Semua test pass.
- Tidak ada critical vulnerability.
- Aplikasi dapat diakses publik (web) dan diinstall (desktop).

---

## 🔁 FASE 7: MAINTENANCE & ITERASI
*Tujuan: Merespon feedback dan menambah fitur baru.*

- Monitoring error dengan OpenTelemetry.
- Rilis patch dan minor update.
- Koleksi feedback pengguna untuk perbaikan UX.
- Evaluasi adopsi fitur AI dan modul lanjutan.

---

## 📊 PRIORITAS & TIMELINE (ESTIMASI)

| Fase | Estimasi Waktu | Ketergantungan |
|------|----------------|----------------|
| 0    | 3 hari         | -              |
| 1    | 1 minggu       | Fase 0         |
| 2    | 3 minggu       | Fase 1         |
| 3    | 2 minggu       | Fase 2 (jadwal, notifikasi bisa jalan paralel) |
| 4    | 4 minggu       | Bisa paralel setelah Fase 2 selesai |
| 5    | 3 minggu       | Fase 2 (data tersedia) |
| 6    | 2 minggu       | Semua fitur inti selesai |
| 7    | Berkelanjutan  | -              |

**Catatan**: Waktu dapat disesuaikan dengan ketersediaan tim. Prioritas utama: Fase 0–2 agar sekolah bisa mulai menggunakan modul inti (akademik, absensi, keuangan) secepatnya.

---

## 📝 CHECKLIST KELENGKAPAN (Agar Tidak Ada yang Terlewat)

- [ ] Sudahkah setiap modul memiliki schema Drizzle?
- [ ] Apakah setiap operasi tulis memiliki optimistic update?
- [ ] Apakah setiap input tervalidasi Zod di frontend dan backend (Tauri command / server action)?
- [ ] Apakah sync engine menangani conflict dengan HLC?
- [ ] Apakah ada audit log untuk data sensitif?
- [ ] Apakah Tauri capabilities sudah dibatasi sesuai kebutuhan?
- [ ] Apakah semua teks sudah mendukung RTL (jika diperlukan)?
- [ ] Apakah sudah diuji dengan screen reader (NVDA, VoiceOver)?
- [ ] Apakah ada mekanisme backup database lokal?
- [ ] Apakah dokumentasi pengguna tersedia?

---

Dengan rencana ini, kita memiliki peta jalan yang jelas, terurut, dan komprehensif. Setiap fase menghasilkan produk yang dapat diuji dan digunakan, sehingga risiko besar dapat dihindari. Jika ada pertanyaan atau penyesuaian, silakan diskusikan. Saya siap membantu memulai dari **Fase 0**.

## Features (this is also for reference)

# 📚 EduCore – Rancangan Fitur Lengkap Aplikasi Manajemen Sekolah Modern

Berdasarkan permintaan, saya susun **EduCore** sebagai platform manajemen sekolah **hybrid (Desktop + Web)** dengan arsitektur **local‑first**, **AI‑enhanced**, dan **UX setara aplikasi consumer‑grade**. Semua fitur dirancang mengikuti **immutable tech stack** yang telah ditetapkan.

---

## 🧩 MODUL UTAMA & FITUR DETAIL

### 1. Manajemen Pengguna & Peran (User & Role Management)
- **Multi‑role**: Admin, Guru, Staff Tata Usaha, Siswa, Orang Tua/Wali.
- **Single Sign‑On (SSO)** via Google/Microsoft (opsional) dengan fallback email/password (Argon2id + salt).
- **Profile lengkap**: Foto, biodata, dokumen pendukung (ijazah, KTP) – disimpan secara encrypted di local SQLite, cloud hanya metadata.
- **Role‑Based Access Control (RBAC)** dengan permission granular (misal: Guru hanya bisa lihat kelasnya sendiri).
- **Bulk import/export** via CSV/Excel (dengan validasi Zod).
- **Delegasi akses** (misal: wali kelas bisa melihat data siswa di kelasnya).

### 2. Akademik (Academic Management)
- **Tahun Ajaran & Semester**: Fleksibel, bisa multiple.
- **Kelas & Kelompok Belajar**: Support paralel (Kelas 7A, 7B, ...).
- **Mata Pelajaran**: Bisa dikaitkan dengan guru pengajar.
- **Kurikulum**:
  - Struktur kurikulum (standar kompetensi, kompetensi dasar, topik).
  - Pemetaan ke mata pelajaran dan kelas.
- **Jadwal Pelajaran (Timetable)**:
  - Generator jadwal otomatis berbasis AI (hindari bentrok guru/ruang).
  - Tampilan grid interaktif (drag‑drop untuk penyesuaian manual).
  - Notifikasi perubahan jadwal ke guru dan siswa via push.
- **Materi Ajar & Tugas**:
  - Unggah file (PDF, video, link) – disimpan di local dengan indexing.
  - Tugas: deadline, pengumpulan online, penilaian (rubrik).
  - **Offline‑first**: Guru bisa buat tugas tanpa internet, sinkron saat online.
- **Nilai & Raport**:
  - Input nilai per KD, per tugas, UTS, UAS.
  - Bobot nilai dapat diatur.
  - Generate raport dalam format PDF (custom template per sekolah).
  - Analisis capaian siswa per mata pelajaran.

### 3. Absensi (Attendance)
- **Multi‑metode**:
  - Manual (guru input daftar hadir).
  - **QR Code** (siswa scan QR di kelas).
  - **Facial Recognition** (menggunakan kamera device, dengan Tauri plugin atau WebRTC + AI lokal via WebLLM/Chrome Built‑in AI).
  - **NFC/RFID** (untuk desktop dengan reader eksternal, via Tauri).
- **Geofencing** (opsional): Validasi lokasi siswa saat absen (untuk sekolah dengan device khusus).
- **Rekap harian, bulanan, dan persentase kehadiran**.
- **Notifikasi otomatis** ke orang tua jika siswa tidak hadir (bisa diatur batas waktu).
- **Offline‑first**: Data absen disimpan lokal, sinkron saat koneksi tersedia.

### 4. Keuangan (Finance & Fee Management)
- **Pembayaran SPP, Uang Pangkal, dll.**:
  - Tagihan otomatis berdasarkan aturan (bulanan, per semester).
  - Berbagai metode pembayaran: tunai, transfer, kartu, **QRIS**, integrasi payment gateway (Midtrans/Xendit).
  - **Offline payment**: Kasir dapat mencatat pembayaran tunai offline, data tetap tersimpan lokal dan sinkron.
- **Manajemen Anggaran & Pengeluaran**:
  - Catat pengeluaran sekolah (belanja, gaji, dll).
  - Laporan arus kas, laba rugi, neraca.
- **Beasiswa & Potongan**:
  - Atur beasiswa persentase/nominal, otomatis terapkan ke tagihan.
- **Riwayat transaksi** dengan filter dan ekspor ke Excel/PDF.
- **Notifikasi jatuh tempo** ke orang tua via WhatsApp/Email (integrasi layanan).

### 5. Komunikasi & Notifikasi (Communication)
- **Pengumuman & Berita Sekolah**:
  - Dikirim ke semua atau per grup (kelas, guru, dll).
  - Bisa menyertakan lampiran.
- **Pesan Internal (Chat)**:
  - Antar pengguna (guru ke guru, guru ke wali murid, dll).
  - Dukungan grup (kelas, komite).
  - End‑to‑end encryption untuk chat sensitif.
- **Notifikasi Push**:
  - Real‑time via WebSocket atau SSE untuk web, dan native untuk desktop (Tauri).
  - Integrasi dengan Telegram/WhatsApp (opsional via bridge).
- **Kalender Sekolah**:
  - Jadwal ujian, libur, acara.
  - Sinkron ke Google Calendar/ICS.

### 6. Perpustakaan (Library Management)
- **Katalog Buku**: ISBN, judul, pengarang, jumlah eksemplar.
- **Peminjaman & Pengembalian**:
  - Scan barcode buku dan kartu anggota.
  - Hitung denda otomatis jika terlambat.
  - Offline: data disimpan lokal, sinkron saat online.
- **Reservasi Buku**.
- **Laporan** buku populer, peminjaman per siswa.

### 7. Ujian & Penilaian (Examination)
- **Penjadwalan Ujian**:
  - Atur ruang, pengawas, peserta.
  - Cetak kartu ujian (QR code untuk validasi).
- **Pengelolaan Soal** (Bank Soal):
  - Soal pilihan ganda, essay, dengan tingkat kesulitan.
  - Dapat digunakan ulang lintas ujian.
- **Koreksi & Entry Nilai**:
  - Koreksi manual atau dengan AI untuk essay (Gemini Flash untuk saran penilaian).
  - Rekap nilai dan analisis butir soal.
- **Raport Ujian** terintegrasi dengan modul akademik.

### 8. Transportasi (Transport Management)
- **Rute & Kendaraan**: Data armada, sopir, rute.
- **Penjemputan/Antar**:
  - Siswa terdaftar per rute.
  - Absensi naik/turun via QR atau NFC (di dalam kendaraan).
- **Tracking real‑time** (jika ada GPS device) – peta.
- **Notifikasi** ke orang tua saat siswa naik/turun.

### 9. Asrama (Hostel Management)
- **Manajemen Kamar**: Tipe, kapasitas, fasilitas.
- **Penghuni**: Allotment siswa ke kamar.
- **Absensi Asrama** (keluar/masuk).
- **Komplain & Inventaris** asrama.

### 10. Inventaris & Aset (Inventory)
- **Daftar Aset**: Nama, kategori, lokasi, kondisi.
- **Peminjaman Aset** (misal proyektor, laptop) oleh guru/staff.
- **Stock Barang Habis Pakai** (ATK, alat kebersihan).
- Notifikasi stok menipis.

### 11. HR & Penggajian (HR & Payroll)
- **Data Kepegawaian**: Riwayat pekerjaan, dokumen, cuti.
- **Pengajuan Cuti & Izin**:
  - Workflow approval atasan.
  - Otomatis hitung sisa cuti.
- **Penggajian**:
  - Komponen gaji (pokok, tunjangan, lembur).
  - Generate slip gaji PDF.
  - Integrasi dengan modul keuangan untuk pembayaran.

### 12. Dashboard & Analitik (Analytics)
- **Dashboard Real‑time** untuk setiap role:
  - Admin: Ringkasan kehadiran, keuangan, kinerja guru.
  - Guru: Kelas, tugas akan datang, rekap nilai.
  - Orang Tua: Kehadiran anak, tagihan, pengumuman.
- **Grafik Interaktif** (Recharts) dengan filter rentang waktu.
- **AI Predictive Analytics**:
  - Prediksi siswa berisiko drop‑out berdasarkan kehadiran, nilai.
  - Rekomendasi intervensi (bimbingan).
- **Ekspor Laporan** (PDF/Excel) dengan template.

### 13. Fitur AI Canggih (AI‑Powered)
- **Asisten Virtual (Chatbot)**:
  - Menjawab pertanyaan umum (jadwal, tagihan, dll) via Vercel AI SDK.
  - Privasi: Pertanyaan sensitif diproses lokal dengan Chrome Built‑in AI.
- **Generate Komentar Raport** otomatis berdasarkan nilai dan catatan guru (Gemini Flash).
- **Deteksi Anomali Absensi** (misal siswa sering absen jam tertentu).
- **Rekomendasi Jadwal Belajar** untuk siswa berdasarkan performa.
- **Peringkasan Teks** untuk pengumuman panjang.

### 14. Offline‑First & Sinkronisasi
- **Semua fitur dapat digunakan tanpa internet**:
  - Absen, input nilai, catat pembayaran, dll.
- **Sinkronisasi otomatis** saat koneksi tersedia:
  - Delta sync (hanya perubahan) dengan mekanisme HLC/LWW.
  - Progress bar dan notifikasi sinkronisasi.
- **Konflik resolution**: Last‑Write‑Wins dengan versi dan timestamp.

### 15. Keamanan & Privasi
- **Enkripsi lokal** SQLite dengan SQLCipher (password dari keychain OS).
- **Audit log** semua aktivitas penting (siapa, kapan, apa).
- **Data minimization**: Cloud hanya menyimpan data yang diperlukan untuk sinkronisasi multi‑device.
- **GDPR‑style consent** untuk data sensitif.

### 16. Multi‑Platform & Pengalaman Pengguna
- **Desktop App (Tauri)**: Kinerja tinggi, akses ke hardware (kamera, NFC).
- **Web App (Next.js)**: Responsif, mobile‑first, bisa diinstall sebagai PWA.
- **Mode Gelap (Dark) default** dengan glassmorphism.
- **Aksesibilitas**: WCAG 2.2 AA, navigasi keyboard, screen reader support.

---

## 🏗️ ARSITEKTUR IMPLEMENTASI (Sesuai Tech Stack)

Setiap modul akan diimplementasikan dengan:

- **Schema Drizzle** terpisah namun saling terkait (foreign key).
- **Zustand store** per modul dengan persist middleware (untuk offline state).
- **Sync engine** custom menggunakan ElectricSQL pattern dengan Turso sebagai cloud backend.
- **Validasi Zod** untuk semua input dan data exchange.
- **Server Actions** di web, **Tauri Commands** di desktop untuk operasi I/O lokal.
- **UI Components** dari shadcn/ui, dikustomisasi dengan Tailwind v4.
- **Animasi** dengan Framer Motion + CSS View Transitions.

---

## 📋 PRIORITAS PENGEMBANGAN (Rekomendasi)

1. **Foundation**: Auth, User Management, RBAC, Database lokal + sync.
2. **Core Academic**: Kelas, Mata Pelajaran, Jadwal.
3. **Absensi** (offline‑first).
4. **Keuangan** (tagihan, pembayaran).
5. **Akademik lanjutan** (tugas, nilai, raport).
6. **Komunikasi & Notifikasi**.
7. **Modul pendukung** (perpustakaan, transport, asrama, dll).
8. **AI Features** (setelah data mencukupi).

---

**Kesimpulan**: EduCore akan menjadi solusi manajemen sekolah yang **modern, efisien, dan tangguh**—menggabungkan kekuatan desktop offline dengan fleksibilitas cloud, serta kecerdasan AI untuk meningkatkan kualitas pendidikan.

Silakan konfirmasi jika ada modul yang ingin ditambahkan/dikurangi, atau jika Anda ingin memulai dengan **step‑by‑step implementasi** (misal: setup proyek, schema awal, dll). Saya siap memandu.

# 🧠 SYSTEM ROLE

## SENIOR SOFTWARE ENGINEER & SYSTEM ARCHITECT (2026 ELITE · HYBRID DESKTOP + WEB)

Kamu adalah **Senior Software Engineer & System Architect kelas dunia**.
Kamu perfeksionis, disiplin, dan sangat peduli pada **arsitektur jangka panjang**, **UX berkualitas tinggi**, **aksesibilitas**, **keamanan**, dan **performa nyata di device pengguna**.
Kamu membimbing saya membangun aplikasi **hybrid: Desktop (Tauri v2) + Web** dari **nol hingga production‑ready**, standar **Awwwards-grade** (Mobile Excellence & Developer Award).
Kamu **tidak pernah asal menebak**, **tidak over‑engineering**, dan **tidak menoleransi technical debt**.
---

## 🏛️ IMMUTABLE TECH STACK (2026)

> Semua kode, saran, dan arsitektur **WAJIB** mematuhi stack ini.
Tidak ada diskusi mengganti stack kecuali saya minta eksplisit.

### 1️⃣ Platform & Runtime
- **Desktop**: **Tauri v2** (security‑hardened via Capabilities/ACL)
- **Web**: **Next.js 16 (App Router)** + **React 19+**
- **Bahasa**: **TypeScript (Strict Mode)** — ❌ no `any`, ❌ no `@ts-ignore`
- **Styling**: **Tailwind CSS v4** (CSS Variables Native + Container Queries)
- **Package Manager**: **bun** (mandatory)

### 2️⃣ Data & State
- **Local DB (Desktop)**: **SQLite (encrypted)** via Tauri Plugin SQL
- **Cloud DB (Web/Sync)**: **Turso (libSQL + RLS-ready)**
- **ORM**: **Drizzle ORM** — schema adalah **single source of truth**
- **State**: **Zustand** (global), **Nuqs** (URL state)
- **🆕 Sync Engine**: **Custom Replicator** (Push/Pull delta) atau **ElectricSQL** pattern.

### 3️⃣ UI / UX / Motion
- **Components**: **shadcn/ui (Radix UI)**
- **Icons**: **Lucide React**
- **Toasts**: **Sonner**
- **Typography**: **Geist**
- **Theme**: Dark default (OLED friendly) + Glassmorphism accents
- **Animation**: **Framer Motion** (layout transitions), **CSS View Transitions API** (page nav)
- **Aksesibilitas**: **WCAG 2.2 AA**, keyboard‑first, focus ring, **RTL first‑class**

### 4️⃣ AI (Hybrid Strategy) 🆕
- **Runtime**: **Vercel AI SDK Core**
- **Heavy Tasks**: **Google Gemini Flash 2.0/3 (Cloud)**
- **Privacy/Local Tasks**: **Chrome Built-in AI (Nano)** atau **WebLLM (WebGPU)** jika hardware mendukung.
- **Prinsip**: Privacy-first, explainable, controllable.

### 5️⃣ Tooling, Quality & Ops
- **Formatter/Linter**: **Biome** (Speed is key)
- **Testing**: Unit (**Vitest**), UI (**React Testing Library**), E2E (**Playwright**)
- **Observability**: **OpenTelemetry** traces (Rust + JS blended).

---

## 🧠 LOCAL‑FIRST DOCTRINE
- **Database lokal adalah source of truth utama pada desktop**
- Aplikasi **HARUS usable tanpa internet (Offline-First)**
- Cloud dipakai untuk **sync / backup / multi‑device**
- Sync: **background**, **optimistic**, **resilient terhadap failure**

---

## ⚠️ DESKTOP + NEXT.JS SSR POLICY (HYBRID)
- **Desktop build (Tauri)**:
  - **Tanpa Server Actions** dan **tanpa Node.js Runtime**.
  - Render: **SPA Mode (Static Export)**.
- Akses I/O lokal via **Tauri Commands (Rust)**.
- **Dilarang** spin‑up Node server / sidecar kecuali sangat krusial.
- **Web build (cloud)**:
  - Server Actions diperbolehkan.
- Cache wajib **eksplisit**: `"use cache"`, `revalidateTag`.
  - `Route Handlers` hanya untuk **webhooks / streaming**.
- **Runtime flag**: Gunakan `window.__TAURI_INTERNALS__` check atau env var untuk membedakan runtime.

---

## 🧷 LOCAL DATABASE POLICY (SQLite Default)
- **Desktop default**: **SQLite (encrypted/SQLCipher)**.
Drizzle sebagai ORM tunggal.
- **PGlite (WASM) / LibSQL (WASM)** diperbolehkan untuk environment web jika butuh paritas 1:1 dengan Turso.
- Migrasi **idempotent**. Schema Drizzle dikelola via `drizzle-kit`.
---

## 🔁 SYNC CONTRACT (Turso + LibSQL)
- **Identitas record**: `id` (UUID v7), `version` (BigInt), `updated_at`, `deleted_at` (Soft Delete).
- **Conflict policy**: **Last-Write-Wins (LWW)** based on Hybrid Logical Clock (HLC) jika memungkinkan.
- **Transport**: Batch JSON RPC, **Delta Sync** (hanya kirim yang berubah).
- **Keamanan**: RLS deny-by-default. Cloud tidak percaya input client (validate everything).

---

## 🛡️ SECURITY BASELINE (TAURI v2 + WEB)
- **🆕 Tauri Capabilities**: Gunakan `capabilities/*.json` untuk define permission scope. **Dilarang** `shell:allow-all`.
- **CSP Ketat**: Nonce-based, disable remote scripts.
- **Isolation Pattern**: Iframe untuk konten untrusted.
- **Secrets**: Gunakan **OS Keychain** via Tauri Plugin Store/Stronghold.
- Telemetry: Privacy-preserving (scrub PII).
- Turso: Database URL & Auth Token **haram** ada di Client bundle (Desktop) - gunakan via Sync Service.
---

## ⚠️ REACT COMPILER & PERF 🆕
- ❌ **JANGAN GUNAKAN** `useMemo` atau `useCallback` secara manual kecuali profiling menunjukkan bottleneck. Percayakan pada **React Compiler**.
- ✅ Gunakan `useOptimistic` untuk UI feedback instant (0ms latency feeling).
- ✅ Gunakan `useFormStatus` untuk loading states granular.
- **Web**: **LCP ≤ 2.0s**, **INP < 150ms**.
- **Desktop**: **Cold start < 800ms**.

---

## 📐 CODING STANDARDS
1. **Type‑Safety First**: Semua input luar (API/DB/User) divalidasi **Zod**.
2. **Composition > Inheritance**: Hindari prop drilling > 2 level.
3. **Logic Isolation**: Business logic di `hooks/` atau `core/` (pure TS), UI di `components/`.
4. **Error Handling**: `try/catch` dengan **Sonner** toast + logging. ❌ No silent errors.
5. **Clean Code**: Variable name deskriptif (English). ❌ No `console.log`.
---

## 🧭 REALITY CHECK GATE (BOOT)
- Saat inisialisasi, **verifikasi versi**: Tauri v2.x, Next.js 16+, React 19, Tailwind v4, Bun.
- Jika environment mismatch: **STOP** dan minta perbaikan environment.
---

## ⛔ STRICT WORKING RULES

### 1️⃣ NO ASSUMPTIONS
Jangan berasumsi tentang schema database atau logic lama. Minta konteks:
> **“Tolong perlihatkan kode [file] atau schema agar saya tidak merusak fitur eksisting.”**

### 2️⃣ STEP‑BY‑STEP EXECUTION
- ❌ Tidak ada wall of code.
- ✅ Pecah jadi:
  1) **Architecture/Config** (Capabilities, Env, Schema)
  2) **Core Logic** (Hooks, Zod, Services)
  3) **UI Implementation** (Components, Tailwind)
- **Tunggu konfirmasi "Lanjut"** tiap step.


### 3️⃣ SETUP IS KING
- Pastikan **Tauri IPC + Database Connection** sukses sebelum coding UI fitur.

---

## ✅ DEFINITION OF DONE
- Validasi Zod end‑to‑end
- Optimistic UI berjalan mulus
- A11y (Keyboard nav + Screen reader friendly)
- Tests (Unit/E2E) passed
- Dokumentasi singkat (ADR/Usage)
