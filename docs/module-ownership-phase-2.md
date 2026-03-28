# Module Ownership Map for Phase 2

Dokumen ini memetakan ownership teknis Fase 2:
- entitas utama
- layer yang terlibat
- risiko perubahan
- area yang wajib dicek saat ada modifikasi

Tujuan:
- mencegah perubahan setengah jalan
- memaksa agent melihat impact lintas schema, service, UI, route, dan sync

---

## 1. 2.1 Master Data

### Entitas
- tahun ajaran
- semester
- kelas
- mata pelajaran
- guru_mapel

### Ownership layers
- Schema: `src/core/db/schema.ts`
- Local persistence: `src/core/db/connection.ts` dan query terkait
- Business rule: service/domain academic
- Web transport: route handler akademik
- Desktop transport: runtime local adapter untuk master data
- UI: dashboard courses/teachers/master data forms
- Sync: kontrak delta untuk entitas master data

### Wajib dicek saat berubah
- relasi kelas <-> guru
- uniqueness rule
- in-use checks
- role boundary
- state refresh setelah CRUD
- compatibility local/cloud

### Risiko tertinggi
- duplicate rule mismatch
- role leak
- client state drift
- desktop flow diam-diam kembali ke web-only path

---

## 2. 2.2 Jadwal

### Entitas
- jadwal

### Depends on
- kelas
- mata pelajaran
- guru_mapel
- semester
- ruang/waktu jika ada

### Ownership layers
- Schema jadwal
- service conflict detection
- editor UI
- local adapter desktop
- route handler web
- sync dependency order

### Wajib dicek saat berubah
- bentrok guru
- bentrok kelas
- relasi ke semester/tahun ajaran
- impact ke absensi

### Risiko tertinggi
- schedule invalid tapi lolos simpan
- sync order salah
- absensi membaca jadwal yang tidak konsisten

---

## 3. 2.3 Absensi

### Entitas
- absensi
- table/projection terkait jika ada

### Depends on
- siswa
- kelas
- jadwal atau session context
- user pencatat

### Ownership layers
- attendance service
- attendance API / desktop local path
- attendance UI form/history
- projection/summary logic
- sync queue

### Wajib dicek saat berubah
- duplicate attendance prevention
- source of truth raw record vs summary
- role boundary guru/staff/admin
- offline queue behavior

### Risiko tertinggi
- raw record dan summary mismatch
- desktop history/report masih web-dependent
- conflict attendance overwrite

---

## 4. 2.4 Keuangan Dasar

### Entitas
- kategori_biaya
- tagihan
- pembayaran

### Depends on
- siswa
- user/operator
- status invoice

### Ownership layers
- finance schema
- finance service/domain
- route handler web
- local adapter desktop
- reporting/export
- sync/audit trail

### Wajib dicek saat berubah
- validasi nominal
- state invoice setelah pembayaran
- audit trail
- soft delete
- derived balance/status

### Risiko tertinggi
- saldo korup karena overwrite
- payment conflict
- audit hilang

---

## 5. Cross-Cutting Ownership

Komponen lintas modul Fase 2 yang wajib dipikirkan saat ada perubahan:

### Auth / RBAC
- role dan permission checks
- session source per runtime

### Runtime adapters
- apakah flow melewati web adapter atau desktop adapter
- apakah adapter masih aman untuk target runtime

### Schema / Migration
- setiap perubahan entity harus dicek impact ke migration dan sync

### Sync
- urutan push/pull
- dependency entity
- conflict behavior

### Build / Release
- apakah perubahan membuat browser bundle menarik dependency salah
- apakah area ini boleh dianggap desktop-release-safe

---

## 6. Required Review Habit

Jika agent mengubah salah satu modul Fase 2, review minimal harus menyentuh:
- schema impact
- service impact
- UI lifecycle impact
- runtime boundary impact
- sync impact
- validation impact

Kalau salah satu belum diaudit, perubahan belum boleh dianggap selesai.

