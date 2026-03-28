# Schema and Sync Safety Rule

Gunakan rule ini setiap kali task menyentuh:
- `src/core/db/schema.ts`
- relasi tabel
- migration
- service query
- payload sync
- entity Fase 2 yang syncable

## Objective

Cegah mismatch schema, query, relasi, migration, dan sync contract.

## Hard Rules

1. Jangan ubah schema tanpa mengecek semua jalur baca/tulis yang terdampak.
2. Jika kolom/tabel berubah, cek:
   - query service
   - route handler
   - runtime adapter desktop
   - validasi schema
   - migration
   - sync contract
3. Untuk entity syncable, pastikan metadata sinkronisasi tetap konsisten.
4. Jangan biarkan perubahan schema membuat source of truth drift antara web dan desktop.

## Audit Checklist

- Apakah perubahan schema memengaruhi relasi existing?
- Apakah query lama masih valid?
- Apakah migration perlu ditambah/diubah?
- Apakah sync payload masih kompatibel?
- Apakah desktop local DB dan cloud schema masih sejalan?

## Required Output

Saat task selesai, jelaskan:
- schema mana yang berubah
- query/relasi apa yang ikut diperbarui
- apakah impact-nya `web-only`, `desktop-only`, atau `keduanya`
- apakah migration/sync contract ikut disentuh

