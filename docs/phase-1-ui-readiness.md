# Phase 1 UI Readiness

Dokumen ini mengunci status UI phase 1 setelah refactor boundary backend-first pada area `students`, `attendance`, `courses`, `teachers`, dan `settings`.

## Siap Operasional

- `Attendance`
  - QR attendance aktif melalui route backend tervalidasi.
  - Manual attendance aktif untuk role dengan `attendance:write`.
  - History/log attendance aktif dengan filter tanggal, status, source, export `.xlsx`, dan scoping role.
  - Role `student` hanya melihat log/riwayat miliknya sendiri.
- `Students`
  - Read-only roster aktif untuk `admin` / `super_admin`.
  - Self-view aktif untuk `student`.
  - Search, sort, pagination, stats, dan detail dialog tersedia.
- `Courses`
  - Kelas dan mata pelajaran aktif pada kontrak phase 1.
  - Mode read-only otomatis untuk role tanpa `academic:write`.
- `Teachers`
  - Manajemen user aktif untuk `admin` / `super_admin`.
  - Guru/staff tidak bisa masuk modul ini.
- `Settings`
  - Sinkronisasi dan desktop sync credential hanya aktif untuk role dengan `settings:manage`.
  - Role lain hanya melihat status dan informasi.

## Sengaja Ditahan

- CRUD siswa penuh.
- Filter kelas untuk attendance history QR.
  - Phase 1 belum punya relasi kelas yang tegas pada record QR, jadi filter kelas pada history akan menyesatkan jika dipaksakan.
- Edit user pada modul manajemen user.
- Holiday manager dan attendance schedule settings di UI utama.

## Known Limits

- `teacher` dan `staff` belum punya picker siswa khusus seperti `admin/super_admin` pada history.
  - Mereka tetap bisa memakai search text dan filter yang tersedia.
- Validasi UI role-based sudah kuat, tetapi smoke test manual di desktop tetap wajib untuk:
  - login per role,
  - QR camera permission,
  - save manual attendance,
  - export attendance/history.

## Validation Baseline

- `bun run typecheck`
- `vitest` untuk:
  - dashboard access policy
  - attendance route guards
  - students route guards
  - attendance page role-aware rendering
