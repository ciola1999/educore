# Desktop Production Runtime Plan

Tanggal referensi: 30 Maret 2026

Dokumen ini menjelaskan kenapa desktop release EduCore masih diblok, dan apa yang harus dilakukan agar `bun run build:desktop` dan `bun tauri build` bisa benar-benar dibuka dengan jujur.

Status saat ini:
- `bun tauri dev` = jalur desktop utama untuk retest
- `bun run build` = sehat
- `bun run build:desktop` = sengaja diblok
- `bun tauri build` = belum boleh dianggap valid

Alasan blok saat ini:
- aplikasi desktop masih membutuhkan Next.js server features:
  - `/api/*`
  - auth web runtime contract
  - route handlers App Router
- [src-tauri/tauri.conf.json](/e:/Freelance/Project/educore/src-tauri/tauri.conf.json) masih menunjuk `frontendDist` ke `../out`
- static bundle `out/` tidak bisa menjalankan flow inti desktop yang sekarang justru bergantung pada adapter local + route contract Next

Jadi masalahnya bukan sekadar build tool, tetapi mismatch arsitektur:
- runtime desktop saat dev sehat karena ada Next dev server
- runtime desktop release akan rusak bila dipaketkan sebagai static export palsu

---

## 1. Decision Yang Harus Diambil

Sebelum membuka desktop release, tim harus memilih satu strategi runtime production.

### Opsi A: Embedded Local Web Server

Desktop release menjalankan server Next/Node lokal di loopback, lalu Tauri memuat URL lokal itu.

Kelebihan:
- paling dekat dengan arsitektur sekarang
- route handlers `/api/*` tetap hidup
- auth/settings/dashboard contract tidak perlu dibongkar total

Konsekuensi:
- installer lebih kompleks
- harus ada proses lifecycle untuk start/stop server lokal
- health check, port management, dan recovery crash harus ditangani

### Opsi B: Desktop-Only Runtime Tanpa Next Server

Semua flow inti dipindahkan penuh ke adapter desktop/Tauri tanpa ketergantungan route handlers Next.

Kelebihan:
- desktop paling bersih secara boundary
- tidak perlu sidecar server lokal

Konsekuensi:
- pekerjaan jauh lebih besar
- parity web vs desktop harus dijaga dua lapis
- banyak halaman/hook yang sekarang masih nyaman memakai `/api/*` perlu dibedah ulang

### Rekomendasi Saat Ini

Untuk EduCore saat ini, opsi paling realistis adalah:
- `Opsi A: Embedded Local Web Server`

Alasannya:
- codebase sekarang sudah stabil di kontrak App Router + route handlers
- desktop local adapter sudah kuat, tetapi masih hidup di sekitar kontrak route Next
- ini paling cepat membawa desktop dari `dev-safe` ke `release-candidate`

---

## 2. Minimal Scope Agar Desktop Build Boleh Dibuka

Checklist teknis minimum:

- [ ] tentukan proses yang menjalankan server lokal production di desktop
- [ ] `frontendDist`/runtime Tauri tidak lagi mengarah ke static export palsu
- [ ] startup desktop menunggu health check app lokal sebelum membuka window utama
- [ ] auth desktop tetap tidak bergantung pada browser web session
- [ ] semua route desktop-safe yang sudah dibuka tetap bekerja tanpa internet
- [ ] sync action tetap fail-secure saat offline
- [ ] packaging membawa dependency runtime yang benar
- [ ] crash server lokal menghasilkan state error yang jujur, bukan blank screen

---

## 3. Implementasi Yang Disarankan

Urutan implementasi yang paling sehat:

1. Buat bootstrap sidecar runtime desktop production.
   Sidecar ini menjalankan app server lokal yang setara dengan kontrak `next start`.

2. Tambahkan health endpoint/startup handshake.
   Tauri tidak membuka shell utama sebelum server lokal siap.

3. Ganti konfigurasi Tauri production.
   Jangan lagi menunjuk ke `../out` bila app masih butuh server features.

4. Pisahkan env desktop production.
   Pastikan auth/sync desktop production tidak diam-diam memakai env web production yang salah.

5. Tambahkan smoke test release artifact.
   Minimal:
   - login desktop
   - dashboard
   - students
   - attendance
   - settings
   - offline sync fail-secure

---

## 4. Gate Untuk Membuka Desktop Release

Desktop release baru boleh disebut kandidat nyata bila semua ini lulus:

- [ ] `bunx biome check .`
- [ ] `bunx tsc --noEmit`
- [ ] `bun run build`
- [ ] `bun run build:desktop`
- [ ] `bun tauri build`
- [ ] smoke desktop production artifact lulus
- [ ] tidak ada static export palsu
- [ ] tidak ada route inti yang diam-diam lompat ke web-only flow

---

## 5. Status Jujur Saat Ini

Posisi sekarang:
- web production = sehat
- desktop retest/dev-safe = kuat
- desktop packaged release = masih fail-secure diblok

Itu adalah status yang benar dan sengaja dipertahankan sampai strategi runtime production dipilih dan diimplementasikan.
