# CLAUDE.md

Guidance for anyone (human or Claude) working in this repository.

## Product goal

Claude Virtual Campus visualizes real Claude Code activity across an arbitrary number
of software projects, each written in whatever language/framework its owner chose. The
campus itself is built with TypeScript/Next.js/NestJS, but that is an implementation
detail of the campus -- it must never leak into requirements on the *monitored*
projects.

## Universal-project requirement (non-negotiable)

- Never assume a monitored project uses Node.js, npm/pnpm/yarn, a `src/` directory, or
  any particular test framework.
- Technology detection (`packages/project-inspector`) enriches the experience; it must
  never block core functionality. A project with zero recognized markers still gets a
  room, a main-claude agent, and full event handling.
- The installer (`packages/claude-plugin/installer`) only ever touches `.claude/` inside
  a target project. It must never edit `composer.json`, `package.json`, `go.mod`,
  `pyproject.toml`, or any other project manifest, and must work in non-git directories
  and paths containing spaces.

## Local setup

```bash
cp .env.example .env   # ports are off the defaults: web 3100, api 4000, postgres 5433
pnpm install
pnpm db:up             # Postgres in Docker
pnpm db:migrate
pnpm dev               # web + api, must stay running
```

`docker compose up -d --build` runs the whole stack instead (the API container binds
`0.0.0.0` via `API_HOST` and runs `prisma migrate deploy` on start; `pnpm dev` keeps the
`127.0.0.1` default).

## Architecture boundaries

- `packages/contracts` -- zod schemas + shared TS types + shared 3D layout constants.
  Both `apps/api` and `apps/web` depend on this; neither depends on the other.
  Referenced from `apps/web` via `transpilePackages` (it ships TS source, not built JS,
  under Next.js's own bundler; every other consumer imports the built `dist/`).
- `packages/project-inspector` -- pure, side-effect-light functions: git identity
  resolution (execFile only, never shell interpolation), technology detection, module
  detection. No NestJS/Prisma types leak in here.
- `packages/event-normalizer` -- pure functions: command classification, file
  classification, secret redaction, hook-payload normalization. No I/O.
- `apps/api` -- NestJS. Domain modules are thin adapters over the two packages above
  plus Prisma. Realtime (Socket.IO) only ever emits `NormalizedClaudeEvent` /
  `CampusAgentState` shapes -- raw hook payloads are never forwarded to the frontend.
- `apps/web` -- Next.js + React Three Fiber. All agent movement/animation is driven by
  `ProjectAgent` state coming from the backend; there is no demo/fake animation path in
  production code.

## Security rules

- Payload size limits (512kb) on `/api/claude/events` and `/api/claude/approval`.
- `redactSensitiveData` in `event-normalizer` strips secret-shaped keys/values and drops
  `__proto__`/`constructor`/`prototype` keys before anything is persisted or broadcast.
- Destructive commands (`rm -rf`, `sudo`, force pushes, DB drops/resets, etc.) are
  classified as `destructive` and always route through the approval flow; the approval
  hook defaults to **deny** on timeout, never allow.
- API binds to `127.0.0.1` by default; CORS is restricted to `CORS_ORIGIN`.

## Event pipeline

`POST /api/claude/events` -> validate (zod) -> resolve project (`project-inspector`) ->
upsert project/session/agent -> normalize (`event-normalizer`) -> persist `ClaudeEvent`
(+`ToolExecution` for tool calls) -> broadcast over Socket.IO. See
`docs/superpowers/specs/2026-07-09-virtual-campus-design.md` for the full design and
`apps/api/src/events/events.service.ts` for the orchestration.

### Hook-event mapping caveat

Claude Code's officially documented hook events (as of when this was built) are:
`SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `Notification`,
`PreCompact`, `Stop`, `SubagentStop`, `SessionEnd`. Several event names in the original
product spec are **not** separate documented hooks; they are derived server-side:

| Spec name | Derived from |
|---|---|
| `PermissionRequest` | `PreToolUse`'s `hookSpecificOutput.permissionDecision` (allow/deny/ask) |
| `PostToolUseFailure` | `PostToolUse` where `tool_response.is_error`/`error` is set |
| `SubagentStart` | `PreToolUse` where `tool_name === "Task"` |
| `TaskCreated` / `TaskCompleted` | `UserPromptSubmit` / `Stop` (app-level concept, not a hook) |
| `StopFailure` | not distinguished from `Stop` in the current payload; documented gap |
| `CwdChanged` | not a hook; every payload includes `cwd`, diffed server-side per session |

Also: hooks fire process-wide, not per-subagent, so there is no dedicated subagent
identifier in the payload. `AgentsService.resolveActiveAgent` infers the active agent
via a session-scoped stack (`Task` PreToolUse pushes, `SubagentStop` pops), using the
real `subagent_type`/`description` fields from the `Task` tool's `tool_input` when
present. Verify this mapping against your installed Claude Code CLI's own docs before
depending on it for anything safety-critical.

## Frontend state model

`apps/web` never decides what an agent is doing -- it collapses backend activity into five
visual states in `apps/web/selectors/`, so agents move on phase changes rather than on every
tool call:

| Visual state | Backend activity (examples) | Where the agent goes |
|---|---|---|
| Planning | UserPromptSubmit, planning, meeting | planning table |
| Working | Read/Grep/Edit/Write, commands, db/infra edits | assigned desk |
| Checking | test, build, lint, typecheck, review | shared review screen |
| Attention | permission request, blocked, tool failure | pauses in place + beacon |
| Completed | task complete / successful stop | desk (brief celebrate) -> idle |

Socket events land in `stores/campusStore.ts` (zustand) via `hooks/useCampusSocket.ts`;
components read through selectors, never raw events. The only client-generated motion is
ambient idle life (`selectors/ambient.ts` + `hooks/useAmbientActivity.ts`), which is
labelled as ambient, stops on any real event, and never produces events of its own.

## Testing

`pnpm test` runs vitest per workspace. `apps/api`'s integration tests hit a **real**
Postgres, so `pnpm db:up && pnpm db:migrate` must have run first; the other workspaces are
pure unit tests and need nothing. A single file:

```bash
pnpm --filter @campus/api exec vitest run test/events.integration.test.ts
pnpm --filter @campus/event-normalizer exec vitest run src/redact.test.ts
```

`apps/api/vitest.config.ts` uses the swc plugin, not esbuild -- NestJS DI needs
`emitDecoratorMetadata`, which esbuild does not emit. Test env defaults live in
`apps/api/test/setup.ts`.

To exercise the pipeline without Claude Code, `pnpm demo:events` (or `demo:php`,
`demo:python`, `demo:go`, `demo:attention`) creates real temp git repos and POSTs real hook
payloads to the real endpoint -- there is no fake frontend path.

## Commands required before calling anything done

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

## Longer references

`docs/architecture.md` (data flow, boundaries, agent identity), `docs/hooks.md` (hook-event
mapping), `docs/security.md`, `docs/development.md`, `docs/troubleshooting.md`, and the
full design spec at `docs/superpowers/specs/2026-07-09-virtual-campus-design.md`.

## Prohibitions

- No language-specific branches in core event/agent/room logic (technology is metadata
  only).
- No executing received commands, ever -- classification is string/token analysis only.
- No running project build/test/install commands during technology detection.
- No unrequested abstractions -- see the many single-implementation "modules" in
  `apps/api/src` that are thin wrappers by design, not because more layers were needed.
