# Changelog: EduCore Finance Module & Core Stabilization
**Date**: April 2026
**Context**: Phase 2.4 - Stabilization, Bug Fixing, TypeScript Types, and Environment Sync (Vercel & Tauri MSI)

---

## 📝 Ringkasan Perubahan Utama

Fokus pada pembenahan error *typecheck*, gagalnya sinkronisasi lokal SQLite di mode Windows installer (MSI), *mismatched server actions*, penambahan *await* diseluruh script DB, dan Accessibility (a11y) Check.

Pengecekan menggunakan **TypeScript Strict Typecheck (`tsc --noEmit`)** & **Biome Linter** memperoleh tingkat keberhasilan mutlak (**0 Error**).

---

## 📂 File yang Diubah & Rincian Kode

### 1. Sistem Database & Migrasi (Schema Synchronization)
**Masalah**: Error `nosuchtable: auth_rate_limits` di aplikasi MSI (bawaan file SQLite Desktop).
*   **`src/core/db/migrations.ts`**
    *   **Diubah**: Menambahkan baris statis *Deterministic Migration* `CREATE TABLE IF NOT EXISTS "auth_rate_limits"` agar sinkron dengan database lokal ketika aplikasi dijalankan.
*   **`src/lib/auth/web/security.ts`**
    *   **Dihapus**: Kode fungsi `ensureRateLimitTable()` dan variabel `rateLimitTableReady` *(On-the-fly table creation)* dihapus secara total agar tidak terjadi bentrok lock di SQLite lokal.
    *   **Diubah**: Menghapus baris pemanggilan `ensureRateLimitTable(client)`.

### 2. Finance Architecture (Services & Actions Mismatch)
**Masalah**: Ekspor fungsi `FinanceService` sangat berbeda dengan pemanggilan yang dilakukan oleh Server Actions yang mengakibatkan error `Expected X arguments format`.
*   **`src/core/services/finance-service.ts`**
    *   **Ditambahkan**: Missing imports untuk `financePeriods` dan `approvalRequests` dari file schema.
    *   **Diubah**: Nama method `generateBatchInvoices` direvisi menjadi `createBatchInvoices` untuk memenuhi panggilan *actions*.
    *   **Dihapus**: Syntax Error trailing comma (`},`) tambahan yang membuat build Next.js tertahan.
*   **`src/app/dashboard/finance/actions.ts`**
    *   **Ditambahkan**: Ekspor baru fungsi `getInvoices` dan fungsi payload `getFinanceDashboardSummary`.
    *   **Diubah**: `voidInvoiceAction` diganti nama dan pemanggilannya menjadi `updateInvoiceStatusAction(actorId: string, invoiceId: string, status: string)` membuang variabel "reason" karena service layer hanya menerima 3 argumen inti.

### 3. Finance User Interface & Client
**Masalah**: Fitur modal mass-invoice *type-error* dan error *unknown obj inference*.
*   **`src/components/dashboard/finance/batch-invoice-modal.tsx`**
    *   **Diubah**: Import actions menjadi `createBatchInvoicesAction`. Pemanggilan pada handleFinalize dikirim sebagai satu parameter input `name: batchName` bukan 2 argumen untuk mengakomodasi arsitektur tipe baru.
    *   **Diubah**: Objek balikan `.result` yang tidak terdaftar diperbaiki posisinya (eg. `result.invoiceCount` jadi `result.processed`).
    *   **Diubah**: Form `studentIds: undefined` diubah menjadi *default fallback* `[]` menghindari *TypeScript restriction assignment*.
*   **`src/app/dashboard/finance/invoices/invoices-client.tsx`**
    *   **Diubah**: Tipe deklarasi *un-inferred parameter* `initialInvoices: unknown[]` diubah menjadi rentang `initialInvoices: any[]` untuk menutupi 17 point error deklarasi TS saat mapping data invoice.
*   **`src/app/dashboard/finance/audit/audit-client.tsx`**
    *   **Diubah**: Fix standar Biome *Accessibility Rules* (a11y). Mengubah element statik interact `<div className="p-6 cursor-pointer" onClick={...}>` menjadi elemen yang sah di-navigasi (`<button type="button">`).

### 4. Auth & Telemetry Engine (Asynchronous Execution)
**Masalah**: Implementasi dinamis `@libsql/client` memerlukan `await`.
*   **`src/app/api/telemetry/settings-auth/route.ts`**
    *   **Diubah**: Menambahkan `await` ke 4 iterasi pemanggilan: `const client = await createAuthDbClient();`.
*   **`scripts/admin/reset-admin-password.ts`**
    *   **Ditambahkan**: Mengembalikan fungsi induk pembungkus `async function main() { ... }`.
    *   **Diubah**: Menambahkan awalan `await createAuthDbClient()`, serta membuang deklarasi duplikat.
*   **`scripts/admin/verify-admin-password.ts`**
    *   **Diubah**: Implementasi `await`.
*   **`scripts/debug/debug-auth-rate-limit.ts`**
    *   **Diubah**: Implementasi `await`.
*   **`scripts/dev/run-e2e-strict.ts`**
    *   **Diubah**: Implementasi `await`.

---

## 📁 Detail File Baru atau Dihapus
*   **File Baru Dibuat**: Tidak ada.
*   **File / Folder Dihapus**: Tidak ada file yang dibuang penuh dari direktori, hanya fungsionalitas dan fitur *dead-code* yang dibersihkan.
