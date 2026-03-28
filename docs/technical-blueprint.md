# EduCore Technical Blueprint

## Purpose

Dokumen ini menjabarkan blueprint teknis EduCore agar implementasi web, desktop, sync, dan Fase 2 bergerak ke arah yang sama.
Dokumen ini melengkapi [CLAUDE.md](/e:/Freelance/Project/educore/CLAUDE.md), bukan menggantikannya.

---

## 1. Product Shape

EduCore adalah sistem manajemen sekolah hybrid dengan tiga jalur akses:

- `Desktop app`
  Untuk admin, staff, guru, dan operator yang butuh offline-first.
- `Web app`
  Untuk browser desktop/laptop dan user yang belum install aplikasi.
- `HP / mobile browser`
  Untuk akses melalui web responsif atau PWA.

Target akhir:
- data sekolah sama antar user/device
- desktop tetap usable saat offline
- web tetap bisa dipakai tanpa instalasi

---

## 2. Core Architecture

```text
Desktop UI
  -> Desktop Runtime Adapter
  -> Local SQLite
  -> Sync Engine
  -> Turso

Web UI / Mobile Web
  -> Next.js Route Handlers / Backend
  -> Turso
```

### Rules
- Desktop tidak boleh menggantung ke route web untuk flow inti.
- Web tidak boleh menggantung ke Tauri API.
- Business rule harus shared, transport layer boleh berbeda.

---

## 3. Data Ownership

### Shared truth
- `Turso` adalah shared collaboration layer antar user/device.

### Local truth
- `SQLite lokal desktop` adalah operational truth saat desktop offline.

### Practical interpretation
- Desktop menulis ke local DB lebih dulu.
- Web menulis ke cloud lebih dulu.
- Sync engine menyatukan local dan cloud.

---

## 4. Runtime Boundaries

## Desktop Runtime

Desktop runtime harus:
- bisa login tanpa route web
- bisa CRUD data inti tanpa route web
- bisa menyimpan perubahan saat offline
- bisa sinkron saat online

Desktop runtime tidak boleh:
- memakai `/api/*` web untuk flow inti
- memakai `SessionProvider` web sebagai syarat runtime
- membundle dependency browser-incompatible ke client

## Web Runtime

Web runtime harus:
- memakai backend route/server layer
- memakai auth web
- menjadi jalur akses universal untuk browser dan HP

Web runtime tidak boleh:
- mengakses SQLite desktop
- memanggil Tauri bridge
- membawa secret desktop/cloud ke browser

---

## 5. Layering Model

## UI Layer
- pages
- dialogs
- forms
- tables
- loading/empty/error states

Tidak boleh memuat rule bisnis penting.

## Application Layer
- orchestration use-case
- adapter invocation
- optimistic state coordination
- pending/error/success lifecycle

## Domain / Service Layer
- business rules
- validation bridge
- normalization
- conflict-safe write logic

## Runtime Adapter Layer
- web adapter
- desktop adapter

## Persistence Layer
- SQLite local repository
- Turso/cloud repository

## Sync Layer
- push delta
- pull delta
- checkpoint
- conflict resolution

---

## 6. Syncable Entity Standard

Entity yang disync minimal punya:

```ts
type SyncEntityBase = {
  id: string;
  version: number;
  updatedAt: string;
  deletedAt: string | null;
  syncStatus?: "synced" | "pending" | "error";
  hlc?: string | null;
};
```

Entitas Fase 2 yang harus mengikuti pola ini:
- tahun ajaran
- semester
- kelas
- mata pelajaran
- guru_mapel
- jadwal
- absensi
- tagihan
- pembayaran
- kategori_biaya

---

## 7. Fase 2 Implementation Model

## 2.1 Master Data

Harus mencakup:
- tahun ajaran
- semester
- kelas
- mata pelajaran
- guru_mapel

Definition:
- desktop local-first CRUD
- web CRUD
- sync metadata
- role boundary
- no direct client DB access

## 2.2 Jadwal

Harus mencakup:
- local conflict detection
- relasi ke kelas, mapel, guru mapel, waktu
- desktop editor
- web compatibility
- sync

AI-assisted generator bukan core dependency.

## 2.3 Absensi

Harus mencakup:
- offline capture
- queue sync
- manual + QR path
- reporting yang tidak melanggar boundary runtime

## 2.4 Keuangan Dasar

Harus mencakup:
- transaction-safe write
- audit trail
- angka tervalidasi
- status tagihan/pembayaran jelas
- sync yang aman

---

## 8. Recommended Folder Strategy

```text
src/
  core/
    db/
    sync/
    domain/
    services/
  lib/
    runtime/
      adapter/
      desktop/
      web/
  app/
    api/
  hooks/
  components/
```

### Rule
- `core/domain/services` = business rule
- `lib/runtime` = transport/runtime-specific access
- `app/api` = web transport only

---

## 9. Validation Model

Semua jalur write harus tervalidasi pada:
- form input
- runtime adapter
- backend route / desktop local path
- service/domain invariant

Error result harus cukup kaya untuk membedakan:
- validation error
- not found
- conflict
- forbidden
- unauthorized
- internal error

---

## 10. Release Strategy

## Web release
- deploy Next app
- dipakai browser desktop + HP

## Desktop release
- Tauri installer
- dibuka hanya jika flow inti sudah desktop-safe

### Fail-secure rule
Kalau desktop production path belum siap:
- release desktop harus diblok eksplisit
- jangan membiarkan bundle statis palsu terpaket

---

## 11. Build Gates

Minimal gate sebelum menyatakan area stabil:

```bash
bunx biome check .
bunx tsc --noEmit
bun run build
```

Untuk desktop production-safe area:

```bash
bun run build:desktop
```

Kalau `build:desktop` gagal karena guard arsitektur yang disengaja, itu harus dijelaskan sebagai `desktop-only fail-secure`, bukan dianggap lulus.

---

## 12. Engineering Priorities

Prioritas tinggi:
- source of truth konsisten
- runtime boundary aman
- no regression ke auth/settings/attendance/dashboard
- sync contract rapi

Prioritas menengah:
- performa initial load
- loading state yang baik
- duplicate request minim

Prioritas tetap:
- a11y
- predictable form lifecycle
- clean error semantics

