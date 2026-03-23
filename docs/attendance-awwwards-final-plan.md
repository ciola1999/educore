# Attendance Awwwards-Grade Final Plan (Web + Tauri)

## 1) Objective
Upgrade `Dashboard > Attendance` to premium-grade UX/UI while preserving existing stable business flows:

- QR attendance
- Manual attendance
- Today log and history log
- Export XLSX/PDF/print
- Schedule settings
- Holiday manager
- Risk insights and follow-up
- Students -> Attendance mapping and role behavior

Target runtime parity:

- Web/online (Vercel)
- Desktop/local (Tauri via `bun tauri dev`)

---

## 2) Scope Boundary
In scope:

- `src/app/dashboard/attendance/*`
- `src/components/attendance/*`
- Hooks/util/routes that are directly coupled to attendance flow
- Attendance-specific tests

Out of scope (unless dependency is direct and blocking):

- Unrelated modules (`teachers`, `id-card`, etc.)
- Global redesign outside Attendance

---

## 3) Baseline Snapshot (Current State)
### 3.1 Functional baseline (already stable)
- Section-based attendance navigation is active (`qr`, `manual`, `log`, `schedule`, `holiday`).
- Role-based visibility is active:
  - write roles: full attendance sections
  - read-only role: log-focused access
- Manual and history controls already polished for contrast/readability.
- History now has:
  - advanced filters toggle
  - quick range controls
  - density mode (`Comfort`/`Compact`)
  - sticky action bar
  - better empty/error recovery
  - persisted UI preferences (density, advanced-filter open/close, quick-range state)

### 3.2 Quality baseline (already passing)
- `bunx biome check .`
- `bunx tsc --noEmit`
- `bun run build`

### 3.3 Known technical constraints
- `daily-log-view.tsx` is still very large and should be split for maintainability.
- Visual styles still contain repeated long class strings, risking future inconsistency.
- E2E coverage for attendance critical paths is not yet complete.

---

## 4) Final Quality Targets
### 4.1 UX and visual targets
- Premium but operational: high readability under high data volume.
- Coherent visual language across all attendance sections.
- Motion and transitions feel intentional, not noisy.
- Mobile-first behavior (especially history/toolbars/filtering).

### 4.2 Engineering targets
- Zero functional regression on critical attendance flows.
- Stronger component architecture (smaller, focused units).
- Deterministic styles via centralized tokens/helpers.
- Test coverage increased for critical flows.

### 4.3 Security and robustness targets
- No new trust boundary risk introduced in UI refactor.
- Error feedback remains explicit and actionable.
- Runtime-safe behavior in both web and desktop environments.

---

## 5) Execution Plan
## Phase 0 - Lock Baseline and Acceptance Criteria
1. Freeze attendance scope and create regression checklist.
2. Lock critical role matrix:
   - `super_admin/admin`
   - `teacher/staff`
   - `student` read-only
3. Lock must-not-break flow list (QR/manual/history/export/analytics/risk).

Deliverable:
- Baseline checklist in this plan used as release gate.

---

## Phase 1 - Visual & UX System (Attendance-level)
1. Define attendance tokens:
   - Action button variants
   - Card tiers
   - Status badges
   - Inline-state patterns
2. Define motion rules:
   - section switch
   - filter reveal
   - loading/processing states
3. Validate contrast and focus states (WCAG AA).

Deliverable:
- Token and interaction table integrated into this plan.

---

## Phase 2 - Component Architecture Refactor
Split monolith components to reduce risk and speed future changes.

Target decomposition:
- `daily-log-view.tsx` ->
  - `history-filters-panel`
  - `history-quick-actions`
  - `history-summary-cards`
  - `history-list`
  - `history-grouped-list`
  - `history-export-toolbar`
  - `history-risk-followups`
  - `history-analytics-panels`
- Extract shared style helpers for action buttons.

Deliverable:
- Smaller components with unchanged behavior.

---

## Phase 3 - Premium UX Pass (Per Feature Area)
### 3.1 QR Attendance
- Improve scan-state hierarchy and failure recovery hints.
- Keep fallback manual QR path obvious and safe.

### 3.2 Manual Attendance
- Maintain clear mass actions.
- Ensure status changes remain fast at class scale.

### 3.3 History
- Keep filtering fast and legible on mobile.
- Preserve sticky export/print action access.

### 3.4 Analytics and Risk
- Improve visual narrative without reducing data density.
- Keep follow-up actions explicit and auditable.

Deliverable:
- UX-consistent attendance experience end-to-end.

---

## Phase 4 - Functional Hardening and Cleanup
1. Audit routes/hooks/utils for obsolete attendance code paths.
2. Verify sync of active filter -> history list -> analytics -> exports.
3. Verify parity web vs tauri for export/report behavior.
4. Tighten feedback states (success/error/empty/loading).

Deliverable:
- Reduced tech debt and lower regression surface.

---

## Phase 5 - Testing and Validation Gate
Required checks on each checkpoint:
- `bunx biome check .`
- `bunx tsc --noEmit`
- `bun run build`

Test additions:
- Component tests for attendance UI state transitions.
- API tests for critical attendance route handlers.
- E2E Attendance suite:
  - QR success/fail
  - manual submit
  - history filter/grouping
  - export xlsx/pdf/print trigger
  - role-based behavior

Deliverable:
- Attendance release candidate with verified critical paths.

---

## 6) Acceptance Checklist (Release Gate)
Release is allowed only when all are true:

1. QR flow works with clear success/failure feedback.
2. Manual flow supports valid class/date constraints and bulk action safely.
3. History, filters, quick range, grouping, and density remain consistent.
4. Export XLSX/PDF and print behavior are consistent in web and tauri.
5. Analytics/risk panels match active filters.
6. Role-based restrictions are correct.
7. Students mapping and legacy attendance mapping remain intact.
8. No critical lint/type/build failure.

---

## 7) Risk Register and Mitigation
Risk: UI refactor breaks behavior in large component.
- Mitigation: split incrementally, keep snapshot tests and regression checklist.

Risk: visual inconsistency returns due to repeated utility classes.
- Mitigation: centralize action/button style tokens/helpers.

Risk: desktop/web export behavior drift.
- Mitigation: add runtime-aware smoke test checklist and E2E assertions.

Risk: oversized scope delays delivery.
- Mitigation: strict phase gates and no cross-module redesign.

---

## 8) Runtime Classification Matrix
- Web only risks:
  - browser popup restrictions for print
  - browser download permission behavior
- Tauri only risks:
  - FS save dialogs and path permissions
  - camera capability behavior by OS
- Shared risks:
  - filter-state bugs
  - role gating and stale UI state
  - large-list performance in history

---

## 9) Implementation Order (Final)
1. Phase 0/1 lock (done via this plan + baseline checks).
2. Phase 2 component split (`daily-log-view` first).
3. Phase 3 UX pass on QR -> Manual -> History -> Analytics/Risk.
4. Phase 4 cleanup and parity hardening.
5. Phase 5 tests and final validation.

---

## 10) Definition of Done (Final)
Attendance is considered final when:

1. Critical flows are stable and verified in both runtime targets.
2. UI/UX is visually coherent, high-contrast, mobile-safe, and premium.
3. Component architecture is maintainable and testable.
4. Validation suite and release checklist are fully green.
5. Residual risks are explicitly documented and accepted.

