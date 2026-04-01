# Prompt Template: All-in-One

```text
Sebelum mulai, wajib baca dan ikuti:
- README-AGENT-START.md
- CLAUDE.md
- docs/new-chat-bootstrap.md

Kalau task menyentuh arsitektur/runtime/sync/build/release, lanjut baca juga:
- docs/runtime-matrix.md
- docs/desktop-production-runtime-plan.md
- docs/desktop-embedded-server-design.md
- docs/production-release-checklist.md
- docs/adr/ADR-001-hybrid-local-first-architecture.md
- docs/adr/ADR-002-sync-and-source-of-truth.md
- docs/adr/ADR-003-auth-web-vs-desktop.md
- docs/adr/ADR-004-release-strategy-web-desktop.md
- .agent/rules/desktop-runtime-boundary.md
- .agent/rules/schema-sync-safety.md

Kalau bug hanya muncul di deploy web atau packaged desktop, wajib baca juga:
- docs/runtime-boundary-incident-postmortem.md

Konteks penting:
- EduCore adalah hybrid app: Next.js + Tauri
- web harus online-first
- desktop harus local-first/offline-capable
- source of truth global = cloud
- source of operation desktop = SQLite lokal + sync
- signoff Windows saat ini adalah MSI, bukan otomatis NSIS

Aturan kerja:
- audit teknis dulu, jangan asumsi
- sebelum edit file, sebutkan file yang akan diubah
- jaga boundary web vs desktop tetap bersih
- jaga source of truth, auth safety, schema safety, dan sync safety
- kalau bug hanya muncul di environment tertentu, anggap dulu sebagai runtime boundary issue sampai terbukti bukan
- utamakan fail-secure
- jangan klaim final kalau artifact/runtime target nyata belum lolos smoke
- kalau task menyentuh release, sebutkan channel installer yang benar-benar lolos
- jangan berhenti di analisis kalau task-nya memang butuh eksekusi

Validasi minimal:
- bunx biome check .
- bunx tsc --noEmit
- bun run build

Tambahan validasi bila relevan:
- bun run build:desktop
- bun tauri build
- cargo check
- test relevan yang disentuh

Output wajib:
- file yang diubah
- akar masalah
- solusi
- hasil validasi
- bagian yang sudah naik level
- bagian yang masih diblok / belum final dan alasannya
- langkah retest
- residual risk
- status jujur apakah web-only, desktop-only, atau keduanya
```
