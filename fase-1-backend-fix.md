# Fase 1 Backend Fix

## Overview
Fase ini fokus pada stabilisasi backend untuk fondasi data dan autentikasi EduCore. Targetnya bukan menambah fitur baru, tetapi memperbaiki kontradiksi runtime yang sudah ada di auth, schema, sync, dan utilitas debug supaya fase 1 bisa dipakai dengan aman dan konsisten.

Konteks yang sudah terdeteksi dari codebase:
- Auth web masih bercampur demo logic dan server/client boundary belum rapi.
- Password hashing dan verifikasi belum punya jalur yang stabil untuk web, desktop, dan test environment.
- Ada mismatch role antara schema, validation, middleware, dan auth session.
- Sync layer masih mengandalkan asumsi raw SQL yang rapuh.
- Ada utilitas debug yang memutus typecheck.

## Project Type
BACKEND

Frontend tidak menjadi target kerja fase ini. Fokus hanya pada backend, data layer, auth, sync, validasi, dan regression protection.

## Success Criteria
- Login, logout, dan change-password berjalan lewat backend path yang konsisten.
- Password tidak lagi memakai demo fallback atau plain-text path di web.
- Role, permission, dan session shape konsisten di schema, validation, auth, dan middleware.
- Sync engine berjalan dengan kontrak yang jelas untuk `sync_status`, `updated_at`, dan conflict handling.
- `bun run typecheck` dan auth-related tests lolos tanpa error.
- Tidak ada hardcoded secret, demo credential fallback, atau debug logging di jalur produksi.
- Semua perubahan backend inti punya regression test minimal untuk login, hashing, role mapping, dan sync contract.

## Tech Stack
- Bun
- TypeScript strict
- Drizzle ORM
- SQLite / Turso via existing connection abstraction
- NextAuth v5 untuk web auth
- Argon2-based hashing untuk password
- Zod untuk input validation
- Vitest untuk unit test

## File Structure
```
src/
├── core/
│   ├── db/
│   │   ├── schema.ts
│   │   ├── connection.ts
│   │   └── migrations.ts
│   ├── sync/
│   │   ├── engine.ts
│   │   └── hlc.ts
│   ├── validation/
│   │   └── schemas.ts
│   └── env.ts
├── lib/
│   ├── auth/
│   │   ├── hash.ts
│   │   ├── service.ts
│   │   ├── middleware.ts
│   │   ├── rbac.ts
│   │   └── web/auth.ts
│   └── db/
│       └── index.ts
├── app/
│   └── api/auth/
│       ├── change-password/route.ts
│       └── logout/route.ts
└── tests/
    └── auth and sync regression coverage

check_db.ts
```

## Task Breakdown

### Task 1: Audit and Normalize Auth Data Model
- Agent: database-architect
- Skills: database-design, clean-code
- Priority: P0
- Dependencies: none
- INPUT: current `users`, `roles`, `permissions`, `user_roles`, and validation schemas
- OUTPUT: one consistent role model, consistent timestamp/sync columns, and explicit auth column contract
- VERIFY: schema, validation, auth session, and middleware use the same role names and field names

### Task 2: Repair Password Hashing and Verification Boundary
- Agent: backend-specialist
- Skills: api-patterns, nodejs-best-practices, clean-code
- Priority: P0
- Dependencies: Task 1
- INPUT: `src/lib/auth/hash.ts`, `src/lib/auth/service.ts`, `src/lib/auth/web/auth.ts`
- OUTPUT: secure hashing/verifying path that works in the intended runtime without demo fallback or plain-text storage
- VERIFY: hashing works in tests and runtime-specific paths do not throw in normal auth flow

### Task 3: Stabilize Web Auth and Session Flow
- Agent: backend-specialist
- Skills: api-patterns, nodejs-best-practices, vulnerability-scanner
- Priority: P0
- Dependencies: Task 1, Task 2
- INPUT: NextAuth config, auth routes, cookie/session settings
- OUTPUT: predictable login/logout/change-password behavior with secure session handling and no test-environment module crash
- VERIFY: auth module loads in test/runtime, login failure counts work, logout and change-password routes return stable responses

### Task 4: Fix Sync Contract and Drizzle Runtime Assumptions
- Agent: backend-specialist
- Skills: api-patterns, database-design, clean-code
- Priority: P1
- Dependencies: Task 1
- INPUT: `src/core/sync/engine.ts`, `src/lib/sync/turso-sync.ts`, `src/core/db/connection.ts`
- OUTPUT: sync logic that uses explicit column contract and safer table handling
- VERIFY: no raw SQL assumptions about column order, no hidden dependency on demo state, and sync paths are aligned with schema

### Task 5: Remove Typecheck and Debug Utility Failures
- Agent: code-archaeologist
- Skills: refactoring-patterns, code-review-checklist
- Priority: P1
- Dependencies: Task 1, Task 2
- INPUT: `check_db.ts` and other debug-only helpers
- OUTPUT: debug utilities that compile cleanly or are isolated from production typecheck
- VERIFY: `bun run typecheck` passes without debug-helper errors

### Task 6: Add Regression Coverage for Phase 1 Backend
- Agent: test-engineer
- Skills: testing-patterns, tdd-workflow, webapp-testing
- Priority: P0
- Dependencies: Task 1 to Task 5
- INPUT: auth, hashing, role mapping, and sync contract
- OUTPUT: tests that lock the expected behavior of the backend fixes
- VERIFY: Vitest suite covers login success/failure, password hashing, role resolution, and sync safety cases

### Task 7: Security Review of Auth and Sync Paths
- Agent: security-auditor
- Skills: vulnerability-scanner, red-team-tactics, api-patterns
- Priority: P0
- Dependencies: Task 2, Task 3, Task 4
- INPUT: final backend auth and sync implementation
- OUTPUT: security findings and hardening recommendations before implementation is considered complete
- VERIFY: no demo credential fallback, no plain-text password path, no unsafe raw SQL assumptions, no secret leakage

## Phase X: Verification
Run these checks before closing the phase:
```bash
bun run typecheck
bun run lint
bun run test
```

Additional targeted checks for this phase:
```bash
bun run test -- src/lib/auth/service.test.ts src/lib/auth/hash.test.ts
```

Manual verification points:
- Login succeeds with real hashed password.
- Logout invalidates session cleanly.
- Change-password updates hash only through secure backend flow.
- Role checks return consistent results across schema, session, and middleware.
- Sync does not depend on column-order assumptions.

## ✅ PHASE X COMPLETE
- Lint: pending
- Type Check: pending
- Security: pending
- Tests: pending
- Date: pending
