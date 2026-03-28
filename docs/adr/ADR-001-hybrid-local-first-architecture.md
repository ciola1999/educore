# ADR-001: Hybrid Local-First Architecture

## Status

Accepted

## Context

EduCore harus:
- berjalan di desktop dan web
- dapat diakses dari HP lewat browser
- mendukung multi-user dengan data sekolah yang sama
- tetap usable saat offline

Arsitektur single local DB untuk semua device tidak memenuhi kebutuhan ini.

## Decision

EduCore memakai arsitektur:
- `Desktop` sebagai offline-first client
- `Web` sebagai online-first client
- `Turso` sebagai shared collaboration layer
- `SQLite desktop` sebagai local operational database
- `Sync engine` sebagai penghubung local <-> cloud

## Consequences

### Positive
- desktop tetap usable saat internet putus
- web/HP tetap bisa akses tanpa install
- data bersama antar user/device tetap mungkin

### Negative
- sync engine menjadi komponen inti
- conflict handling harus jelas
- desktop production tidak boleh bergantung ke route web

## Operational Notes

- Desktop flow inti tidak boleh mewajibkan `/api/*` web.
- Web flow tidak boleh memakai capability Tauri.
- Business rule harus shared walau transport layer berbeda.

