# Runtime Matrix

Dokumen ini memetakan status runtime tiap area utama EduCore.
Tujuannya:
- mencegah asumsi “semua halaman siap di semua runtime”
- memperjelas mana yang aman untuk web, desktop dev, dan desktop production
- membantu agent memutuskan apakah sebuah flow perlu di-port, dibatasi, atau cukup diaudit

---

## Legend

- `web-ready`
  Aman untuk runtime web/browser.
- `desktop-dev-ready`
  Aman dipakai di `bun tauri dev`.
- `desktop-release-ready`
  Aman untuk desktop production/release.
- `guarded`
  Sengaja dibatasi agar tidak misleading.
- `needs-audit`
  Belum boleh diasumsikan aman.

---

## 1. Auth

### Login
- Web: `web-ready`
- Desktop dev: `desktop-dev-ready`
- Desktop release: `needs-audit`

Catatan:
- Desktop auth harus lokal.
- Tidak boleh kembali menggantung ke session web.

### Logout / Change Password
- Web: `web-ready`
- Desktop dev: `desktop-dev-ready`
- Desktop release: `needs-audit`

---

## 2. Dashboard Overview

### Dashboard Home
- Web: `web-ready`
- Desktop dev: `desktop-dev-ready`
- Desktop release: `guarded`

Catatan:
- Jika insight/kpi tertentu belum desktop-safe, tampilkan safe mode atau batasi eksplisit.

### Attendance Risk Insights
- Web: `web-ready`
- Desktop dev: `needs-audit`
- Desktop release: `guarded`

---

## 3. Phase 2.1 Master Data

### Courses / Classes / Subjects
- Web: `web-ready`
- Desktop dev: `desktop-dev-ready`
- Desktop release: `partially-ready`

Catatan:
- master data inti sudah dekat ke jalur desktop-safe
- tetap perlu penutupan penuh untuk entitas yang belum lengkap seperti tahun ajaran, semester, guru_mapel

### Teachers / User Management terkait Master Data
- Web: `web-ready`
- Desktop dev: `desktop-dev-ready`
- Desktop release: `partially-ready`

Catatan:
- import Excel bisa tetap `web-only` jika belum ada jalur desktop yang aman

---

## 4. Phase 2.2 Jadwal

### Schedule Management
- Web: `needs-audit`
- Desktop dev: `needs-audit`
- Desktop release: `needs-audit`

Catatan:
- jangan anggap siap sampai conflict detector, local editor, dan sync contract jelas

---

## 5. Phase 2.3 Attendance

### Attendance Input
- Web: `web-ready`
- Desktop dev: `desktop-dev-ready`
- Desktop release: `needs-audit`

### Attendance History / Reporting
- Web: `web-ready`
- Desktop dev: `needs-audit`
- Desktop release: `needs-audit`

### QR Attendance
- Web: `needs-audit`
- Desktop dev: `needs-audit`
- Desktop release: `needs-audit`

---

## 6. Phase 2.4 Finance

### Billing / Payment
- Web: `needs-audit`
- Desktop dev: `needs-audit`
- Desktop release: `needs-audit`

Catatan:
- area ini harus dianggap sensitif sampai audit trail, model transaksi, dan sync-nya rapi

---

## 7. Students Module

### Student List / CRUD
- Web: `web-ready`
- Desktop dev: `needs-audit`
- Desktop release: `needs-audit`

Catatan:
- jangan disentuh saat task Fase 2.1 kecuali ada kaitan langsung

---

## 8. Settings

### Settings Core
- Web: `web-ready`
- Desktop dev: `desktop-dev-ready`
- Desktop release: `partially-ready`

Catatan:
- karena settings/auth sudah distabilkan, perubahan di sini harus sangat hati-hati

---

## 9. Release Interpretation

Sebuah area boleh disebut `desktop-release-ready` hanya jika:
- tidak bergantung ke route web untuk flow inti
- tidak menarik dependency server/native yang salah ke browser bundle
- validasi dan source of truth jelas
- sudah lolos build gate yang relevan

Jika belum, status yang benar adalah:
- `guarded`
- `needs-audit`
- atau `partially-ready`

