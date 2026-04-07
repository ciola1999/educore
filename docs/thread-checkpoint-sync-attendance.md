# Thread Checkpoint: Sync, Students, Attendance, Settings

## Status

- Checkpoint commit: `6cd421f`
- Commit message: `Fix desktop web sync and attendance regressions`
- Build status: `bun run build` sudah lulus
- Deploy status: user sudah konfirmasi deploy berhasil
- Release note penting: untuk desktop final, channel signoff yang valid tetap `MSI`

## Ringkasan Masalah Yang Sudah Dibereskan

### 1. Student sync desktop vs web

- Kasus student berakun sempat tampil `UNASSIGNED`
- Kasus student tanpa akun sempat telat muncul di desktop sampai full sync manual
- Ada drift jumlah total siswa antara desktop dan web
- Ada row student/account/class korup lintas runtime

### 2. Attendance

- Input manual sempat menyimpan lebih banyak siswa dari hasil filter aktif
- Filter tanggal `Hari Ini` sempat mengambil data kemarin
- Riwayat manual attendance sempat tidak muncul konsisten
- Filter status `Terlambat`, `Hadir`, `Alpha`, `Izin/Sakit` sempat bocor/campur
- Ringkasan `Izin/Sakit` sempat terlalu umum dan tidak spesifik

### 3. Settings / desktop runtime

- Halaman settings sempat terasa `compiling` terus di desktop dev
- Login desktop sempat gagal atau timeout setelah perubahan flow repair

### 4. Sync push / foreign key

- Full sync desktop sempat gagal di `guru_mapel` karena FK parent tidak sinkron
- Sync juga sempat gagal saat parent `class` ada di cloud tapi dalam keadaan soft-deleted
- Toast full sync sempat misleading karena hanya menampilkan hasil pull

### 5. Git / release hygiene

- Commit sempat ikut membawa artefak generated besar seperti `.desktop-runtime-staging`
- Push ke GitHub gagal karena payload terlalu besar

## Akar Masalah Yang Paling Penting

- Boundary web vs desktop sempat tidak selalu bersih
- Desktop login repair terlalu agresif dan sempat menyentuh jalur sync yang destruktif
- Projection student sempat percaya pada class row korup dengan `name` berupa UUID
- Sync FK parent-child belum cukup tangguh saat remote parent hilang, drift, atau soft-deleted
- Attendance history sempat punya sumber filter dan dedupe yang tidak konsisten
- Generated artifacts sempat masuk commit padahal bukan source of truth

## Perubahan Utama Yang Sudah Masuk

### Sync dan projection

- `full sync` sekarang menggabungkan hasil `push + pull`
- Remap FK sync diperkuat
- Sync sekarang bisa:
  - mendorong parent yang hilang dulu sebelum child
  - merevive parent cloud yang soft-deleted
- Projection student diperkeras agar class UUID tidak dianggap valid
- Flow create account student ikut menormalkan class/grade jika bisa dipulihkan

### Data cleanup dan repair

- Class alias/duplikat/UUID-corrupt dibersihkan di cloud dan desktop
- Attendance refs yang menunjuk class korup diremap ke class kanonik
- Student dummy/korup tertentu dihapus aman daripada dipaksa direpair
- Audit scripts untuk duplicate logical keys dan orphan references ditambahkan

### Attendance

- Input manual sekarang mengikuti hasil search/filter aktif
- Quick filter tanggal memakai local date, bukan UTC mentah
- Filter status sekarang eksklusif dan konsisten
- Summary `Izin` dan `Sakit` sudah dipisah
- Dedupe `Semua Status` vs filter spesifik sudah dibetulkan

### Runtime / settings / auth

- Halaman settings dipisah ke file client terdedikasi
- Beberapa trigger yang bikin desktop dev terasa terus `compiling` sudah dikurangi
- Login desktop diperbaiki supaya repair timeout tidak memblok sesi yang sebenarnya valid

### Tooling / release

- `run-typecheck` wrapper ditambahkan untuk menghindari false red dari `.next/types` stale
- Script audit/repair desktop-cloud bertambah banyak untuk investigasi cepat
- `.gitignore` diperbarui agar artefak generated tidak ikut commit lagi

## File/Area Penting Yang Banyak Disentuh

- `src/lib/sync/turso-sync.ts`
- `src/lib/sync/turso-sync.pull-idempotency.test.ts`
- `src/lib/services/student-projection.ts`
- `src/lib/services/student-projection.test.ts`
- `src/core/services/attendance-service.ts`
- `src/core/services/attendance-service.test.ts`
- `src/hooks/use-attendance-form.ts`
- `src/hooks/use-auth.ts`
- `src/lib/runtime/desktop-local-api.ts`
- `src/lib/runtime/desktop-sync-route.ts`
- `src/components/attendance/daily-log-view.tsx`
- `src/components/attendance/qr-scanner-view.tsx`
- `src/app/dashboard/settings/page.tsx`
- `src/app/dashboard/settings/settings-page-client.tsx`
- `src/lib/utils/class-name.ts`
- `scripts/*audit*`
- `scripts/*repair*`
- `scripts/*debug*`

## Aturan Yang Harus Diingat Untuk Thread Berikutnya

### Harus dilakukan

