# ADR-002: Sync and Source of Truth

## Status

Accepted

## Context

EduCore membutuhkan dua mode operasi:
- online collaboration antar banyak user/device
- offline operation di desktop

Satu source of truth tunggal tidak cukup menjelaskan dua kondisi ini.

## Decision

Source of truth dibagi dua level:

- `Global shared truth`: Turso
- `Local operational truth`: SQLite desktop per device

Aturan operasi:
- desktop write ke local lebih dulu
- web write ke cloud lebih dulu
- sync engine menyatukan perubahan

## Conflict Policy

Default:
- Last Write Wins dengan HLC-aware comparison bila tersedia

Fallback:
- compare `updatedAt`
- gunakan deterministic tie-breaker jika perlu

## Entity Requirements

Entity syncable minimal memiliki:
- `id`
- `version`
- `updatedAt`
- `deletedAt`
- `syncStatus` bila diperlukan
- `hlc` bila tersedia

## Consequences

### Positive
- desktop dapat terus bekerja offline
- perubahan tetap bisa dibagikan saat online

### Negative
- write path menjadi lebih kompleks
- audit terhadap konflik dan replay sync menjadi penting

