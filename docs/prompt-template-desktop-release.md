# Prompt Template: Desktop / Runtime / Release

```text
Sebelum mulai, wajib baca dan ikuti:
- README-AGENT-START.md
- CLAUDE.md
- docs/new-chat-bootstrap.md
- docs/runtime-matrix.md
- docs/desktop-production-runtime-plan.md
- docs/desktop-embedded-server-design.md
- docs/production-release-checklist.md
- docs/adr/ADR-003-auth-web-vs-desktop.md
- docs/adr/ADR-004-release-strategy-web-desktop.md
- .agent/rules/desktop-runtime-boundary.md
- .agent/rules/schema-sync-safety.md
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
- kalau issue hanya muncul di MSI/installer, anggap itu runtime boundary issue sampai terbukti bukan
- jaga boundary web vs desktop tetap bersih
- utamakan fail-secure
- jangan klaim desktop final kalau artifact nyata belum lolos smoke
- jika menyentuh release, sebutkan channel installer yang benar-benar lolos

Validasi:
- bunx biome check .
- bunx tsc --noEmit
- cargo check bila relevan
- bun run build
- bun run build:desktop bila relevan
- bun tauri build bila relevan

Output wajib:
- file yang diubah
- akar masalah
- solusi
- hasil validasi
- bagian yang sudah naik level
- bagian yang masih diblok / belum final dan alasannya
- langkah retest
- residual risk
- status jujur
```
