# Prompt Template: All-in-One

```text
Sebelum mulai, wajib baca dan ikuti:
- README-AGENT-START.md
- CLAUDE.md
- docs/new-chat-bootstrap.md

Kalau task melanjutkan incident sync/students/attendance/settings yang pernah dibedah di repo ini, baca juga:
- docs/thread-checkpoint-sync-attendance.md
- docs/playbooks/desktop-sync-recovery.md
- docs/playbooks/student-class-drift-recovery.md
- docs/playbooks/attendance-verification-checklist.md

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
- packaged desktop harus dianggap runtime berbeda dari web, `bun run dev`, dan `bun tauri dev`
- jika bug hanya muncul di MSI/deploy, anggap dulu sebagai runtime boundary issue sampai terbukti bukan

Prioritas audit:
1. bedakan dulu issue ini `web`, `desktop packaged`, atau `keduanya`
2. cek apakah artifact/runtime yang dites benar-benar artifact terbaru atau stale
3. cek boundary auth, middleware, runtime bootstrap, dan request path
4. baru setelah itu cek business logic CRUD biasa

Aturan kerja utama:
- audit teknis dulu, jangan asumsi
- sebelum edit file, sebutkan file yang akan diubah
- jaga boundary web vs desktop tetap bersih
- jaga source of truth, auth safety, schema safety, dan sync safety
- kalau bug hanya muncul di environment tertentu, anggap dulu sebagai runtime boundary issue sampai terbukti bukan
- utamakan fail-secure
- jangan klaim final kalau artifact/runtime target nyata belum lolos smoke
- kalau task menyentuh release, sebutkan channel installer yang benar-benar lolos
- jangan berhenti di analisis kalau task-nya memang butuh eksekusi
- jangan menyamakan build sukses dengan runtime target sehat

Aturan coding yang wajib dijaga:
- jangan tarik module native/server-only ke jalur client browser sembarangan
- jangan biarkan flow desktop inti diam-diam bergantung ke `/api/*` web biasa
- jangan jadikan state client sebagai satu-satunya bukti auth packaged desktop
- jangan pakai wildcard resource desktop kalau source of truth artifact harus tunggal dan stabil
- jangan pertahankan copy transisional/fase lama di UI produksi kalau sudah tidak relevan
- jangan biarkan hook/page punya source of truth ganda untuk filter, search, atau auth state
- jika desktop membutuhkan marker runtime yang stabil, lebih aman gunakan proof server-side + marker publik non-sensitif daripada mengandalkan query param sementara
- untuk web auth production, dependency native harus optional/fallback-safe

Hal yang harus dilakukan:
- verifikasi path request desktop benar-benar masuk ke boundary runtime lokal saat packaged
- verifikasi middleware desktop punya proof runtime server-side yang stabil
- verifikasi logout/login ulang packaged tidak merusak proof runtime
- verifikasi artifact MSI yang dites memang artifact terbaru, bukan cache/extracted runtime lama
- verifikasi `.next/types` tidak dijadikan source of truth typecheck saat artefaknya parsial atau stale
- sempitkan resource packaging ke file yang benar-benar jadi contract release
- gunakan nama artifact runtime yang stabil jika jalur packaging rawan menangkap file timestamp lama
- dokumentasikan recovery path build jika host Windows sering timeout pada `bun tauri build`
- catat timestamp, ukuran, hash, dan status smoke untuk artifact release

Hal yang tidak boleh dilakukan:
- jangan signoff `desktop final` tanpa menyebut channel installer yang lolos, misalnya `MSI`
- jangan menganggap `MSI ready` berarti `NSIS ready`
- jangan menganggap `works on dev` sebagai bukti packaged desktop sehat
- jangan edit artefak generated sebagai solusi utama jangka panjang; kalau terpaksa untuk recovery, pindahkan pelajarannya balik ke source script/config
- jangan biarkan `tsc` merah palsu karena include `.next/types` yang stale
- jangan mendistribusikan MSI kalau secret packaged atau runtime contract belum diaudit
- jangan menghapus bundle/runtime lama secara agresif tanpa menangani file lock Windows

Checklist investigasi cepat:
- apakah request client mendapat HTML/non-JSON padahal mengharapkan API JSON?
- apakah packaged runtime masih memakai extracted runtime/cache versi lama?
- apakah settings/logout memicu bootstrap atau redirect yang menghapus identitas runtime?
- apakah students/attendance gagal karena request jatuh ke web path, bukan desktop-local path?
- apakah MSI stale masih dipakai user walau source repo sudah fixed?
- apakah `main.wxs`/resource bundling menangkap tar lama yang sudah tidak relevan?

Validasi minimal:
- bunx biome check .
- bunx tsc --noEmit
- bun run build

Tambahan validasi bila relevan:
- bun run build:desktop
- bun tauri build
- bun run build:desktop:msi-finalize
- cargo check
- test relevan yang disentuh

Catatan validasi penting:
- jika `bunx tsc --noEmit` merah karena `.next/types/**/*.ts` hilang atau parsial, perlakukan itu dulu sebagai kemungkinan false-negative dari artefak build stale
- jika `bun tauri build` timeout tetapi snapshot `src-tauri/target/release/wix/x64` sudah terbentuk, gunakan jalur recovery MSI yang terdokumentasi
- jika host Windows tidak bisa menjalankan ICE validation normal, bedakan antara kegagalan host toolchain vs kegagalan artifact aplikasi

Jalur recovery MSI yang sekarang diketahui aman:
1. pastikan `src-tauri/desktop-runtime/runtime-config.json` menunjuk ke `runtime-bundle.tar`
2. pastikan resource Tauri hanya membundle file runtime yang stabil
3. jika `bun tauri build` berhenti setelah snapshot WiX terbentuk, gunakan `bun run build:desktop:msi-finalize`
4. smoke-test MSI baru di mesin target sebelum signoff final

Changelog pelajaran dari thread ini yang harus diingat untuk chat berikutnya:
- bug students/attendance/settings packaged desktop bisa berasal dari runtime desktop kehilangan identitas setelah redirect loopback, bukan dari halaman itu sendiri
- marker runtime desktop yang stabil di client sangat membantu mencegah packaged app salah turun ke mode web
- stale installer dan stale extracted runtime bisa membuat fix terlihat “tidak masuk” padahal source repo sudah benar
- `desktop-runtime/**/*` sebagai resource bundling terlalu longgar untuk release yang butuh artifact tunggal
- archive runtime yang bertimestamp mempersulit WiX dan recovery; contract yang stabil lebih aman
- jalur finalisasi MSI dari snapshot WiX perlu didokumentasikan sebagai recovery resmi, bukan knowledge tribal
- release note harus diperbarui setelah artifact final benar-benar berubah, termasuk timestamp, ukuran, dan hash baru

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
