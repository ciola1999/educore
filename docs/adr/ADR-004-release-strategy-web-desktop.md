# ADR-004: Release Strategy for Web and Desktop

## Status

Accepted

## Context

EduCore memiliki dua jalur distribusi:
- web app
- desktop app

Tetapi readiness keduanya tidak selalu sama. Jika desktop release dipaksa saat runtime boundary belum aman, hasilnya bisa berupa installer yang tampak valid tetapi rusak untuk flow inti.

## Decision

Strategi release dipisah:

### Web release
- dianggap jalur distribusi universal
- dipakai browser desktop/laptop
- dipakai HP/mobile browser atau PWA
- boleh dirilis selama build web sehat

### Desktop release
- hanya dibuka jika flow inti desktop sudah local-runtime-safe
- tidak boleh mengandalkan route web untuk fitur inti
- harus lolos build gate khusus desktop

## Fail-Secure Policy

Jika desktop production path belum aman:
- build desktop harus diblok eksplisit
- pesan error harus jelas
- jangan membuat bundle statis palsu

## Required Gates

Minimal untuk web:

```bash
bunx biome check .
bunx tsc --noEmit
bun run build
```

Minimal untuk desktop release:

```bash
bunx biome check .
bunx tsc --noEmit
bun run build
bun run build:desktop
bun tauri build
```

## Consequences

### Positive
- user tidak menerima installer desktop yang misleading
- kualitas release lebih dapat dipertanggungjawabkan
- web tetap bisa bergerak lebih cepat

### Negative
- readiness web dan desktop bisa berbeda
- team harus disiplin membedakan status “web-ready” dan “desktop-release-ready”

