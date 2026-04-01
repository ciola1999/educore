# Agent Start

Gunakan file ini sebagai entry point paling singkat saat membuka chat baru dengan AI coding agent.

## Instruksi singkat untuk agent

Sebelum mulai, baca dan ikuti:

- [CLAUDE.md](/e:/Freelance/Project/educore/CLAUDE.md)
- [docs/new-chat-bootstrap.md](/e:/Freelance/Project/educore/docs/new-chat-bootstrap.md)

Setelah itu, pilih bootstrap yang sesuai dari:
- [docs/new-chat-bootstrap.md](/e:/Freelance/Project/educore/docs/new-chat-bootstrap.md)
- atau gunakan template universal siap copy-paste:
  - [docs/prompt-template-all-in-one.md](/e:/Freelance/Project/educore/docs/prompt-template-all-in-one.md)
- jika task terkait deploy/packaged bug yang sulit, baca juga:
  - [docs/runtime-boundary-incident-postmortem.md](/e:/Freelance/Project/educore/docs/runtime-boundary-incident-postmortem.md)

## Rule utama

- Audit dulu, jangan asumsi
- Jaga source of truth
- Jaga runtime boundary web vs desktop
- Jaga schema safety dan sync safety
- Jangan buka jalur desktop release palsu
- Ingat bahwa signoff desktop saat ini adalah `MSI`, bukan otomatis semua bundler Windows

## Untuk task Fase 2

Minimal wajib baca:
- [docs/technical-blueprint.md](/e:/Freelance/Project/educore/docs/technical-blueprint.md)
- [docs/phase-2-execution-roadmap.md](/e:/Freelance/Project/educore/docs/phase-2-execution-roadmap.md)
- [docs/phase-2-desktop-native-checklist.md](/e:/Freelance/Project/educore/docs/phase-2-desktop-native-checklist.md)
- [docs/runtime-matrix.md](/e:/Freelance/Project/educore/docs/runtime-matrix.md)
- [docs/module-ownership-phase-2.md](/e:/Freelance/Project/educore/docs/module-ownership-phase-2.md)
- [docs/sync-contract-phase-2.md](/e:/Freelance/Project/educore/docs/sync-contract-phase-2.md)

## Untuk task arsitektur/runtime

Wajib baca:
- [docs/adr/ADR-001-hybrid-local-first-architecture.md](/e:/Freelance/Project/educore/docs/adr/ADR-001-hybrid-local-first-architecture.md)
- [docs/adr/ADR-002-sync-and-source-of-truth.md](/e:/Freelance/Project/educore/docs/adr/ADR-002-sync-and-source-of-truth.md)
- [docs/adr/ADR-003-auth-web-vs-desktop.md](/e:/Freelance/Project/educore/docs/adr/ADR-003-auth-web-vs-desktop.md)
- [docs/adr/ADR-004-release-strategy-web-desktop.md](/e:/Freelance/Project/educore/docs/adr/ADR-004-release-strategy-web-desktop.md)
- [.agent/rules/desktop-runtime-boundary.md](/e:/Freelance/Project/educore/.agent/rules/desktop-runtime-boundary.md)
- [.agent/rules/schema-sync-safety.md](/e:/Freelance/Project/educore/.agent/rules/schema-sync-safety.md)
- [docs/runtime-boundary-incident-postmortem.md](/e:/Freelance/Project/educore/docs/runtime-boundary-incident-postmortem.md)
