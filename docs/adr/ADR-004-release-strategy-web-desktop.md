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
- signoff channel release dilakukan per-installer, bukan otomatis untuk semua bundler

### Windows installer policy
- channel yang disignoff saat ini: `MSI`
- channel `NSIS` tidak otomatis ikut dianggap siap hanya karena `MSI` sehat
- `NSIS` harus punya build + install + smoke gate sendiri sebelum boleh disebut supported

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
- MSI bisa dirilis lebih cepat tanpa menunggu semua bundler Windows matang bersamaan

### Negative
- readiness web dan desktop bisa berbeda
- team harus disiplin membedakan status “web-ready” dan “desktop-release-ready”
- readiness antar bundler desktop juga bisa berbeda

## Security Consequence

- installer desktop production adalah controlled artifact
- secret runtime packaged harus diminimalkan dan tidak boleh diperlakukan seperti env web biasa
- arah jangka menengah adalah first-run provisioning + keyring-only credential, bukan permanent secret di bundle

## Follow-up

Implementasi konkret untuk membuka desktop release production dijabarkan di:
- [desktop-production-runtime-plan.md](/e:/Freelance/Project/educore/docs/desktop-production-runtime-plan.md)
