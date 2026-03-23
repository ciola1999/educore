# Phase 1 Tauri Smoke Checklist

Tanggal referensi: 19 Maret 2026
Scope: validasi UI Phase 1 di runtime desktop (`bun tauri dev`) dengan backend contract stabil.

## 1. Startup

1. Jalankan `bun tauri dev`.
2. Pastikan window desktop terbuka tanpa panic Rust dan tanpa build error Next.
3. Login dengan akun admin yang valid.

Expected:
- Login sukses.
- Tidak ada error `MissingSecret`, `UntrustedHost`, atau `Module not found: fs`.

## 2. Login Matrix

Gunakan minimal akun berikut:

- `admin@educore.school`
- akun `teacher`
- akun `staff`
- akun `student`

Expected:
- Semua akun bisa login tanpa build/runtime error.
- Sidebar dan halaman default mengikuti role.

## 3. Navigasi & Role Gate

1. Buka sidebar sebagai `admin`/`super_admin`.
2. Pastikan menu `User Management` terlihat.
3. Login dengan role `teacher` atau `staff`.
4. Pastikan `User Management` tidak terlihat.
5. Login dengan role `student`.

Expected:
- Student hanya bisa akses `Students` dan `Attendance`.
- Teacher/staff hanya bisa akses `Overview`, `Attendance`, `Courses`, `Settings`.
- Admin/super_admin bisa akses semua menu phase 1.
- Route yang tidak diizinkan menampilkan state akses dibatasi, bukan crash.

## 4. Admin Smoke

1. Login sebagai `admin`.
2. Buka `Students`, `Attendance`, `Courses`, `User Management`, `Settings`.
3. Pastikan semua halaman terbuka tanpa `Forbidden`.
4. Coba:
   - tambah kelas
   - tambah subject
   - tambah user teacher/staff
   - simpan manual attendance
   - export attendance history
   - simpan sync credential desktop

Expected:
- Semua aksi phase 1 yang memang diizinkan berjalan normal.
- UI menampilkan panel akses tulis aktif.

## 5. Teacher/Staff Smoke

1. Login sebagai `teacher`.
2. Buka `Attendance`, `Courses`, `Settings`.
3. Pastikan `User Management` tidak muncul di sidebar.
4. Di `Attendance`, pastikan QR/manual attendance masih tersedia.
5. Di `Courses`, pastikan halaman terbuka dalam mode read-only.
6. Di `Settings`, pastikan halaman terbuka dalam mode read-only.

Expected:
- Tidak ada tombol manajemen user.
- Tidak ada aksi akademik/sync yang seharusnya butuh permission lebih tinggi.
- Attendance tetap usable secara operasional.

## 6. Student Smoke

1. Login sebagai `student`.
2. Pastikan sidebar hanya menampilkan `Students` dan `Attendance`.
3. Buka `Students`.
4. Buka `Attendance`.

Expected:
- `Students` tampil sebagai self-view, bukan roster admin.
- `Attendance` hanya menampilkan log/riwayat; QR scanner dan form manual tidak tampil.
- Riwayat absensi hanya menampilkan data siswa yang sedang login.

## 7. Academic Contract (Classes + Subjects)

1. Login sebagai role yang punya `academic:write` (`admin`).
2. Buka `Courses`.
3. Pastikan tab `Kelas` dan `Mata Pelajaran` tampil dalam satu halaman.
4. Tambah kelas baru.
5. Tambah subject baru.
6. Refresh halaman.

Expected:
- Data tersimpan dan terbaca kembali.
- Tidak ada error `Forbidden` untuk role yang memang berizin.
- Role read-only tidak melihat tombol tambah/edit/hapus.

## 8. User Management Contract

1. Buka `User Management` sebagai `admin`/`super_admin`.
2. Tambah akun `teacher` atau `staff`.
3. Hapus akun yang baru dibuat.

Expected:
- `GET/POST/DELETE /api/teachers` bekerja sesuai response contract.
- Error ditampilkan ramah user (bukan string mentah `Forbidden`/`Unauthorized`).

## 9. Attendance Manual (Core)

1. Buka `Attendance`.
2. Pilih tanggal `2026-03-19`.
3. Pilih kelas spesifik (bukan `All Students`).
4. Ubah minimal satu status siswa (mis. ke `alpha`).
5. Klik `Save Attendance`.
6. Klik `Refresh` lalu buka ulang halaman attendance.

Expected:
- Status tersimpan (tidak kembali default `present`).
- Student yang lock QR tetap readonly.
- Jika class `all`, submit ditolak dengan pesan validasi yang jelas.

## 10. Attendance QR + History

1. Di halaman `Attendance`, jalankan `QR Attendance`.
2. Uji minimal satu check-in dan satu check-out.
3. Buka `Log Absensi`.
4. Filter history berdasarkan:
   - status
   - source
   - tanggal
5. Export history.

Expected:
- Log hari ini ter-update setelah scan.
- History tampil sesuai filter aktif.
- Export history menghasilkan file `.xlsx` yang sesuai filter.

## 11. Export XLSX Manual Attendance

1. Dari panel `Input Manual`, klik `Export XLSX`.
2. Pastikan dialog export muncul.
3. Ubah filter status.
4. Klik `Export Sekarang` dan pilih lokasi file.

Expected:
- Dialog save desktop muncul.
- File `.xlsx` berhasil tersimpan.
- Tidak ada error permission `fs.write_file not allowed`.

## 12. Sync Settings

1. Buka `Settings`.
2. Jalankan `Sinkron Penuh`.
3. Muat ulang halaman dan pastikan konfigurasi sync tidak hilang.

Expected:
- Action selesai tanpa crash.
- Bila credential sync belum diset, error message jelas dan terkontrol.
- Role tanpa `settings:manage` hanya melihat info status, bukan tombol aksi sync.

## 13. Regression Security Check

1. Pastikan tidak ada direct write dari komponen UI ke DB untuk flow Phase 1 (kecuali path legacy yang memang belum dipakai UI aktif).
2. Pastikan endpoint protected membedakan `401` (belum login) dan `403` (tidak berizin).
3. Pastikan payload attendance tidak mengandalkan `recordedBy` dari client.
4. Pastikan role read-only tidak melihat CTA tulis palsu di `Attendance`, `Courses`, dan `Settings`.

Expected:
- Semua flow utama tetap lewat endpoint contract.
- Tidak ada bypass boundary backend.
