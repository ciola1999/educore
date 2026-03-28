# Fase 2 Desktop-Native Checklist

Checklist operasional untuk menyelesaikan Fase 2 sesuai target desktop-native local runtime.

---

## Aturan Global

- [ ] Tidak ada client component yang import service DB langsung
- [ ] Tidak ada flow desktop inti yang bergantung ke `/api/*` web
- [ ] Semua write tervalidasi frontend + backend/local bridge
- [ ] Response error membedakan validation / not found / conflict / unauthorized
- [ ] `bunx biome check .` lulus
- [ ] `bunx tsc --noEmit` lulus
- [ ] `bun run build` lulus

---

## 2.1 Master Data

Entitas:
- [ ] tahun ajaran
- [ ] semester
- [ ] kelas
- [ ] mata pelajaran
- [ ] guru_mapel

Checklist:
- [ ] schema final sinkron local/cloud
- [ ] relasi aman
- [ ] desktop local CRUD aman
- [ ] web CRUD aman
- [ ] sync metadata ada
- [ ] loading/empty/error/success state lengkap
- [ ] role/access boundary lengkap
- [ ] tidak ada jalur mubazir

---

## 2.2 Jadwal

Checklist:
- [ ] schema jadwal final
- [ ] relasi ke kelas/mapel/guru_mapel/waktu aman
- [ ] local conflict detection ada
- [ ] desktop editor bisa jalan tanpa route web
- [ ] web editor/viewer sinkron
- [ ] sync delta aman
- [ ] perubahan jadwal tidak merusak modul attendance

---

## 2.3 Absensi

Checklist:
- [ ] manual attendance desktop production-safe
- [ ] QR flow production-safe atau dibatasi eksplisit
- [ ] queue sync aman
- [ ] history/report tidak web-dependent di desktop inti
- [ ] source of truth attendance jelas
- [ ] tidak ada duplicate request besar saat initial load

---

## 2.4 Keuangan Dasar

Checklist:
- [ ] schema tagihan
- [ ] schema pembayaran
- [ ] schema kategori_biaya
- [ ] angka tervalidasi ketat
- [ ] audit trail ada
- [ ] soft delete policy jelas
- [ ] desktop local write aman
- [ ] web write aman
- [ ] reporting dasar aman
- [ ] sync tidak merusak saldo/status

---

## Desktop Production Gate

Desktop release baru boleh dibuka jika:
- [ ] semua flow inti Fase 2 tidak lagi tergantung route web
- [ ] tidak ada dependency server/native yang bocor ke browser bundle
- [ ] `bun run build:desktop` lulus tanpa guard fail-secure
- [ ] `bun tauri build` menghasilkan bundle yang valid

Kalau salah satu belum terpenuhi:
- [ ] tetap blok release desktop secara eksplisit

