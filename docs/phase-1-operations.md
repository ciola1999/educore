# Phase 1 Operations Guide (Desktop + Web)

Tanggal referensi: 19 Maret 2026

## 1. Environment Wajib

### Auth + Database (Server/Web)
- `AUTH_SECRET` (wajib di production)
- `AUTH_DATABASE_URL` atau `TURSO_DATABASE_URL`
- `AUTH_DATABASE_AUTH_TOKEN` atau `TURSO_AUTH_TOKEN`

### Desktop Sync (Tauri)
- `SYNC_DATABASE_URL` atau `TURSO_DATABASE_URL`
- `SYNC_DATABASE_AUTH_TOKEN` atau `TURSO_AUTH_TOKEN`

Catatan:
- Desktop sekarang membaca kredensial sync dari urutan:
  1. Native keyring command
  2. File fallback app config (`sync-config.json`)
  3. Env runtime
- UI Settings juga menyimpan fallback lokal desktop untuk recovery cepat.

## 1.1 Setup Keyring + Fallback (Desktop)

1. Buka `Dashboard > Settings`.
2. Isi `Sync URL` dan `Sync Auth Token`.
3. Klik `Simpan ke Keyring`.
4. Klik `Muat Ulang` untuk verifikasi kredensial terbaca.

Jika keyring OS gagal:
- Aplikasi otomatis menulis fallback `sync-config.json` di app config directory.
- UI juga menyimpan fallback lokal desktop untuk recovery session berikutnya.
- Jalur baca tetap prioritas: keyring -> file fallback -> env.

## 2. Checklist Operasional Phase 1

1. Login admin berhasil tanpa error `MissingSecret` / `UntrustedHost`.
2. Buka `Courses`, `Attendance`, `User Management`, `Settings`.
3. Attendance manual:
   - `All Students` hanya read-only.
   - Save wajib kelas spesifik.
4. Jalankan `Sinkron Penuh` dua kali:
   - run pertama boleh ada download.
   - run kedua harus idempotent (tidak ghost increment jika tidak ada perubahan).

## 3. Known Limitations (Saat Ini)

- Fase 1 belum membuka CRUD siswa penuh berbasis endpoint khusus siswa.
- Sync credentials desktop memakai keyring dengan fallback lokal agar aplikasi tetap berjalan walau keyring command gagal.
- Untuk merge data `users`, conflict key sync memakai `email` (bukan `id`) untuk menghindari unique violation.
- Full sync masih berbasis tabel inti phase-1; modul lanjutan (keuangan/perpustakaan/inventaris lengkap) belum masuk cakupan sinkronisasi phase-1.

## 4. Recovery Cepat Jika Sync Bermasalah

1. Buka `Settings` → isi ulang `Sync URL` dan `Sync Auth Token` → `Simpan ke Keyring`.
2. Klik `Muat Ulang` pada panel `Desktop Sync Credentials`.
3. Jalankan `Sinkron Penuh`.
4. Jika masih gagal, jalankan audit skema cloud dengan file SQL:
   - [phase-1-cloud-bootstrap.sql](/e:/Freelance/Project/educore/docs/phase-1-cloud-bootstrap.sql)
