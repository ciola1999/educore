# Prompt Template: General

```text
Sebelum mulai, wajib baca dan ikuti:
- README-AGENT-START.md
- CLAUDE.md
- docs/new-chat-bootstrap.md

Kalau task menyentuh arsitektur/runtime/sync/build, lanjut baca juga:
- docs/runtime-matrix.md
- docs/adr/ADR-001-hybrid-local-first-architecture.md
- docs/adr/ADR-002-sync-and-source-of-truth.md
- docs/adr/ADR-003-auth-web-vs-desktop.md
- docs/adr/ADR-004-release-strategy-web-desktop.md
- .agent/rules/desktop-runtime-boundary.md
- .agent/rules/schema-sync-safety.md

Aturan kerja:
- audit teknis dulu, jangan asumsi
- sebelum edit file, sebutkan file yang akan diubah
- jaga boundary web vs desktop tetap bersih
- jaga source of truth, auth safety, schema safety, dan sync safety
- jangan berhenti di analisis kalau task-nya memang butuh eksekusi

Setelah selesai, laporkan:
- file yang diubah
- akar masalah
- solusi
- hasil validasi
- langkah retest
- residual risk
- status jujur apakah web-only, desktop-only, atau keduanya
```
