# 📋 PLAN: Redesign ID Card EDUCORE

## 1. Overview
Mendesain ulang Kartu Identitas (ID Card) untuk Siswa dan Staf (Admin, Guru, Guru, Staf) menjadi format Landscape standar kartu kredit (8.56cm x 5.4cm) dengan estetika modern 2026.

## 2. Project Type
WEB (Next.js 16 + Tailwind v4 + Print-friendly CSS)

## 3. Success Criteria
- [x] Ukuran presisi 8.56cm x 5.4cm (Landscape).
- [x] Header: "Yayasan Pendidikan Mekarsari".
- [x] Layout 3 Kolom: Foto (Kiri), Data (Tengah), QR Code (Kanan).
- [x] Warna dominan Biru dengan aksen Emas/Oranye.
- [x] Dukungan print resolusi tinggi (300 DPI).
- [x] Responsif untuk preview di dashboard.

## 4. Tech Stack
- React 19 / Next.js 16
- Tailwind CSS v4
- `qrcode.react` (QR Generation)
- Lucide Icons (Placeholders)

## 5. File Structure
- `src/components/id-card/id-card-view.tsx` (Target Utama)
- `src/components/student/student-id-dialog.tsx` (Integrasi Siswa)
- `src/components/teacher/teacher-list.tsx` (Integrasi Staf)

## 6. Task Breakdown

### Phase 1: Interface Expansion
- **Agent:** @frontend-specialist
- **Action:** Menambah props pada `IDCardView` (NISN, Jabatan, Alamat).
- **Verify:** Tidak ada breaking changes pada pemanggil yang sudah ada.

### Phase 2: Design Implementation (Landscape)
- **Agent:** @frontend-specialist
- **Action:** 
  - Implementasi kontainer 8.56cm x 5.4cm.
  - Desain Header dengan tipografi elegan.
  - Desain Body dengan 3 kolom.
  - Penambahan visual elements (latar belakang geometris/biru gradasi).
  - Penyesuaian aksen emas/oranye pada footer/border.

### Phase 3: Print Optimization
- **Agent:** @frontend-specialist
- **Action:** Sinkronisasi CSS Print agar layout tetap landscape saat dicetak.

## ✅ PHASE X COMPLETE
- Design: ✅ Standard 8.56cm x 5.4cm Accurate.
- Visual: ✅ Modern Blue/Gold Theme.
- Logic: ✅ Multi-role (Student/Staff) supported.
- Typecheck: ✅ Pass.
