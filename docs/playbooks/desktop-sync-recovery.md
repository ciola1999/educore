# Desktop Sync Recovery Playbook

Gunakan playbook ini saat bug terkait sync muncul di desktop (`bun tauri dev` atau `MSI`).

## 1. Tentukan Runtime

- `web`
- `bun tauri dev`
- packaged `MSI`

Kalau bug hanya muncul di desktop, anggap dulu sebagai `desktop runtime boundary issue`.

## 2. Audit Awal

- cek apakah user sedang memakai artifact/runtime terbaru atau stale
- cek apakah issue muncul saat startup/login repair atau hanya saat `Sinkron Penuh`
- cek arah masalah:
  - local berubah tapi cloud tidak
  - cloud berubah tapi local tidak
  - keduanya drift

## 3. Jalur Audit Aman

Mulai dari audit read-only:

- `bun run audit:desktop:refs`
- `bun run audit:cloud:refs`
- script di `scripts/audit/`
- script di `scripts/debug/` yang relevan ke entity bermasalah

Kalau issue spesifik ke student/class:
- audit class alias, UUID-like class rows, dan orphan refs
- audit row by `NIS` jika ada contoh siswa nyata

## 4. Pertanyaan Diagnostik

- apakah push gagal karena FK parent belum ada di cloud?
- apakah parent cloud ada tapi soft-deleted?
- apakah projection student percaya ke `classes.name` yang korup?
- apakah login repair menjalankan prune destruktif padahal user belum minta full sync?
- apakah toast sync jujur menunjukkan `push + pull`?

## 5. Repair Policy

- mulai dari preview/read-only bila tersedia
- repair cloud hanya dilakukan jika source of truth jelas
- repair desktop boleh dilakukan untuk memulihkan operational state lokal
- jangan restore data ambigu tanpa bukti yang cukup

## 6. Setelah Fix

Validasi minimal:

- `bunx biome check .`
- `bunx tsc --noEmit`
- `bun run build`

Retest minimum:

1. login desktop
2. cek state sebelum sync manual
3. jalankan `Sinkron Penuh`
4. cek hasil di desktop
5. cek hasil di web

## 7. Jangan Lakukan Ini

- jangan anggap `works on dev` berarti `MSI` sehat
- jangan prune data otoritatif saat login repair biasa
- jangan pakai repair manual sebagai pengganti hardening permanen
- jangan menebak class siswa jika data sumbernya ambigu