- Bedakan dulu bug ini `web`, `bun tauri dev`, `MSI`, atau `keduanya`
- Kalau menyentuh runtime/sync/build/release, anggap dulu sebagai `runtime boundary issue`
- Audit teknis dulu sebelum edit
- Sebutkan file yang akan diubah sebelum edit
- Jaga `cloud` sebagai global source of truth
- Jaga `desktop SQLite + sync` sebagai source of operation desktop
- Jalankan minimal:
  - `bunx biome check .`
  - `bunx tsc --noEmit`
  - `bun run build`
- Untuk desktop final, sebutkan channel installer yang lolos, yaitu `MSI`

### Tidak boleh dilakukan

- Jangan anggap `works on dev` berarti packaged desktop sehat
- Jangan anggap build sukses berarti runtime target sehat
- Jangan edit artefak generated sebagai solusi utama
- Jangan jadikan `.next/types` stale sebagai bukti error source code
- Jangan campurkan boundary web dan desktop secara diam-diam
- Jangan biarkan source of truth ganda untuk auth/search/filter
- Jangan commit `.desktop-runtime-staging`, build logs, atau artefak runtime transient

## Dokumen Yang Wajib Dibaca Di Awal Chat Berikutnya

### Selalu

- `README-AGENT-START.md`
- `CLAUDE.md`
- `docs/new-chat-bootstrap.md`

### Jika menyentuh runtime/sync/build/release

- `docs/runtime-matrix.md`
- `docs/desktop-production-runtime-plan.md`
- `docs/desktop-embedded-server-design.md`
- `docs/production-release-checklist.md`
- `docs/adr/ADR-001-hybrid-local-first-architecture.md`
- `docs/adr/ADR-002-sync-and-source-of-truth.md`
- `docs/adr/ADR-003-auth-web-vs-desktop.md`
- `docs/adr/ADR-004-release-strategy-web-desktop.md`
- `.agent/rules/desktop-runtime-boundary.md`
- `.agent/rules/schema-sync-safety.md`

### Jika bug hanya muncul di deploy web atau packaged desktop

- `docs/runtime-boundary-incident-postmortem.md`

### Jika butuh jalur praktis

- `scripts/README.md`
- `docs/playbooks/desktop-sync-recovery.md`
- `docs/playbooks/student-class-drift-recovery.md`
- `docs/playbooks/attendance-verification-checklist.md`

## Checklist Cepat Untuk Repro Bug Serupa

1. Tentukan runtime: `web`, `desktop dev`, atau `MSI`
2. Catat langkah reproduce dan data contoh
3. Cek apakah artifact/runtime yang dites terbaru atau stale
4. Audit boundary auth, middleware, request path, dan sync direction
5. Baru audit CRUD/business logic biasa

## Catatan Jujur

- Thread ini menghasilkan banyak script audit/repair yang berguna, tapi jangan jadikan repair manual sebagai pengganti hardening source code
- Jika ada bug baru yang mirip, mulai dari audit runtime boundary dan source-of-truth drift, jangan langsung dari UI symptom

## Addendum 2026-04-07

### Batch terbaru yang sudah beres

- Filter kelas di `Attendance` sudah dibersihkan dari alias/duplikat sehingga dropdown tidak lagi banjir
- Form tambah/edit student sekarang wajib memilih kelas dari master class, bukan free text
- Import student web dan desktop sekarang:
  - tidak membuat kelas baru diam-diam
  - menolak kelas yang tidak ada di master
  - memakai partial import, jadi row valid tetap diproses walau ada row lain yang gagal
- Sync desktop pull sekarang bisa merevive row student lokal yang pernah soft-delete jika cloud masih punya row aktif yang cocok
- Smoke test area student end-to-end sudah lolos:
  - add manual
  - edit student
  - import partial
  - sync web -> desktop
  - sync desktop -> web

### File/area penting dari batch terbaru

- `src/lib/utils/class-name.ts`
- `src/app/api/attendance/classes/route.ts`
- `src/lib/runtime/desktop-local-api.ts`
- `src/lib/students/class-reference.ts`
- `src/lib/students/class-reference.test.ts`
- `src/hooks/use-student-class-options.ts`
- `src/components/student/add-student-dialog.tsx`
- `src/components/student/edit-student-dialog.tsx`
- `src/app/api/students/route.ts`
- `src/app/api/students/[id]/route.ts`
- `src/app/api/students/import/route.ts`
- `src/lib/runtime/desktop-import-handlers.ts`
- `src/lib/sync/turso-sync.ts`
- `src/lib/sync/turso-sync.pull-idempotency.test.ts`

### Keputusan desain terbaru yang harus dipertahankan

- Student create/edit tidak boleh lagi jadi jalur pembuatan class baru
- Import student tidak boleh auto-create class dari teks Excel
- Untuk operasional sekolah, partial import lebih cocok daripada all-or-nothing selama error per baris tetap jelas
- Kalau desktop dan web beda total student, anggap dulu sebagai mismatch data nyata, bukan sekadar bug kartu stats
- Jika cloud punya row aktif dan desktop punya pasangan lokal deleted, pull sync harus bisa merevive row lokal itu

### Retest cepat untuk thread berikutnya bila menyentuh student/import

1. Cek `Students` web: total, laki-laki, perempuan
2. Cek `Students` desktop: total, laki-laki, perempuan
3. Pastikan angka match
4. Tambah 1 student manual tanpa akun
5. Tambah 1 student manual dengan akun
6. Import file campuran: beberapa row valid + 1 row kelas invalid
7. Pastikan row valid masuk, row invalid gagal dengan pesan jelas
8. Jalankan `Sinkron Penuh`
9. Pastikan web dan desktop tetap match setelah sync
