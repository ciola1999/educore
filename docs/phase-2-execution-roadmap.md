# Phase 2 Execution Roadmap

Roadmap operasional untuk menyelesaikan Fase 2 EduCore dengan target:
- web tetap stabil
- desktop tetap local-first
- sync contract tetap aman
- desktop production path bisa dibuka secara bertahap

---

## Goal

Fase 2 dianggap berhasil jika:
- Master Data lengkap dan sinkron
- Jadwal production-safe
- Absensi production-safe lintas runtime
- Keuangan dasar aman dan audit-friendly
- web build hijau
- desktop release path siap dibuka tanpa workaround palsu

---

## Milestone 1: Close 2.1 Master Data Properly

### Scope
- tahun ajaran
- semester
- kelas
- mata pelajaran
- guru_mapel

### Work items
- finalkan schema dan relasi
- finalkan local CRUD desktop
- finalkan web CRUD
- rapikan source of truth
- rapikan role/access boundary
- pasang sync metadata
- audit dead path dan duplicate flow

### Exit criteria
- tidak ada direct DB access dari client
- tidak ada flow desktop inti yang perlu route web
- data master sinkron antar runtime

---

## Milestone 2: Build 2.2 Jadwal on Top of Stable Master Data

### Scope
- jadwal
- relasi kelas/mapel/guru_mapel/semester
- conflict detector

### Work items
- schema jadwal final
- validasi bentrok lokal
- editor desktop local-first
- editor/viewer web
- sync delta jadwal

### Exit criteria
- bentrok guru/kelas/waktu bisa ditolak lokal
- desktop tidak butuh route web untuk membuat/mengubah jadwal
- web dan desktop membaca rule yang sama

---

## Milestone 3: Re-Audit 2.3 Attendance for Production Safety

### Scope
- create attendance
- history/report
- QR/manual flow
- sync queue

### Work items
- cek ulang runtime boundary
- cek ulang loading/performance
- cek apakah projection/summary adalah derived data, bukan truth utama
- tutup dependency web-only yang tersisa

### Exit criteria
- absensi desktop usable saat offline
- sync attendance aman
- reporting tidak merusak runtime boundary

---

## Milestone 4: Build 2.4 Keuangan Dasar Safely

### Scope
- kategori biaya
- tagihan
- pembayaran

### Work items
- schema keuangan final
- validasi angka
- audit trail
- desktop local-first write path
- web-compatible reporting
- sync-safe payment model

### Exit criteria
- tidak ada saldo/status yang rusak karena overwrite sembrono
- transaksi punya jejak audit
- desktop dan web memakai aturan bisnis yang sama

---

## Milestone 5: Open Desktop Production Build

### Work items
- audit semua halaman Fase 2
- pastikan route web tidak jadi dependency flow inti desktop
- pastikan bundle browser tidak menarik dependency server/native yang salah
- buka guard desktop build hanya jika benar-benar aman

### Exit criteria
- `bun run build:desktop` lulus
- `bun tauri build` valid
- hasil installer tidak misleading

---

## Recommended Weekly Order

1. close 2.1 fully
2. finalize sync contract 2.1
3. build 2.2
4. re-audit 2.3
5. build 2.4
6. open desktop production gate

---

## Validation Gate Per Checkpoint

```bash
bunx biome check .
bunx tsc --noEmit
bun run build
```

Untuk checkpoint desktop release:

```bash
bun run build:desktop
```

Jika gagal, harus dijelaskan:
- web-only
- desktop-only
- atau keduanya

