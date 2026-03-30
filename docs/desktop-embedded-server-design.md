# Desktop Embedded Server Design

Tanggal referensi: 30 Maret 2026

Dokumen ini adalah desain teknis lanjutan dari:
- [desktop-production-runtime-plan.md](/e:/Freelance/Project/educore/docs/desktop-production-runtime-plan.md)
- [ADR-004-release-strategy-web-desktop.md](/e:/Freelance/Project/educore/docs/adr/ADR-004-release-strategy-web-desktop.md)

Fokus dokumen ini:
- bagaimana desktop production dapat menjalankan runtime yang setara dengan kontrak Next.js sekarang
- tanpa memaketkan static export palsu
- tanpa mengaburkan boundary web vs desktop

---

## 1. Target Arsitektur

Target runtime production desktop:

```text
Tauri shell
  -> local embedded app server (loopback)
  -> Next.js runtime contract (/dashboard + /api/*)
  -> desktop local adapter
  -> SQLite local
  -> sync engine
  -> cloud (saat online)
```

Tujuan:
- route handler `/api/*` tetap hidup
- auth/session contract tetap konsisten
- desktop-safe route yang sekarang sudah stabil tidak perlu dibongkar total

---

## 2. Komponen Yang Dibutuhkan

### A. App Server Lokal

Desktop production harus membawa proses server lokal yang:
- bind ke `127.0.0.1`
- memakai port dinamis atau port yang dikelola
- melayani:
  - `/`
  - `/dashboard/*`
  - `/api/*`
  - `/api/auth/*`

Kandidat implementasi:
- bundle Next standalone server
- atau wrapper Node/Bun process yang menjalankan output standalone

### B. Bootstrap / Health Check

Tauri shell tidak boleh langsung membuka UI utama.

Urutannya:
1. spawn app server lokal
2. tunggu health check `200`
3. baru buka main window
4. kalau gagal, tampilkan startup error yang jujur

Status fondasi saat ini:
- native command `get_runtime_bootstrap_config` sudah tersedia di Tauri
- native command `probe_runtime_bootstrap_health` sudah tersedia untuk mengecek loopback health endpoint
- frontend helper [desktop-bootstrap-config.ts](/e:/Freelance/Project/educore/src/lib/runtime/desktop-bootstrap-config.ts) sudah bisa membaca kontrak bootstrap ini
- frontend helper yang sama juga sudah bisa memanggil probe health native
- implementasi spawn process lokal belum dibuka

### C. Runtime Env Desktop

Desktop production membutuhkan env sendiri yang terpisah dari web production.

Minimal:
- `AUTH_DATABASE_URL`
- `AUTH_DATABASE_AUTH_TOKEN`
- `SYNC_DATABASE_URL`
- `SYNC_DATABASE_AUTH_TOKEN`
- `AUTH_SECRET`
- origin lokal internal untuk auth/runtime URL

Catatan:
- desktop tidak boleh bergantung pada `AUTH_URL` web production
- desktop production harus memakai origin loopback miliknya sendiri

### D. Lifecycle Management

Saat app ditutup:
- proses server lokal harus di-shutdown
- zombie process tidak boleh tertinggal

Saat app crash:
- shell perlu bisa mendeteksi app server mati
- tampilkan state error / retry

---

## 3. Health Endpoint Yang Disarankan

Buat endpoint health ringan, misalnya:

```text
/api/runtime/health
```

Status saat ini:
- endpoint [runtime health](/e:/Freelance/Project/educore/src/app/api/runtime/health/route.ts) sudah ada sebagai fondasi handshake startup
- endpoint ini belum dipakai oleh bootstrap Tauri production karena embedded local server belum diimplementasikan

Kontrak minimal:
- `200 OK` saat server siap
- payload memuat:
  - mode runtime
  - versi app
  - status auth adapter
  - status DB local

Contoh:

```json
{
  "ok": true,
  "runtime": "desktop-production-server",
  "version": "0.1.0",
  "db": "ready"
}
```

Endpoint ini dipakai oleh:
- bootstrap Tauri
- smoke test production desktop
- troubleshooting support

---

## 4. Output Build Yang Ditargetkan

### Bukan Target

Yang tidak boleh dipakai lagi untuk desktop release:
- `frontendDist: "../out"`
- bundle static export murni

### Target Baru

Yang perlu dituju:
- output standalone/runtime server yang bisa dijalankan lokal
- asset frontend ikut terbawa dalam paket desktop
- Tauri load URL loopback server lokal, bukan file statis

---

## 5. Implementasi Bertahap

### Phase A: Bootstrap Proof of Concept

- [ ] hasilkan output server lokal yang bisa dijalankan tanpa `next dev`
- [ ] Tauri bisa spawn proses itu
- [ ] Tauri bisa health-check lalu membuka window
- [ ] route `/dashboard` dan `/api/runtime/warmup` hidup

### Phase B: Auth + Core Route Validation

- [ ] login desktop production hidup
- [ ] `/api/auth/session` sehat
- [ ] `/dashboard/students` hidup
- [ ] `/dashboard/attendance` hidup
- [ ] `/dashboard/settings` hidup

### Phase C: Offline + Sync Validation

- [ ] startup offline tetap sehat
- [ ] students/teachers/attendance core flow tetap jalan
- [ ] sync action fail-secure
- [ ] kembali online tidak merusak state lokal

### Phase D: Packaging

- [ ] `bun run build:desktop` lolos
- [ ] `bun tauri build` lolos
- [ ] installer hasil build bisa menjalankan runtime lokal tanpa tool dev

---

## 6. Risiko Utama

### Port Collision

Server lokal mungkin gagal start jika port sudah dipakai.

Mitigasi:
- pakai port dinamis
- simpan port terpilih hanya untuk sesi aktif

### Process Supervision

Server lokal bisa crash saat app masih terbuka.

Mitigasi:
- shell periodik memeriksa health
- tampilkan tombol retry bootstrap

### Env Drift

Desktop production bisa salah memakai env web production.

Mitigasi:
- definisikan env desktop secara eksplisit
- jangan mewarisi semua env web mentah-mentah

### Packaging Weight

Embedded server akan menambah ukuran bundle.

Mitigasi:
- prioritaskan correctness lebih dulu
- optimisasi ukuran belakangan

---

## 7. Definition of Done

Strategi embedded local server dianggap siap jika:
- [ ] desktop release tidak lagi memakai static export palsu
- [ ] shell Tauri membuka runtime lokal production yang sehat
- [ ] auth, settings, students, teachers, courses, attendance lolos smoke
- [ ] offline desktop tetap usable
- [ ] `bun run build:desktop` dan `bun tauri build` lulus
- [ ] installer final bisa diuji tanpa `bun run dev` atau `bun tauri dev`
