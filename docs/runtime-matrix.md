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
- Desktop release: `desktop-release-ready`

Catatan:
- Desktop auth harus lokal.
- Tidak boleh kembali menggantung ke session web.
- Signoff channel saat ini: `MSI`

### Logout / Change Password
- Web: `web-ready`
- Desktop dev: `desktop-dev-ready`
- Desktop release: `desktop-release-ready`

---

## 2. Dashboard Overview

### Dashboard Home
- Web: `web-ready`
- Desktop dev: `desktop-dev-ready`
- Desktop release: `desktop-release-ready`

Catatan:
- Jika insight/kpi tertentu belum desktop-safe, tampilkan safe mode atau batasi eksplisit.

### Attendance Risk Insights
- Web: `web-ready`
- Desktop dev: `desktop-dev-ready`
- Desktop release: `desktop-release-ready`

---

## 3. Phase 2.1 Master Data

### Courses / Classes / Subjects
- Web: `web-ready`
- Desktop dev: `desktop-dev-ready`
- Desktop release: `desktop-release-ready`

Catatan:
- master data inti sudah desktop-safe untuk retest melalui dashboard courses
- release desktop tetap perlu audit parity dan smoke artifact final

### Teachers / User Management terkait Master Data
- Web: `web-ready`
- Desktop dev: `desktop-dev-ready`
- Desktop release: `desktop-release-ready`

Catatan:
- CRUD dan import inti sekarang sudah bisa diretest di desktop
- release desktop penuh tetap perlu audit parity dan smoke bundle final

---

## 4. Phase 2.2 Jadwal

### Schedule Management
- Web: `web-ready`
- Desktop dev: `desktop-dev-ready`
- Desktop release: `desktop-release-ready`

Catatan:
- jalur courses/schedule sudah cukup aman untuk retest desktop
- release desktop tetap perlu audit conflict detector, editor parity, dan smoke final

---

## 5. Phase 2.3 Attendance

### Attendance Input
- Web: `web-ready`
- Desktop dev: `desktop-dev-ready`
- Desktop release: `desktop-release-ready`

### Attendance History / Reporting
- Web: `web-ready`
- Desktop dev: `desktop-dev-ready`
- Desktop release: `desktop-release-ready`

### QR Attendance
- Web: `web-ready`
- Desktop dev: `desktop-dev-ready`
- Desktop release: `desktop-release-ready`

Catatan:
- read-side, mutation inti, settings, holidays, risk insights, dan follow-up sudah punya local desktop path
- desktop release penuh tetap perlu smoke QR camera/runtime artifact final

---

## 6. Phase 2.4 Finance

### Billing / Payment
- Web: `web-ready`
- Desktop dev: `desktop-dev-ready`
- Desktop release: `guarded`

Catatan:
- desktop local runtime sekarang sudah mencakup overview, invoices, payments, approvals, period control, dan manual adjustment
- approval, period control, dan manual adjustment di desktop dibatasi untuk `admin` / `super_admin`
- automated gate 6 Mei 2026 lulus untuk Finance tests, sync guard tests, web build, desktop runtime build, dan MSI bundle generation
- desktop release tetap guarded sampai smoke MSI, restart app, dan full sync finance lulus tanpa drift transaksi / jurnal

---

## 7. Students Module

### Student List / CRUD
- Web: `web-ready`
- Desktop dev: `desktop-dev-ready`
- Desktop release: `desktop-release-ready`

Catatan:
- desktop sekarang sudah mendukung roster, CRUD inti, import Excel, dan account ops utama
- release desktop penuh tetap perlu smoke artifact final dan audit integration handler lokal

---

## 8. Settings

### Settings Core
- Web: `web-ready`
- Desktop dev: `desktop-dev-ready`
- Desktop release: `desktop-release-ready`

Catatan:
- karena settings/auth sudah distabilkan, perubahan di sini harus sangat hati-hati
- sync desktop sekarang fail-secure saat offline dan kembali normal saat online

---

## 9. Release Interpretation

Sebuah area boleh disebut `desktop-release-ready` hanya jika:
- tidak bergantung ke route web untuk flow inti
- tidak menarik dependency server/native yang salah ke browser bundle
- validasi dan source of truth jelas
- sudah lolos build gate yang relevan
- sudah lolos smoke artifact installer pada channel yang disignoff

Catatan policy:
- channel Windows yang saat ini disignoff adalah `MSI`
- `NSIS` belum otomatis ikut berstatus `desktop-release-ready`

Jika belum, status yang benar adalah:
- `guarded`
- `needs-audit`
- atau `partially-ready`
