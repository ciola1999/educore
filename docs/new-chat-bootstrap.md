# New Chat Bootstrap

Gunakan file ini sebagai kumpulan prompt siap pakai saat membuka chat baru.
Tujuannya:
- mempercepat kickoff
- memastikan agent membaca dokumen yang benar
- mengurangi risiko agent salah asumsi

---

## 1. Bootstrap Umum

```text
Sebelum mulai, baca dan ikuti:
- CLAUDE.md
- docs/technical-blueprint.md
- docs/runtime-matrix.md
- docs/adr/ADR-001-hybrid-local-first-architecture.md
- docs/adr/ADR-002-sync-and-source-of-truth.md
- docs/adr/ADR-003-auth-web-vs-desktop.md
- docs/adr/ADR-004-release-strategy-web-desktop.md
- .agent/rules/desktop-runtime-boundary.md
- .agent/rules/schema-sync-safety.md

Audit dulu, jangan asumsi. Jaga source of truth, runtime boundary, schema safety, sync safety, dan fail-secure desktop release.
```

---

## 2. Bootstrap Fase 2 Umum

```text
Sebelum mulai, baca dan ikuti:
- CLAUDE.md
- docs/technical-blueprint.md
- docs/phase-2-execution-roadmap.md
- docs/phase-2-desktop-native-checklist.md
- docs/runtime-matrix.md
- docs/module-ownership-phase-2.md
- docs/sync-contract-phase-2.md
- docs/adr/ADR-001-hybrid-local-first-architecture.md
- docs/adr/ADR-002-sync-and-source-of-truth.md
- docs/adr/ADR-003-auth-web-vs-desktop.md
- docs/adr/ADR-004-release-strategy-web-desktop.md
- .agent/rules/desktop-runtime-boundary.md
- .agent/rules/schema-sync-safety.md

Fokus ke eksekusi, bukan teori panjang. Audit dulu, lalu jelaskan akar masalah singkat, fix langsung di code, rapikan jalur terkait yang berisiko regress, lalu validasi dengan:
- bunx biome check .
- bunx tsc --noEmit
- bun run build

Kalau ada issue runtime tertentu, jelaskan apakah web-only, desktop-only, atau keduanya.
```

---

## 3. Bootstrap Fase 2.1 Master Data

```text
Sebelum mulai, baca dan ikuti:
- CLAUDE.md
- docs/technical-blueprint.md
- docs/phase-2-execution-roadmap.md
- docs/phase-2-desktop-native-checklist.md
- docs/runtime-matrix.md
- docs/module-ownership-phase-2.md
- docs/sync-contract-phase-2.md
- .agent/rules/desktop-runtime-boundary.md
- .agent/rules/schema-sync-safety.md

Task ini fokus khusus ke Fase 2.1 Master Data.

Audit wajib:
1. layout dan responsive
2. state management client vs source of truth backend/local DB
3. CRUD flow dan form lifecycle
4. validasi data dan feedback sukses/gagal
5. role/access boundary
6. web vs tauri runtime boundary
7. apakah ada client component yang membaca service DB langsung
8. apakah ada backend/hook/util/route/component terkait yang mubazir atau berisiko regress
9. loading state, empty state, error state
10. performance awal load dan request duplication
11. sinkronisasi data antar modul terkait master data

Jangan merusak auth, settings, attendance, students, user management, dan dashboard kecuali ada kaitan langsung.
```

---

## 4. Bootstrap Schema / Sync Task

```text
Sebelum mulai, baca dan ikuti:
- CLAUDE.md
- docs/technical-blueprint.md
- docs/sync-contract-phase-2.md
- docs/adr/ADR-002-sync-and-source-of-truth.md
- .agent/rules/schema-sync-safety.md

Task ini menyentuh schema/sync. Jangan asumsi.

Kalau ada perubahan schema/tabel/kolom:
- cek query
- cek relasi
- cek migration
- cek route handler
- cek desktop runtime adapter
- cek payload sync
- cek source of truth web vs desktop

Setelah selesai, laporkan impact-nya:
- web-only
- desktop-only
- atau keduanya
```

---

## 5. Bootstrap Desktop Runtime Task

```text
Sebelum mulai, baca dan ikuti:
- CLAUDE.md
- docs/technical-blueprint.md
- docs/runtime-matrix.md
- docs/adr/ADR-003-auth-web-vs-desktop.md
- docs/adr/ADR-004-release-strategy-web-desktop.md
- .agent/rules/desktop-runtime-boundary.md

Task ini fokus ke desktop runtime.

Audit dulu:
- apakah flow ini masih bergantung ke route web
- apakah auth/session desktop aman
- apakah ada import chain yang menarik dependency server/native ke bundle browser
- apakah area ini desktop-dev-ready atau desktop-release-ready

Kalau belum aman untuk desktop production, lebih baik fail-secure atau guarded daripada dipaksakan terlihat siap.
```

---

## 6. Bootstrap Bug Audit

```text
Sebelum mulai, baca dan ikuti:
- CLAUDE.md
- docs/technical-blueprint.md
- docs/runtime-matrix.md
- .agent/rules/desktop-runtime-boundary.md
- .agent/rules/schema-sync-safety.md

Audit bug dulu secara teknis, jangan langsung patch buta.
Cari akar masalah, tentukan impact runtime-nya, lalu fix langsung.
Sebelum edit file, sebutkan file yang akan diubah.
Setelah selesai, laporkan:
- file yang diubah
- akar masalah
- solusi
- hasil validasi
- langkah retest
- residual risk
```

---

## 7. Bootstrap Release / Build Task

```text
Sebelum mulai, baca dan ikuti:
- CLAUDE.md
- docs/technical-blueprint.md
- docs/runtime-matrix.md
- docs/adr/ADR-004-release-strategy-web-desktop.md
- .agent/rules/desktop-runtime-boundary.md

Task ini fokus ke build/release.

Jangan buka jalur release desktop palsu.
Validasi bertahap:
- bunx biome check .
- bunx tsc --noEmit
- bun run build
- bun run build:desktop

Jika desktop release belum aman, jelaskan kenapa dan pertahankan fail-secure behavior.
```

---

## 8. Fast Rule of Thumb

Kalau bingung harus pakai prompt mana:
- task modul Fase 2 -> pakai `Bootstrap Fase 2 Umum`
- task master data -> pakai `Bootstrap Fase 2.1 Master Data`
- task migration/schema -> pakai `Bootstrap Schema / Sync Task`
- task Tauri/desktop -> pakai `Bootstrap Desktop Runtime Task`
- task bug -> pakai `Bootstrap Bug Audit`
- task build/deploy -> pakai `Bootstrap Release / Build Task`

