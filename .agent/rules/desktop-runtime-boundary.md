# Desktop Runtime Boundary Rule

Gunakan rule ini setiap kali task menyentuh desktop runtime, Tauri, auth desktop, CRUD desktop, atau build desktop.

## Objective

Jaga agar desktop runtime benar-benar local-first dan tidak diam-diam bergantung ke runtime web.

## Hard Rules

1. Jangan biarkan flow inti desktop bergantung ke `/api/*` web.
2. Jangan panggil `useSession()` web langsung pada jalur yang juga dipakai desktop kecuali sudah lewat bridge/provider runtime-safe.
3. Jangan import module server-only, node-only, atau native-only ke jalur client browser sembarangan.
4. Desktop login/logout/change-password harus bisa jalan tanpa auth web.
5. Jika sebuah halaman belum desktop-safe, lebih baik dibatasi eksplisit daripada dibiarkan tampak siap.

## Audit Checklist

- Apakah komponen client membaca service DB langsung?
- Apakah ada route web yang masih jadi dependency CRUD desktop?
- Apakah bundle browser bisa menarik dependency native/server dari import chain ini?
- Apakah flow ini aman untuk `bun tauri dev` dan desktop production?
- Jika belum aman, apakah harus di-port atau dibatasi?

## Required Output

Saat task selesai, jelaskan:
- mana issue `desktop-only`
- file yang diubah
- boundary apa yang ditutup
- residual risk desktop jika masih ada

