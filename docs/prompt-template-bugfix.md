# Prompt Template: Bug Fixing

```text
Sebelum mulai, wajib baca dan ikuti:
- README-AGENT-START.md
- CLAUDE.md
- docs/new-chat-bootstrap.md
- docs/runtime-matrix.md
- .agent/rules/desktop-runtime-boundary.md
- .agent/rules/schema-sync-safety.md

Kalau bug hanya muncul di deploy web atau packaged desktop, wajib baca juga:
- docs/runtime-boundary-incident-postmortem.md

Task ini fokus ke bug fixing.
Aturan kerja:
- audit teknis dulu, jangan langsung patch buta
- cari akar masalah, bukan cuma gejala
- sebelum edit file, sebutkan file yang akan diubah
- kalau bug hanya muncul di environment tertentu, anggap dulu sebagai runtime boundary issue sampai terbukti bukan
- utamakan fail-secure
- jangan klaim final kalau baru candidate

Validasi minimal:
- bunx biome check .
- bunx tsc --noEmit
- bun run build
- kalau menyentuh desktop packaged/build, jalankan juga build desktop yang relevan

Output wajib:
- file yang diubah
- akar masalah
- solusi
- hasil validasi
- langkah retest
- residual risk
- status jujur
```
