# Claude Virtual Campus — Design

Full requirements: user-provided spec (37 sections) in conversation history. This doc records the decisions actually needed to start building; it does not restate the whole spec.

## Scope for MVP build

All 6 phases below, in this order, single session:

1. Monorepo foundation: pnpm workspaces + Turborepo, TS strict, ESLint/Prettier, `packages/contracts` (zod schemas + types), `apps/api` (NestJS), `apps/web` (Next.js App Router), Postgres via docker-compose, Prisma schema, `/api/health`.
2. Project resolver + technology detection: git-based project identity (`execFile`, no shell interpolation), marker-file detection for PHP/Python/Go/Node/Rust/Java/.NET/Ruby/Elixir/C-C++, generic "unknown" fallback, module detection for monorepos.
3. Event pipeline: `POST /api/claude/events`, `POST /api/claude/approval`, payload validation (zod), sanitization/redaction, command classifier, file classifier, event normalizer, persistence, session/agent/task upsert logic.
4. Realtime + 3D: Socket.IO gateway with `campus` / `project:{id}` / `session:{id}` rooms, bootstrap snapshot, React Three Fiber campus scene with procedural geometry, universal room/zone layout, agent avatars whose animation state is driven only by normalized events (no fake demo animation in prod path).
5. Claude plugin: `packages/claude-plugin` hook scripts (`send-event.sh`, approval hook), `settings.template.json`, installer/uninstaller (`campus:install` / `campus:uninstall`) that only touches `.claude/` and never touches project manifests, idempotent, backs up existing settings.
6. Demo + tests: PHP/Python/Go event simulators hitting the real HTTP endpoint, Vitest/Jest unit tests for detection/classification/normalization, Nest integration tests, Playwright or scripted e2e smoke, README + CLAUDE.md.

## Key architectural decisions

- **Project identity**: `projectKey` = sha256 of normalized git remote URL if present, else normalized absolute repo root path. Non-git dirs get a key derived from the resolved absolute path. Never derived from language.
- **Agent identity**: generic `agentType` enum (main-claude, backend-developer, qa-engineer, etc.), technology is metadata only, never branches core logic.
- **Command/file classification**: pure functions, tokenize + regex/keyword rules over an allowlist of categories, default `unknown`, no execution.
- **Security**: localhost bind, narrow CORS, payload size limits, secret redaction by filename/key pattern before persistence, destructive command detection (rm -rf, force push, drop/reset db, sudo) never auto-approved.
- **Realtime**: raw hook payload never forwarded to frontend — only `NormalizedClaudeEvent` / `CampusAgentState` shapes go over the wire.
- **Persistence**: Prisma/Postgres, entities per spec section 14 (Project, ProjectRoom, ProjectModule, ProjectTechnology, ClaudeSession, AgentDefinition, ProjectAgent, Task, TaskAssignment, ClaudeEvent, ToolExecution, ApprovalRequest, ActivitySnapshot).

## Explicitly deferred (real limitations, not silently dropped)

- First-person camera, multiplayer accounts, cloud deploy — per spec's own non-goals.
- Exhaustive per-language classifier rule coverage — ship a solid rule set for PHP/Python/Go/Node/Rust/Java/.NET/Ruby/Elixir/C-C++ covered in spec's examples; further tools extend the same rule table later.
- Full navmesh/pathfinding — straight-line lerp movement between fixed zone coordinates (spec doesn't require navmesh; explicitly a non-goal).

## Test strategy

Vitest for packages (project-inspector, event-normalizer, contracts), Nest's test runner for api integration tests, a shell/node smoke script for the e2e flow (start docker db + api + demo events + assert rooms/agents via REST), no Playwright browser e2e for MVP (visual-only, not asserted by acceptance criteria beyond "campus renders" which smoke script checks via API state, not pixels) — ponytail: browser pixel assertions add flakiness for no acceptance-criteria gain, add if visual regression testing becomes a real ask.
