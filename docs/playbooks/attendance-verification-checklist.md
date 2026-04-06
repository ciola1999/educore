# Attendance Verification Checklist

Gunakan checklist ini setelah mengubah logic attendance, filter history, manual input, atau QR flow.

## 1. Input Manual

- pilih satu kelas spesifik
- cari satu siswa lewat search
- ubah status siswa itu saja
- simpan attendance
- pastikan toast tidak melaporkan lebih banyak siswa dari hasil filter aktif

## 2. Riwayat

### Filter tanggal

- `Hari Ini` harus menampilkan data hari lokal yang benar
- `7 Hari` dan `30 Hari` harus konsisten dengan timezone lokal

### Filter status

- `Semua Status` tidak boleh punya angka yang lebih kecil dari filter status spesifik yang sama
- `Terlambat` hanya menampilkan terlambat
- `Hadir` hanya menampilkan hadir
- `Alpha` hanya menampilkan alpha
- `Izin` dan `Sakit` harus dipisah jika source datanya memang spesifik

## 3. Dedupe

- jika QR dan manual ada pada siswa+tanggal yang sama, tampilkan satu record yang benar
- filter status spesifik tidak boleh meloloskan duplicate manual yang sebenarnya sudah tertutup record QR

## 4. Summary

- card summary harus konsisten dengan list yang sedang difilter
- `Izin` dan `Sakit` dipisah
- angka `Hadir` dan `Alpha` tidak boleh bertambah ketika berpindah dari `Semua Status` ke filter status spesifik

## 5. Runtime

Retest minimal di:

- web
- `bun tauri dev`

Kalau issue hanya ada di packaged desktop, lanjutkan audit sebagai runtime boundary issue.
