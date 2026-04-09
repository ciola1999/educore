# planning-final-2.4keuangan.md

## Fase 2.4 — Keuangan (Educore)

### Tujuan
Membangun sistem keuangan sekolah yang:
- Aman untuk transaksi uang nyata
- Mendukung operasional harian (tagihan & pembayaran)
- Memiliki audit trail kuat
- Siap untuk laporan keuangan dan kontrol periode
- Minim manipulasi dan fraud

---

## 1. Billing & Invoice

### 1.1 Otomatisasi
- Batch generation (SPP, ujian, dll)
- Manual invoice tetap tersedia

### 1.2 Struktur Invoice
- invoice_no (unik)
- student_id
- tanggal & due date
- subtotal, discount, penalty
- total_amount
- total_paid
- outstanding
- snapshot data siswa

### 1.3 Discount
- Fixed / Percentage
- Bisa require approval

### 1.4 Penalty
- Fixed / Percentage / Daily
- Bisa di-waive (log wajib)

### 1.5 Status Lifecycle
- DRAFT
- OPEN
- PARTIAL
- PAID
- OVERPAID
- VOID
- WRITEOFF

---

## 2. Payment Management

### 2.1 Partial Payment
- 1 invoice → banyak payment
- 1 payment → banyak invoice (allocation)

### 2.2 Denormalisasi
- totalPaidAmount
- outstandingAmount

### 2.3 Payment Method
- Cash
- Transfer
- VA
- QRIS

### 2.4 Allocation
- Support over/under payment
- Tidak boleh melebihi amount

### 2.5 Receipt
- receipt_no unik
- snapshot data

---

## 3. Credit, Refund, Adjustment

### 3.1 Credit Balance
- Overpayment disimpan
- Bisa digunakan atau refund

### 3.2 Refund
- Harus approval
- Tidak boleh edit transaksi lama

### 3.3 Adjustment
- Koreksi resmi
- Wajib alasan & log

### 3.4 Write-off
- Penghapusan piutang
- Wajib approval

---

## 4. Accounting

### 4.1 Double Entry
- Accounts
- Journal
- Journal Lines

### 4.2 Auto Posting
- Invoice → AR vs Revenue
- Payment → Cash vs AR

### 4.3 Konsistensi
- Semua transaksi punya referensi

---

## 5. Audit & Logging

### 5.1 Finance Logs
- Action
- Old/New data
- User & timestamp

### 5.2 Immutable
- Tidak bisa edit/delete

---

## 6. Sync & Integrity

- Version check
- Conflict review
- No overwrite transaksi

---

## 7. Period & Closing

- OPEN
- SOFT_CLOSED
- CLOSED
- Tidak boleh edit periode closed

---

## 8. Role & Approval

### Role:
- Superadmin
- Finance Admin
- Staff
- Auditor
- Kepala Sekolah

### Approval:
- Refund
- Write-off
- Adjustment
- Void
- Reopen period

---

## 9. Reporting

- Outstanding
- Payment report
- Revenue per kategori
- Aging report

---

## 10. Prinsip Teknis

- UUID
- Decimal (bukan float)
- Transaction atomic
- Soft delete (void)
- Snapshot data

---

## 11. Prioritas

### Wajib
1. Invoice lifecycle
2. Payment allocation
3. Audit log
4. Role & approval
5. Period closing
6. Basic accounting

### Disarankan
7. Refund & write-off
8. Reporting
9. Payment gateway

---

## Kesimpulan
Sistem ini dirancang sebagai financial system, bukan hanya payment tracker.

---

# arsitektur

## Struktur Utama

### Master
- students
- academic_years
- billing_categories
- payment_methods
- accounts

### Billing
- billing_batches
- invoices
- invoice_items
- invoice_discounts
- invoice_penalties

### Payment
- payments
- payment_allocations
- receipts
- refunds
- credit_balances

### Accounting
- journal_entries
- journal_lines

### Control
- finance_periods
- approval_requests

### Audit
- finance_logs
- export_logs

---

## Relasi Inti

- student → invoices
- invoice → items
- invoice → payments (via allocation)
- payment → receipt
- payment → refund
- journal → lines

---

## Flow Utama

### Invoice
- Debit: AR
- Kredit: Revenue

### Payment
- Debit: Cash
- Kredit: AR

### Refund
- Debit: AR/Expense
- Kredit: Cash

### Write-off
- Debit: Expense
- Kredit: AR

---

## Constraint Penting

- amount >= 0
- debit = credit
- unique nomor dokumen

---

## Index

- invoice(student_id, status)
- payment(student_id)
- allocation(invoice_id)

---

## Rule Penting

- Tidak boleh hard delete
- Gunakan void
- Tidak boleh edit transaksi confirmed
- Semua perubahan masuk audit log

---

## ERD Ringkas

students → invoices → items
invoices ↔ payments (allocation)
payments → receipts
journal_entries → journal_lines

---

## Catatan

Arsitektur ini siap untuk:
- scaling
- audit
- multi school
- integrasi payment

Namun membutuhkan disiplin backend tinggi (no manual override).

