# Finance Desktop Smoke Checklist

Tanggal referensi: 6 Mei 2026

Checklist ini dipakai untuk signoff manual akhir `Finance desktop` sebelum MSI dianggap siap produksi.

Scope checklist ini mengikuti runtime desktop saat ini:
- overview
- invoices
- payments
- periods
- accounting
- audit
- governance action `admin` / `super_admin` only

---

## 0. Automated Gate Terakhir

Status 6 Mei 2026:
- [x] Finance unit/runtime/sync guard tests lulus: 48 tests
- [x] `bunx biome check .` lulus
- [x] `bun run typecheck` lulus
- [x] `bun run build` lulus
- [x] `bun run build:desktop` lulus
- [x] `bun tauri build` menghasilkan MSI

Artifact MSI kandidat:
- `src-tauri/target/release/bundle/msi/educore_0.1.0_x64_en-US.msi`
- ukuran: 69,869,568 bytes

Catatan:
- status ini belum menggantikan smoke manual setelah MSI di-install
- Finance tetap `guarded` sampai restart, sync, dan installed MSI smoke lulus

---

## 1. Preflight

- [ ] login desktop berhasil dengan akun `admin` atau `super_admin`
- [ ] sidebar menampilkan menu `Finance`
- [ ] tidak ada redirect liar dari `/dashboard/finance/*` ke `/dashboard`
- [ ] tidak ada error session web / NextAuth di console desktop
- [ ] sync status desktop tidak menunjukkan error stale config

---

## 2. Route Load

- [ ] `/dashboard/finance`
- [ ] `/dashboard/finance/invoices`
- [ ] `/dashboard/finance/payments`
- [ ] `/dashboard/finance/periods`
- [ ] `/dashboard/finance/accounting`
- [ ] `/dashboard/finance/audit`

Ekspektasi:
- semua route terbuka tanpa blank screen
- banner runtime desktop tampil konsisten
- role non-admin tetap melihat notice governance yang jujur

---

## 3. Invoices

- [ ] daftar invoice tampil
- [ ] search invoice / student berjalan
- [ ] tab filter `Outstanding`, `Settled`, `Overdue`, `Voided` berjalan
- [ ] `Generate Batch` berhasil membuat batch invoice
- [ ] `VOID` hanya aktif untuk `admin` / `super_admin`
- [ ] `VOID` non-admin tidak bisa dijalankan
- [ ] jika `VOID` dijalankan, flow approval/audit berjalan dan tidak error

Ekspektasi:
- tidak ada invoice ganda
- invoice yang diubah tetap konsisten setelah refresh

---

## 4. Payments

- [ ] search siswa berjalan
- [ ] lookup invoice outstanding berjalan
- [ ] waterfall allocation tampil
- [ ] metode pembayaran bisa dipilih
- [ ] `EXECUTE PAYMENT` berhasil
- [ ] receipt / hasil pembayaran tidak error setelah refresh

Ekspektasi:
- payment tidak ganda
- outstanding invoice ter-update benar
- tidak ada mismatch alokasi
- credit balance hanya muncul jika memang ada overpayment

---

## 5. Periods

### Admin / Super Admin
- [ ] `NEW PERIOD` berhasil
- [ ] `OPEN -> SOFT_CLOSED` berhasil
- [ ] `SOFT_CLOSED -> OPEN` berhasil
- [ ] `SOFT_CLOSED -> CLOSED` berhasil
- [ ] `OPEN -> CLOSED` langsung ditolak
- [ ] aksi governance meminta alasan
- [ ] approve request berhasil
- [ ] reject request berhasil

### Non-Admin
- [ ] approval button tidak bisa dieksekusi
- [ ] `NEW PERIOD` tidak bisa dieksekusi
- [ ] state control tidak bisa dijalankan

Ekspektasi:
- period state machine konsisten
- request non-`PENDING` tidak bisa diproses ulang
- audit log mencatat alasan governance

---

## 6. Accounting

### Admin / Super Admin
- [ ] ledger tampil
- [ ] search/filter ledger berjalan
- [ ] `New Adjustment` dialog terbuka
- [ ] minimal 2 line jurnal bisa diisi
- [ ] sistem menolak debit/kredit yang tidak seimbang
- [ ] submit manual adjustment berhasil jika balance valid

### Non-Admin
- [ ] `New Adjustment` tidak bisa dieksekusi
- [ ] ledger tetap bisa dibaca

Ekspektasi:
- journal entry baru muncul setelah refresh
- audit log menyimpan `reason`
- tidak ada jurnal yang unbalanced

---

## 7. Audit

- [ ] audit log tampil
- [ ] action `approval`, `period transition`, `manual adjustment`, `batch invoice`, dan `payment` muncul setelah aksi dijalankan
- [ ] actor yang tercatat sesuai pengguna yang login

---

## 8. Restart & Persistence

- [ ] tutup app desktop
- [ ] buka kembali app desktop
- [ ] login ulang bila perlu
- [ ] data Finance terakhir tetap konsisten
- [ ] period terakhir tetap pada status yang benar
- [ ] journal/manual adjustment tetap ada
- [ ] payment/receipt tetap ada

---

## 9. Sync Verification

- [ ] jalankan push sync saat online
- [ ] jalankan pull sync saat online
- [ ] tidak ada duplicate:
  - `invoices`
  - `payments`
  - `payment_allocations`
  - `receipts`
  - `credit_balances`
  - `approval_requests`
  - `journal_entries`
- [ ] pending local row tidak tertimpa buta saat sync

---

## 10. Release Notes

Desktop Finance boleh dianggap siap menuju signoff MSI jika:
- semua langkah di atas lolos
- `bunx tsc --noEmit` lulus
- suite Finance test lulus
- `bun run build` lulus setelah lock environment bersih
- MSI smoke juga menunjukkan hasil yang sama dengan `bun tauri dev`

Jika salah satu gagal, status tetap:
- `desktop-dev-ready`
- atau `guarded` untuk area yang gagal
