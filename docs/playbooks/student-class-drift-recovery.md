# Student Class Drift Recovery

Playbook ini dipakai saat siswa tampil `UNASSIGNED`, kelas berbeda antara web vs desktop, atau total siswa drift karena projection/class mapping rusak.

## Gejala Umum

- student berakun tampil `UNASSIGNED`
- student tanpa akun muncul benar, tapi student berakun salah
- total siswa desktop dan web berbeda
- `classes.name` ada yang berupa UUID
- `users.kelas_id` tidak match ke `classes.id` yang valid

## Audit Urutan Aman

1. cek contoh siswa nyata berdasarkan `NIS`
2. cek state cloud
3. cek state desktop
4. cek apakah ada class alias/duplikat/UUID-corrupt
5. cek apakah projection student sudah direbuild setelah sync

## Bukti Yang Harus Dicari

- `students.grade`
- `users.kelas_id`
- `classes.name`
- status delete/active row class
- apakah ada row class kanonik dengan nama yang seharusnya dipakai

## Strategi Recovery

### Jika source of truth jelas

- normalkan ke class kanonik
- remap `users.kelas_id`
- pastikan `students.grade` ikut sehat
- rebuild projection bila diperlukan

### Jika row student/class ambigu

- jangan tebak
- minta referensi dari data Excel / sumber admin
- atau hapus row dummy/test jika memang aman dibuang

## Hardening Wajib

- jangan anggap `classes.name` berbentuk UUID sebagai kelas valid
- normalisasi alias kelas seperti romawi vs angka
- reuse class kanonik, jangan bikin row baru bila alias sudah ada
- audit duplicate logical keys dan orphan refs secara berkala

## Retest

1. buat student via web atau desktop
2. satu dengan akun, satu tanpa akun
3. sync lintas runtime
4. cek:
   - total siswa
   - kelas student berakun
   - kelas student tanpa akun
   - tidak ada `UNASSIGNED` palsu
