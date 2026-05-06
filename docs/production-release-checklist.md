# Production Release Checklist

Tanggal referensi: 1 April 2026

Checklist ini dipakai sebagai gate rilis praktis untuk:
- web production
- desktop production MSI
- auth + sync + environment
- smoke test setelah deploy

Dokumen ini sengaja jujur:
- tidak semua area yang `desktop-dev-safe` otomatis `desktop-release-ready`
- release desktop tidak boleh dibuka hanya karena UI terlihat lengkap

---

## 1. Web Production Gate

- [ ] `bunx biome check .` lulus
- [ ] `bunx tsc --noEmit` lulus
- [ ] `bun run build` lulus
- [ ] smoke auth/settings lulus
- [ ] smoke attendance lulus
- [ ] login production berhasil
- [ ] `GET /api/auth/session` production mengembalikan `200`
- [ ] `POST /api/auth/callback/credentials` production tidak menghasilkan `CallbackRouteError`
- [ ] tidak ada error `UntrustedHost`
- [ ] tidak ada error `Cannot find package 'argon2'`

Catatan:
- web auth sekarang default memakai `hash-wasm` untuk Argon2id
- native `argon2` di Node hanya opt-in melalui `EDUCORE_PREFER_NATIVE_ARGON2=true`

---

## 2. Production Env Gate

### Auth Web

- [ ] `AUTH_SECRET`
- [ ] `AUTH_TRUST_HOST=true`
- [ ] `AUTH_URL`
- [ ] `NEXTAUTH_URL`
- [ ] `AUTH_DATABASE_URL` atau `TURSO_DATABASE_URL`
- [ ] `AUTH_DATABASE_AUTH_TOKEN` atau `TURSO_AUTH_TOKEN`

Fallback yang juga didukung:
- [ ] `TURSO_DATABASE_AUTH_TOKEN`
- [ ] `TURSO_DATABASE_TURSO_AUTH_TOKEN`

Aturan:
- [ ] `AUTH_URL` dan `NEXTAUTH_URL` memakai origin production yang sama
- [ ] auth DB production bukan `DATABASE_URL` Vercel Postgres
- [ ] user admin production terverifikasi di auth DB yang sama dengan deployment

### Desktop Sync

- [ ] `SYNC_DATABASE_URL` atau `TURSO_DATABASE_URL`
- [ ] `SYNC_DATABASE_AUTH_TOKEN` atau `TURSO_AUTH_TOKEN`
- [ ] fallback keyring / file sync-config berjalan

---

## 3. Desktop Release Gate

Desktop hanya boleh disebut mendekati release-ready jika:

- [ ] login desktop lokal aman
- [ ] logout / change password desktop aman
- [ ] dashboard desktop tidak misleading
- [ ] sidebar / gate / redirect sinkron
- [ ] tidak ada flow inti desktop yang lompat ke route web-only
- [ ] sync desktop fail-secure saat offline
- [ ] full sync kembali normal saat online
- [ ] tidak ada client direct DB access yang melanggar boundary
- [ ] `bun run build` lulus
- [ ] `bun run build:desktop` lulus
- [ ] `bun tauri build` menghasilkan bundle valid
- [ ] artifact MSI berhasil di-install pada Windows target
- [ ] login desktop berhasil
- [ ] logout lalu login ulang tanpa restart app berhasil
- [ ] full sync online berhasil
- [ ] full sync offline gagal dengan pesan jujur

Status jujur saat ini:
- desktop MSI: artifact kandidat 6 Mei 2026 berhasil dibuat, production final setelah installed smoke artifact nyata lulus
- desktop NSIS: belum disignoff, masuk backlog hardening terpisah

Artifact kandidat terbaru:
- `src-tauri/target/release/bundle/msi/educore_0.1.0_x64_en-US.msi`
- ukuran: 69,869,568 bytes

Automated gate 6 Mei 2026:
- [x] Finance unit/runtime/sync guard tests lulus
- [x] `bunx biome check .` lulus
- [x] `bun run typecheck` lulus
- [x] `bun run build` lulus
- [x] `bun run build:desktop` lulus
- [x] `bun tauri build` lulus untuk target `MSI`

Referensi:
- lihat [desktop-production-runtime-plan.md](/e:/Freelance/Project/educore/docs/desktop-production-runtime-plan.md) untuk blocker arsitektur yang masih menahan `build:desktop`

---

## 4. Desktop Route Gate

