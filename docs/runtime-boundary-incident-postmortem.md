# Runtime Boundary Incident Postmortem

Tanggal referensi: 1 April 2026

Dokumen ini merangkum dua incident besar yang sempat memakan waktu paling banyak pada fase finalisasi:
- incident auth web di Vercel terkait `argon2`
- incident login desktop packaged `MSI`

Tujuan dokumen ini:
- menjelaskan kenapa incident-nya terasa sulit
- menyimpan pelajaran arsitektur yang benar
- memberi guardrail engineering supaya tim tidak mengulang investigasi dari nol

---

## 1. Ringkasan Eksekutif

Kedua incident ini terlihat seperti bug login biasa, tetapi akar masalahnya bukan business logic kredensial. Masalah utamanya ada di **runtime boundary**.

Artinya:
- kode yang sehat di satu runtime tidak otomatis sehat di runtime lain
- `dev`, `deploy web`, dan `desktop packaged` harus dianggap sebagai environment yang berbeda secara nyata
- auth yang bergantung pada asumsi runtime akan sangat mudah rusak pada tahap deploy atau packaging

Benang merah kedua incident:
- lokal/dev terlihat sehat
- problem baru muncul setelah deploy atau setelah installer dipasang
- gejala awal misleading
- perbaikan baru stabil setelah boundary tiap runtime dibuat eksplisit

---

## 2. Incident A: Web Vercel dan Argon2

### Gejala

- login web production sempat bermasalah setelah deploy
- auth yang sehat di lokal tidak otomatis sehat di Vercel
- salah satu sinyal error yang harus diwaspadai adalah dependency native `argon2`

### Akar Masalah

Web runtime di Vercel tidak boleh dianggap setara dengan runtime lokal yang bisa memakai native dependency dengan bebas.

Masalah inti:
- `argon2` native adalah dependency yang sensitif terhadap runtime
- local/dev bisa lolos
- serverless/deploy target bisa gagal load package native, atau tidak konsisten perilakunya

Jadi incident ini bukan karena password user salah, tetapi karena **strategi verifikasi hash terlalu bergantung pada native runtime**.

### Solusi yang Diambil

- web auth tidak lagi mengandalkan native `argon2` sebagai jalur default
- default web memakai `hash-wasm`
- native `argon2` dijadikan opt-in saja

### Pelajaran

- web auth harus deployment-safe, bukan hanya local-safe
- dependency native di jalur auth web harus diperlakukan sebagai high-risk
- untuk runtime web production, fallback yang portabel lebih penting daripada dependency yang “ideal” tetapi rapuh

---

## 3. Incident B: Desktop Packaged MSI Login

### Gejala

Gejala berubah-ubah sepanjang investigasi:
- `Email atau password salah`
- blank/halaman tidak muncul
- `127.0.0.1 refused to connect`
- `Verifying...` terus
- setelah login justru balik ke `/login`
- logout lalu login ulang hanya berhasil jika app ditutup dan dibuka lagi

### Kenapa Sulit

Karena yang rusak bukan satu fungsi login, tetapi gabungan beberapa layer:
- startup runtime packaged
- cache extracted runtime
- auth native desktop
- state client/store
- middleware Next di embedded server
- loopback session proof
- flow logout dan relogin

Semua layer itu hidup bersamaan hanya pada packaged app. Di `tauri dev` atau `bun run dev`, banyak asumsi runtime masih “tertolong”.

### Akar Masalah Utama

1. Auth desktop lokal dan middleware server tidak berbagi bukti sesi yang stabil.
   Dari sisi client login tampak sukses, tetapi server tetap menganggap user belum login.

2. Runtime packaged tidak identik dengan runtime dev.
   Patch bisa terlihat tidak masuk karena extracted runtime lama masih dipakai.

3. Logout sempat menghapus proof runtime desktop.
   Akibatnya login ulang dalam sesi app yang sama gagal sampai app direstart.

4. Navigasi sukses desktop sempat terlalu bergantung pada transisi client router.
   Ini membuat gejala seperti refresh/loop lebih membingungkan.

### Solusi yang Diambil

