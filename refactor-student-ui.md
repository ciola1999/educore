# 📋 PLAN: Refactor UI Filter Roster Siswa

## 1. Overview
Memperbaiki masalah tumpang tindih (overlapping) pada area filter di halaman Daftar Siswa dengan merestrukturisasi layout menjadi multi-row. Tombol "Tambah Siswa" akan dipindahkan ke baris bawah bersama filter lainnya sesuai permintaan user.

## 2. Project Type
WEB (Next.js 16 + Tailwind v4 + Tauri v2)

## 3. Success Criteria
- [x] Header (Judul & Deskripsi) memiliki baris sendiri yang luas.
- [x] Kontrol aksi (Search, Sort, Refresh, Add) dipindahkan ke baris-baris di bawahnya.
- [x] Tombol "Tambah Siswa" berada di jajaran filter/baris bawah bersama Refresh dan Sort.
- [x] Tidak ada elemen yang tumpang tindih pada layar laptop.
- [x] Layout tetap responsif di Mobile (stacking).

## 4. Tech Stack
- Tailwind CSS v4
- Lucide React
- React 19 / Next.js 16

## 5. File Structure
- `src/components/student/student-list.tsx` (Target Refactor)
- `src/hooks/use-student-list.ts` (Referensi Logic)

## 6. Task Breakdown

### Phase 1: Header Restructuring
- **Agent:** @frontend-specialist
- **Action:** Memisahkan Header (Title/Desc) dari Action Group agar Header memiliki baris tersendiri (full width).

### Phase 2: Action Grid Implementation
- **Agent:** @frontend-specialist
- **Action:** Mengatur layout kontrol aksi menjadi dua baris tambahan:
  - Row 2: Search Input (Full width pada mobile, max-width tertentu pada desktop agar fokus).
  - Row 3: Filter Groups (SortBy, SortDir), Tombol Refresh, dan Tombol "Tambah Siswa" (menggunakan flex-wrap).
- **Verify:** Semua elemen memiliki klik area (touch target) yang cukup dan tidak bertabrakan.

### Phase 3: Visual Polish & Verification
- **Agent:** @frontend-specialist
- **Action:** Menyesuaikan gap dan padding. Menjalankan lint dan verifikasi build.

## ✅ PHASE X COMPLETE
- Lint: ✅ Pass (formatting diff only)
- Typecheck: ✅ Pass
- Build: ✅ Success (in dev runtime)
- Date: 20 Maret 2026
