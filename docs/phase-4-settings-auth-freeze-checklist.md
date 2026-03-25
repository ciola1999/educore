# Phase 4 Freeze Checklist - Settings/Auth

Tanggal: 2026-03-25
Scope: Frontend Settings/Auth + observability + E2E hardening (web + tauri)

## 1) Freeze Gate
- bunx biome check .
- bun run typecheck
- bun run test:e2e:strict
- bun run build (jalankan terakhir)

## 2) Runtime & Security Gate
- Web sync lewat /api/sync/*
- Desktop sync lewat path local/tauri
- Tidak ada kebocoran credential sync/auth ke browser path yang salah
- Session source-of-truth konsisten
- Logout revoke access ke route terlindungi
- Telemetry detail sensitif disanitasi

## 3) E2E Gate
- Settings/Auth smoke pass
- Attendance smoke pass
- Session refresh + logout revoke pass
- Telemetry fault injection tidak merusak session refresh

## 4) Commit Groups
- Group A: src/app/dashboard/settings/page.tsx
- Group B: src/app/api/telemetry/settings-auth/route.ts
- Group B: src/app/api/telemetry/settings-auth/route.test.ts
- Group B: src/lib/observability/settings-auth-telemetry.ts
- Group C: tests/e2e/settings-auth.spec.ts
- Group C: tests/page-objects/settings-auth-page.ts
- Group C: tests/page-objects/login-page.ts
- Group C: scripts/run-e2e-strict.ts

## 5) Recommended Commit Messages
1. feat(settings-auth): add incident playbook and robust trace controls
2. feat(observability): add settings-auth telemetry endpoint and batched sender
3. test(e2e): harden settings-auth smoke and strict auth preflight
4. docs(release): add phase 4 settings-auth freeze checklist

## 6) PowerShell Commands
- git status --short
- git add src/app/dashboard/settings/page.tsx
- git commit -m "feat(settings-auth): add incident playbook and robust trace controls"
- git add src/app/api/telemetry/settings-auth/route.ts src/app/api/telemetry/settings-auth/route.test.ts src/lib/observability/settings-auth-telemetry.ts
- git commit -m "feat(observability): add settings-auth telemetry endpoint and batched sender"
- git add tests/e2e/settings-auth.spec.ts tests/page-objects/settings-auth-page.ts tests/page-objects/login-page.ts scripts/run-e2e-strict.ts
- git commit -m "test(e2e): harden settings-auth smoke and strict auth preflight"
- git add docs/phase-4-settings-auth-freeze-checklist.md
- git commit -m "docs(release): add phase 4 settings-auth freeze checklist"

## 7) Final Validation Order
- bunx biome check .
- bun run typecheck
- bun run test:e2e:strict
- bun run build

## 8) Residual Risk
- E2E bergantung env credential lokal valid
- Telemetry summary volume tinggi tetap perlu monitoring retention
- Pastikan AUTH_URL/NEXTAUTH_URL local tidak mismatch origin