Route yang saat ini layak diretest di desktop:
- [ ] `/dashboard`
- [ ] `/dashboard/attendance`
- [ ] `/dashboard/courses`
- [ ] `/dashboard/finance`
- [ ] `/dashboard/finance/invoices`
- [ ] `/dashboard/finance/payments`
- [ ] `/dashboard/finance/periods`
- [ ] `/dashboard/finance/accounting`
- [ ] `/dashboard/finance/audit`
- [ ] `/dashboard/settings`
- [ ] `/dashboard/students`
- [ ] `/dashboard/teachers`

Yang harus tetap fail-secure jika belum siap:
- [ ] route lain yang belum punya local-safe adapter
- [ ] flow yang masih bergantung ke web-only runtime

Catatan Finance desktop:
- governance action (`approve/reject`, `create/open/soft-close/final-close period`, `manual adjustment`) hanya boleh lolos untuk `admin` / `super_admin`
- role non-admin harus tetap melihat state read-only yang jujur pada area governance

---

## 5. Smoke Test Web

- [ ] login admin
- [ ] logout revoke access
- [ ] session refresh tetap sehat
- [ ] dashboard redirect sesuai role
- [ ] settings auth shell sehat
- [ ] attendance shell sehat

Command:
- [ ] `bun run scripts/dev/run-e2e-smoke-local.ts`

---

## 6. Smoke Test Desktop Offline

- [ ] login `super_admin` saat offline
- [ ] buka `dashboard`
- [ ] buka `students`
- [ ] buka `teachers`
- [ ] buka `courses`
- [ ] buka `attendance`
- [ ] buka `settings`
- [ ] sync action menampilkan pesan offline yang jujur
- [ ] tidak ada `Failed to fetch` yang misleading di flow inti

### Students
- [ ] CRUD
- [ ] import Excel
- [ ] create account per siswa
- [ ] bulk create account
- [ ] bulk reset password
- [ ] repair kelas legacy

### Teachers
- [ ] CRUD
- [ ] import Excel

### Attendance
- [ ] `today`
- [ ] `history`
- [ ] `bulk`
- [ ] `scan`
- [ ] `settings`
- [ ] `holidays`
- [ ] `risk insights`
- [ ] `risk follow-up`

### Finance
- [ ] buka `overview`
- [ ] buka `invoices`
- [ ] buka `payments`
- [ ] buka `periods`
- [ ] buka `accounting`
- [ ] buka `audit`
- [ ] `Generate Batch` berhasil
- [ ] `Payment Entry` berhasil
- [ ] `approve/reject` berhasil untuk `admin` / `super_admin`
- [ ] `NEW PERIOD` berhasil untuk `admin` / `super_admin`
- [ ] `SOFT CLOSE / REOPEN / FINAL CLOSE` berhasil sesuai state machine
- [ ] `New Adjustment` berhasil untuk `admin` / `super_admin`
- [ ] audit log finance tampil setelah aksi sensitif
- [ ] restart app mempertahankan state finance terakhir
- [ ] full sync tidak menggandakan `approval_requests`, `journal_entries`, `payments`, atau `invoices`

Referensi:
- lihat [finance-desktop-smoke-checklist.md](/e:/Freelance/Project/educore/docs/finance-desktop-smoke-checklist.md) untuk smoke pass manual detail Finance desktop

---

## 7. Post-Deploy Verification

Setelah deploy web production:

- [ ] buka `/login`
- [ ] login admin berhasil
- [ ] cek `/api/auth/session`
- [ ] cek dashboard sesuai role
- [ ] cek satu flow settings/auth
- [ ] cek satu flow attendance
- [ ] cek Vercel runtime logs bersih dari error auth/config utama

Cari error ini:
- [ ] `UntrustedHost`
- [ ] `MissingSecret`
- [ ] `CallbackRouteError`
- [ ] `Cannot find package 'argon2'`
- [ ] auth DB URL/token mismatch

---

## 8. Residual Risk

### Release Scope

- [ ] signoff resmi Windows saat ini hanya untuk channel `MSI`
- [ ] `NSIS` diperlakukan sebagai backlog hardening terpisah, bukan blocker release MSI
- [ ] release note menyebut jelas `Windows installer officially supported: MSI`

### Artifact Security

- [ ] installer desktop diperlakukan sebagai controlled artifact
- [ ] distribusi installer dibatasi ke channel rilis resmi
- [ ] hash artifact final dicatat sebelum distribusi
- [ ] secret runtime packaged diminimalkan hanya untuk kebutuhan bootstrap
- [ ] roadmap first-run provisioning / keyring-only credential masih terbuka

### Engineering Follow-up

- [ ] desktop runtime sudah jauh lebih rapi, tapi belum full integration-tested untuk semua handler lokal
- [ ] `desktop-local-api.ts` masih cukup besar walau modularisasi sudah maju
- [ ] perubahan env production harus selalu diikuti rebuild artifact + smoke login
