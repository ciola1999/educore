# Implementation Plan - 2.4 Keuangan Dasar (FINAL)

Sistem ini dirancang sebagai **Financial System**, bukan hanya payment tracker. Mendukung operasional harian sekolah dengan audit trail kuat, double-entry accounting basic, dan kontrol periode.

## 1. Arsitektur Data (Tables & Schema)

Semua tabel menggunakan `syncMetadata` dan UUID.

### A. Master & Setup
- `billing_categories`: Kategori tagihan (SPP, Ujian, Buku, dll).
- `payment_methods`: Cara bayar (Cash, Transfer, VA, QRIS).
- `accounts`: Bagan Akun (Chart of Accounts) untuk Double Entry (e.g., Cash, AR, Revenue, Expense).

### B. Billing (Piutang)
- `billing_batches`: Grup tagihan otomatis (e.g., "SPP April 2026").
- `invoices`: Dokumen utama piutang siswa.
  - Fields: `invoice_no` (Unique INDEX), `student_id`, `dueDate`, `status` (DRAFT, OPEN, PARTIAL, PAID, OVERPAID, VOID, WRITEOFF), `totalAmount`, `totalPaid`, `outstanding`, `discountTotal`, `penaltyTotal`, `studentSnapshot`.
- `invoice_items`: Detail item per invoice.
- `invoice_discounts` & `invoice_penalties`: Catatan diskon/denda per invoice.

### C. Payment (Penerimaan)
- `payments`: Dokumen penerimaan uang.
  - Fields: `payment_no`, `student_id`, `methodId`, `amount`, `date`, `isConfirmed`.
- `payment_allocations`: Relasi many-to-many antara Payment dan Invoice.
- `receipts`: Bukti bayar resmi (Snapshot dari Payment + Invoice).
- `credit_balances`: Saldo lebih siswa (Overpayment).

### D. Accounting (General Ledger)
- `journal_entries`: Input jurnal akuntansi otomatis (Auto-posting).
- `journal_lines`: Baris baris jurnal (Double entry: Debit = Credit).

### E. Control & Audit
- `finance_periods`: Periode keuangan (OPEN, SOFT_CLOSED, CLOSED).
- `approval_requests`: Permintaan persetujuan untuk `Refund`, `Void`, `Write-off`.
- `finance_logs`: Immutable logs (Action, Old/New Data, User, Timestamp).

---

## 2. Logic & Services

### `FinanceService` (Core)
- **Batch Logic**: Membuat `invoices` masal untuk seleksi siswa.
- **Payment Allocation**: Alokasi otomatis (FIFO) atau manual dari satu `payment` ke beberapa `invoices`.
- **Status Lifecycle**: Memastikan transisi status invoice valid (e.g., tidak bisa VOID jika sudah PAID).
- **Snapshotting**: Menyimpan data siswa (nama, kelas, NIS) ke dalam field `studentSnapshot` saat invoice dibuat.

### `AccountingService` (Automatic Posting)
- **Invoice Post**: Debit [AR], Kredit [Revenue].
- **Payment Post**: Debit [Cash], Kredit [AR].
- **Void Post**: Reverse entries.

### `ControlService` (Period & Validation)
- Mencegah transaksi pada tanggal yang masuk dalam `CLOSED` period.
- Menangani `approval_requests` sebelum melakukan `Write-off` atau `Refund`.

---

## 3. Sync & Integrity Protocol

### Sync Strategy
- Semua tabel baru didaftarkan di `src/lib/sync/turso-sync.ts`.
- **Constraint**: `amount` selalu >= 0, `debit == credit`.
- **Conflict Strategy**: 
    - Gunakan HLC LWW secara default.
    - **Desktop Conflict Review**: Khusus untuk tabel `invoices` dan `payments`, jika `version` berbeda, tampilkan Modal Perbandingan data Lokal vs Cloud agar Admin bisa memilih secara sadar.

### Audit Immutability
- Tidak ada fitur `Hard Delete` untuk data transaksi.
- Perubahan apa pun memicu `finance_logs`.
- Data `CLOSED` period bersifat read-only.

---

## 4. UI/UX Plan

### Pages (`src/app/dashboard/finance/*`)
1.  **Overview**: Widget Summary (Piutang Macet, Revenue Bulan Ini, Status Cash).
2.  **Invoices**: List invoice, tab status, tombol "Batch Generate".
3.  **Payments**: Entry payment baru + Alokasi ke tagihan.
4.  **Periods**: Manajemen buka/tutup periode.
5.  **Audit Logs**: Browser riwayat transaksi lengkap.

---

## 5. Role Access (Finalized)

- **Superadmin / Finance Admin**: Full CRUD + Approval Grant.
- **Staff**: Read-only (Melihat data, tidak bisa create/edit/void).
- **Auditor**: Read-only access ke Logs dan Ledger.
- **Lainnya**: Akses dilarang (Menu disembunyikan).

---

## 6. Implementation Roadmap

1.  **Phase 1: Foundation (Master & Schema)**: Update `schema.ts` dengan 15+ tabel baru & Master data setup.
2.  **Phase 2: Billing Engine**: Batch invoice generator & Lifecycle logic.
3.  **Phase 3: Payment Engine**: Multi-allocation logic, Receipts, & Overpayment.
4.  **Phase 4: Accounting & Ledger**: Auto-posting journal entries.
5.  **Phase 5: Control & Audit**: Period management & Approval flow.
6.  **Phase 6: UI & Sync Integration**: Dashboard development & desktop-sync smoke test.

---
**Status**: FINAL ARCHITECTURE.
**Rule**: Tidak boleh ada manual override di database. Semua perubahan harus melalui Service Layer agar Audit Log dan Accounting Entry tercipta secara konsisten.
