# EduCore

EduCore adalah aplikasi manajemen sekolah hybrid:
- **Desktop**: Tauri v2
- **Web**: Next.js 16 + React 19
- **Local-first desktop**: SQLite
- **Shared cloud layer**: Turso / libSQL

## Quick Start

### Web development

```bash
bun run dev
```

### Desktop development

```bash
bun tauri dev
```

### Validation

```bash
bunx biome check .
bunx tsc --noEmit
bun run build
```

## AI Agent Start

Jika membuka chat baru dengan AI coding agent, mulai dari:

- [README-AGENT-START.md](/e:/Freelance/Project/educore/README-AGENT-START.md)

File itu akan mengarahkan agent ke:
- [CLAUDE.md](/e:/Freelance/Project/educore/CLAUDE.md)
- [docs/new-chat-bootstrap.md](/e:/Freelance/Project/educore/docs/new-chat-bootstrap.md)

Prompt paling singkat yang bisa dipakai:

```text
Sebelum mulai, baca dan ikuti README-AGENT-START.md.
Audit dulu, jangan asumsi.
```

## Important Docs

- [CLAUDE.md](/e:/Freelance/Project/educore/CLAUDE.md)
- [docs/technical-blueprint.md](/e:/Freelance/Project/educore/docs/technical-blueprint.md)
- [docs/runtime-matrix.md](/e:/Freelance/Project/educore/docs/runtime-matrix.md)
- [docs/phase-2-execution-roadmap.md](/e:/Freelance/Project/educore/docs/phase-2-execution-roadmap.md)
- [docs/phase-2-desktop-native-checklist.md](/e:/Freelance/Project/educore/docs/phase-2-desktop-native-checklist.md)
- [docs/sync-contract-phase-2.md](/e:/Freelance/Project/educore/docs/sync-contract-phase-2.md)

## Build Notes

- `bun run build` = validasi build web
- `bun run build:desktop` = validasi jalur desktop production
- desktop build boleh tetap diblok fail-secure jika runtime desktop production belum sepenuhnya aman