- embedded local web server production dibuat nyata
- startup manager native menangani `spawn / probe / stop`
- runtime bundle dibuat versioned untuk menghindari stale extracted runtime
- auth desktop dibuat native-first dan fail-fast
- middleware loopback diberi proof runtime server-side yang stabil
- logout dibetulkan agar tidak merusak proof runtime desktop
- navigasi sukses desktop dibuat lebih deterministik

### Pelajaran

- desktop packaged harus dianggap runtime sendiri, bukan sekadar “tauri dev yang dibuild”
- state auth client tidak cukup; middleware/runtime packaged juga harus punya bukti yang konsisten
- installer smoke nyata wajib ada untuk flow auth inti

---

## 4. Kenapa Dua Incident Ini Mirip

Walau terjadi di target yang berbeda, pola keduanya sama:

- **Vercel incident**
  Auth rusak karena asumsi native runtime dibawa ke deploy target web.

- **MSI incident**
  Auth rusak karena asumsi dev/client runtime dibawa ke packaged desktop.

Kesamaan arsitektur:
- problem muncul di boundary
- bukan bug CRUD biasa
- bukan bug validasi form biasa
- root cause baru terlihat di runtime target sebenarnya

Kesimpulan:
- `works on dev` bukan bukti cukup
- auth adalah area boundary-sensitive
- setiap target butuh kontrak runtime yang eksplisit

---

## 5. Guardrail Engineering

### A. Prinsip Umum

- pisahkan asumsi `web`, `desktop dev`, dan `desktop packaged`
- jangan biarkan jalur auth bergantung pada dependency native yang tidak portable tanpa fallback
- jangan biarkan desktop packaged hanya bergantung pada state client untuk akses route inti
- jangan menyamakan “build sukses” dengan “runtime target sehat”

### B. Guardrail untuk Web

- default auth hash verification di web harus deployment-safe
- native dependency di web auth harus optional, bukan mandatory
- setiap perubahan auth web harus disertai smoke deploy:
  - login production
  - `/api/auth/session`
  - callback credentials
  - cek log runtime

### C. Guardrail untuk Desktop

- setiap perubahan auth packaged wajib dites pada artifact MSI nyata
- desktop runtime harus punya proof server-side sendiri untuk route yang dijaga middleware
- logout tidak boleh menghapus proof runtime aplikasi
- runtime bundle harus versioned agar cache lama tidak diam-diam dipakai

### D. Guardrail untuk Release

- signoff dilakukan per target runtime, bukan per repo secara umum
- web-ready tidak berarti desktop-ready
- desktop MSI-ready tidak berarti NSIS-ready
- release note harus menyebut jelas channel mana yang benar-benar didukung

---

## 6. Checklist Investigasi Ulang Jika Incident Serupa Terjadi

### Untuk Web Auth

1. Cek apakah bug hanya muncul di deploy target.
2. Cek dependency native di jalur auth.
3. Cek log runtime production.
4. Verifikasi `/api/auth/session`.
5. Pastikan fallback portabel masih aktif.

### Untuk Desktop Auth

1. Bedakan apakah bug muncul di `tauri dev` atau hanya di `MSI`.
2. Verifikasi runtime bundle yang dipakai memang build terbaru.
3. Verifikasi embedded server loopback sehat.
4. Verifikasi auth native desktop.
5. Verifikasi middleware/runtime server punya proof sesi yang konsisten.
6. Verifikasi logout tidak merusak sesi runtime desktop.

---

## 7. Action Lanjutan yang Disarankan

- pertahankan policy `MSI-only signoff` sampai `NSIS` diuji terpisah
- teruskan roadmap pengurangan secret packaged
- tambahkan regression smoke untuk login/logout/relogin pada packaged desktop
- dokumentasikan setiap incident boundary besar sebagai postmortem serupa

---

## 8. Kesimpulan

Dua incident ini menegaskan keputusan arsitektur EduCore:
- web harus **online-first dan deployment-safe**
- desktop harus **local-first dan packaged-runtime-safe**

Masalah paling sulit bukan muncul karena fitur kurang, tetapi karena boundary runtime tidak dibuat eksplisit sejak awal. Setelah boundary itu diberi kontrak yang jelas, barulah auth menjadi stabil di target sebenarnya.
