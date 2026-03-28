# ADR-003: Auth Boundary Between Web and Desktop

## Status

Accepted

## Context

EduCore berjalan di dua runtime dengan kebutuhan auth yang berbeda:
- `Web` memakai backend web dan session berbasis browser
- `Desktop` harus tetap usable tanpa ketergantungan ke route/session web

Jika boundary auth tidak tegas:
- desktop bisa diam-diam bergantung ke NextAuth/session fetch web
- browser bundle bisa menarik dependency native/server
- flow login/logout/change-password menjadi regress-prone

## Decision

Auth dibagi tegas berdasarkan runtime:

### Web
- auth flow memakai mekanisme web
- session web hanya berlaku untuk runtime web
- route web bertanggung jawab atas auth web

### Desktop
- auth/session desktop harus hidup di runtime lokal
- desktop tidak boleh mewajibkan `SessionProvider` web
- login/logout/change-password desktop harus bisa jalan tanpa route auth web

### Shared rules
Yang harus tetap shared lintas runtime:
- role
- permission matrix
- account active/inactive policy
- password rules
- validation semantics

## Operational Rules

- `useSession()` tidak boleh dipanggil langsung di hook umum yang dipakai desktop kecuali sudah dijembatani provider runtime-safe.
- Desktop login harus lewat local-safe path.
- Desktop logout harus bisa membersihkan local session tanpa roundtrip ke auth web.
- Desktop change-password boleh memakai runtime lokal/native bridge, bukan route web.

## Consequences

### Positive
- desktop login flow menjadi production-safe
- web auth tetap bersih dan terisolasi
- risiko client bundle menarik dependency auth native berkurang

### Negative
- ada dua transport auth
- butuh disiplin untuk menjaga rule bisnis shared

