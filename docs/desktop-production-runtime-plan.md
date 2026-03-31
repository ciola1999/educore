# Desktop Production Runtime Plan

Tanggal referensi: 1 April 2026

Dokumen ini menjelaskan transisi dari desktop release yang tadinya diblok menjadi jalur production MSI yang valid, serta follow-up yang masih perlu dilakukan agar packaging desktop makin keras secara security dan distribusi.

Status saat ini:
- `bun tauri dev` = sehat untuk parity debug
- `bun run build` = sehat
- `bun run build:desktop` = sehat
- `bun tauri build` = sehat untuk channel MSI
- `desktop MSI packaged artifact` = sudah lolos smoke inti
- `desktop NSIS` = belum disignoff

---

## 1. Decision Yang Sudah Diambil

Strategi runtime production yang dipakai untuk Windows adalah:
- `Embedded Local Web Server`

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

Implementasi yang sekarang aktif:
- startup manager native menjalankan embedded server di loopback
- window Tauri menunggu health check sebelum membuka UI utama
- desktop auth memakai boundary lokal/native terlebih dahulu
- middleware loopback punya proof runtime server-side sendiri
- release Windows yang disignoff saat ini adalah `MSI`

---

## 2. Minimal Scope Yang Sudah Ditutup

Checklist teknis minimum:

- [x] proses embedded server lokal production sudah nyata
- [x] runtime Tauri tidak lagi menunjuk static export palsu
- [x] startup desktop menunggu health check app lokal sebelum membuka window utama
- [x] auth desktop tidak lagi bergantung pada browser web session biasa
- [x] route desktop-safe utama sudah lolos smoke
- [x] sync action fail-secure saat offline
- [x] packaging membawa dependency runtime yang benar
- [x] crash/failure startup menghasilkan state error yang jujur

---

## 3. Hardening Yang Masih Disarankan

1. Pertahankan policy `MSI-only signoff` sampai channel `NSIS` punya smoke gate sendiri.
2. Minimalkan secret packaged.
   Target akhir:
   - runtime bundle tidak membawa token sync permanen
   - provisioning sync credential dilakukan saat first-run admin
   - credential disimpan di keyring / secure local store
3. Catat hash artifact final sebelum distribusi.
4. Tambahkan code signing MSI.
5. Pecah `desktop-local-api.ts` lebih lanjut agar audit auth/sync lebih mudah.

---

## 4. Gate Yang Sudah Lulus Untuk MSI

Desktop release baru boleh disebut kandidat nyata bila semua ini lulus:

- [x] `bunx biome check .`
- [x] `bunx tsc --noEmit`
- [x] `bun run build`
- [x] `bun run build:desktop`
- [x] `bun tauri build`
- [x] smoke desktop production artifact MSI lulus
- [x] tidak ada static export palsu
- [x] route inti desktop-safe tidak lompat ke flow web-only

---

## 5. Status Jujur Saat Ini

Posisi sekarang:
- web production = sehat
- desktop MSI = production final
- desktop NSIS = belum disignoff

Residual risk yang masih terbuka:
- installer desktop masih controlled artifact yang sensitif
- roadmap pengurangan secret packaged belum selesai
- channel `NSIS` belum punya smoke signoff sendiri
