# Scripts Guide

Folder `scripts/` sekarang dipisah berdasarkan tujuan operasional supaya lebih aman dipakai.

## Struktur

- `scripts/dev/`
  Untuk helper dev/build/typecheck/e2e yang dipakai rutin.
- `scripts/release/`
  Untuk helper artifact desktop dan recovery build/release MSI.
- `scripts/audit/`
  Read-only diagnostics. Aman dipakai untuk investigasi awal karena tidak menulis data.
- `scripts/repair/`
  Tool repair data. Jalankan hanya setelah audit, dan utamakan preview/dry-run jika tersedia.
- `scripts/debug/`
  Tool investigasi incident yang lebih ad-hoc dan spesifik kasus.
- `scripts/admin/`
  Helper terkait verifikasi/reset admin lokal.
- `scripts/maintenance/`
  One-off cleanup atau maintenance lokal yang bukan flow release rutin.

## Aturan Pakai

- Mulai dari `audit` sebelum `repair`.
- Jangan pakai `repair` sebagai pengganti hardening source code.
- Kalau script menyentuh cloud/source of truth, catat dulu runtime, data contoh, dan tujuan perubahan.
- Untuk release desktop, prioritaskan helper di `scripts/release/` dan validasi channel `MSI`.
- Jangan commit artefak generated runtime/build. `.desktop-runtime-staging/` dan log build tidak boleh jadi source of truth.

## Jalur Aman Yang Sudah Di-Official-kan

- `bun run dev`
- `bun run build`
- `bun run typecheck`
- `bun run build:desktop`
- `bun run build:desktop:msi-finalize`
- `bun run ops:desktop:full-sync`
- `bun run audit:cloud:refs`
- `bun run audit:desktop:refs`
- `bun run repair:cloud:classes`
- `bun run repair:desktop:classes`

## Catatan

Kalau task baru mirip thread sync/attendance terbaru, baca juga:
- `docs/thread-checkpoint-sync-attendance.md`
- `docs/playbooks/desktop-sync-recovery.md`
- `docs/playbooks/student-class-drift-recovery.md`
- `docs/playbooks/attendance-verification-checklist.md`
