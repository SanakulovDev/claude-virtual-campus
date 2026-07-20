# Agent Lab v2 — full lab: runs v2, console UI, callsigns, hover bots, 2D map

Date: 2026-07-20
Status: approved design, pre-implementation

## Context

The campus visualizes real Claude Code activity but is shallow as a *lab*: the runs
feature fires a headless `claude -p` and shows only the final text blob; agents carry
confusing auto-generated names; avatars are low-poly office humans; the only view is the
3D iso scene. User direction (2026-07-20 brainstorm): **full lab** — control plus
observability — better naming, hover-robot avatars, a 2D top-down mode, warm office
palette kept.

Chosen approach: **deepen the existing pipeline** (no agent-SDK control plane, no second
event path). Everything extends `RunsService`, the zustand store, and the existing
selectors. Known limit, accepted: no mid-run steering — stop only, continue after finish
via `--resume`.

## Goals

- Live-streaming run transcripts with cost/token/duration accounting.
- Per-project run queue and conversation continuation (real back-and-forth).
- Per-run model + permission-mode choice (never `bypassPermissions`).
- Console UI for transcripts; launcher UI for queueing runs.
- Agent callsigns replacing raw auto names; humanized role labels.
- Hover-robot avatars replacing the office humans (same motion system).
- 2D SVG top-down map as an alternative renderer over the same state.

## Non-goals

- Mid-run interrupt/steering (CLI headless can't; documented).
- Transcripts for *interactive* sessions — hooks don't carry assistant text. The lab
  console is a runs feature; interactive sessions keep the tool/event timeline.
- Changing the observer model for hook-driven agents: the 3D world still only animates
  from real events.
- Dark/sci-fi restyle: warm office palette stays.

## Part A — Runs v2 (backend)

### Status state machine

`RunStatus` = `QUEUED | STARTING | RUNNING | STOPPING | COMPLETED | FAILED | STOPPED | TIMED_OUT`.

```
QUEUED   --scheduler claims-->        STARTING
STARTING --init event (session_id)--> RUNNING
STARTING --spawn error / early exit-> FAILED
RUNNING  --result is_error:false-->   COMPLETED
RUNNING  --result is_error:true / nonzero exit / fatal parse--> FAILED
RUNNING  --30m timer fires-->         TIMED_OUT   (via STOPPING)
RUNNING  --stop requested-->          STOPPING --exit--> STOPPED
QUEUED   --stop requested-->          STOPPED     (no child)
```

Terminal = COMPLETED | FAILED | STOPPED | TIMED_OUT. STARTING/STOPPING are transient and
mean "a process operation is in flight" — they exist so the scheduler and stop path never
double-act on a row mid-transition. `STARTING → RUNNING` fires on the init `system` event
(the real "it is running" signal), not merely on `spawn()` returning.

### Spawn & streaming

`RunsService.spawn` uses `child_process.spawn` (not `execFile`) with line-split stdout:

```
claude -p --output-format stream-json --verbose [--permission-mode <m>] [--model <m>] [--resume <sessionId>]
```

- **Prompt via stdin, not argv.** Write the prompt to `child.stdin` and end it; `-p` with
  no positional reads the prompt from stdin. This removes the prompt from the process
  argument list (item 7 — no `ps`/`/proc` exposure to other local users) and keeps the
  "prompt is data, never shell" property. Verify stdin-prompt + stream-json against CLI
  2.1.215 during implementation; argv delivery is the documented fallback if stdin is
  refused in print mode.
- `--verbose` unconditional: print-mode stream-json requires it, and the init `system`
  event it guarantees carries `session_id`.
- **No `--include-partial-messages`** — message-level events only (tens-to-hundreds of
  rows per run, not token deltas).
- **Process group**: `spawn(..., { detached: true })` so the child leads its own group
  (pipes retained, never `unref`'d — we still read stdout). `claude` spawns
  subprocesses (MCP servers, tools); killing only the parent orphans them.
- **session_id captured from the init event** (not only the final result): persisted to
  `CampusRun.sessionId` the moment the init `system` line arrives, so even a run that
  fails mid-way is resumable. `--session-id <uuid>` may pin it later if useful; init
  capture is the source of truth.
- Each stdout line: assign monotonic `seq` → `JSON.parse` → `redactSensitiveData`
  (existing `@campus/event-normalizer` export) → **payload-size clamp** (see RunEvent) →
  persist `RunEvent` (idempotent on `(runId, seq)`) → emit `run:event`. Unparseable
  lines are skipped, counted, and the count is recorded on the run at finalize. A parse
  error never crashes the stream.
- stderr: buffered (cap 16kb, keep tail), **run through `redactSensitiveData` before
  persist** (item 7 — stderr can echo secrets/tracebacks).
- The final `type:"result"` event carries `session_id`, `total_cost_usd`, `usage`,
  `duration_ms`, `is_error`, `result` — normalized onto `CampusRun` (see schema).

### Scheduler (single entry point)

One private `schedule()` method is the **only** place a run is spawned. Called after:
`start()`, `continue()`, finalize, stop, and `onModuleInit`. Never spawned inline
elsewhere.

- **In-process reentrancy guard**: an `isScheduling` flag with a "run again" bit — if
  `schedule()` is invoked while already running, it re-runs once after, so no invocation
  is lost and none overlap. This is an optimization; the DB claim below is the
  correctness boundary.
- **Atomic claim in one transaction** (`prisma.$transaction`, interactive):
  1. count global `RUNNING`+`STARTING`; read the set of projects with a `RUNNING`/`STARTING` run.
  2. pick candidate `QUEUED` runs oldest-first (`createdAt asc`), one per idle project,
     up to `GLOBAL_RUN_LIMIT` free slots.
  3. claim them with a **guarded** `updateMany({ where: { id: { in }, status: 'QUEUED' }, data: { status: 'STARTING' } })`. The `status:'QUEUED'` predicate makes the claim
     idempotent: a concurrent scheduler pass that already claimed a row updates 0 rows for
     it and does not double-spawn (Postgres row locks + re-evaluated predicate under READ
     COMMITTED). No raw SQL / `FOR UPDATE SKIP LOCKED` needed given single-process + this
     guard.
- Only rows this pass actually flipped to `STARTING` are spawned (outside the
  transaction). Emit `run:updated` on each transition.
- `start()` / `continue()` create the row `QUEUED` and call `schedule()` — they never
  spawn directly, so project-busy and global-limit are no longer 409/429 error paths but
  normal queueing. 429 only past the **10-deep per-project queue cap**.
- `onModuleInit`: mark orphaned `RUNNING`/`STARTING`/`STOPPING` → `FAILED` ("API
  restarted"), then `schedule()` so queued work resumes.

### Idempotent finalize

`finalize(runId, outcome)` transitions a run to terminal exactly once:

- Guarded `updateMany({ where: { id, status: { in: ['STARTING','RUNNING','STOPPING'] } }, data: {...} })`. If it affects 0 rows, another path already finalized (e.g. process
  `exit` and the `result` line racing, or stop + exit racing) — return without emitting.
- Only on a real transition: emit `run:finished` + `run:updated`, then call `schedule()`
  to fill the freed slot.
- Timeout is deterministic: our own 30m timer sets an internal `timedOut` flag before
  killing, so finalize marks `TIMED_OUT` rather than inferring from `killed`.

### Process lifecycle (stop / timeout / shutdown)

Shared teardown used by `stop()` and the timeout:

1. row → `STOPPING`, emit `run:updated`.
2. `process.kill(-child.pid, 'SIGTERM')` — **whole process group** (negative pid),
   guarded on a live pid.
3. grace timer (`RUN_KILL_GRACE_MS`, default 5s); if the child has not exited,
   `process.kill(-child.pid, 'SIGKILL')`.
4. the `exit` handler runs finalize → `STOPPED` (or `TIMED_OUT` if the timeout flag set).

- `stop()` on a `QUEUED` run: no child — straight to `STOPPED` via finalize.
- `stop()` relaxes its precondition from RUNNING-only to `QUEUED | STARTING | RUNNING`.
- **Shutdown cleanup**: `onModuleDestroy` SIGTERMs every live child group so a dev-server
  restart leaves no orphaned `claude` processes. The boot-time `onModuleInit` recovery
  covers the case where the API is itself SIGKILLed (destroy hook never runs).
- Process-group semantics are POSIX (dev target is macOS/Linux); Windows is out of scope
  and noted.

### Continue (conversation)

- `POST /api/runs/:id/continue { prompt, model?, permissionMode? }` → creates a new
  `CampusRun` with `parentRunId = :id`, `conversationId = parent.conversationId`, spawned
  with `--resume <parent.sessionId>`; queued like any run.
- **Inheritance**: `model` and `permissionMode` default to the parent's unless overridden
  in the body (a conversation keeps its settings).
- Guard: parent has non-null `sessionId` (any terminal status — a STOPPED run's session
  may still resume; if the CLI refuses, the child fails visibly → `FAILED`). 404 if parent
  missing, 409 if no `sessionId`.

### Per-run options

Request body (zod): `prompt` (existing limits), `permissionMode` ∈
`default | acceptEdits | plan` (default `default`), `model` ∈ `sonnet | opus | haiku`
(optional; omitted → CLI default). `bypassPermissions` is **deliberately excluded** — it
would gut the deny-default approval flow. Values map 1:1 to CLI flags; nothing is
interpolated.

### Data model (Prisma)

```prisma
model CampusRun {
  id             String    @id @default(cuid())
  projectId      String
  project        Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)
  prompt         String
  status         RunStatus @default(QUEUED)

  // conversation threading
  parentRunId    String?
  parent         CampusRun?  @relation("RunThread", fields: [parentRunId], references: [id], onDelete: SetNull)
  children       CampusRun[] @relation("RunThread")
  conversationId String?     // = root run id; whole thread shares it

  // options
  permissionMode String   @default("default")
  model          String?
  sessionId      String?    // captured from the init system event

  // outcome
  resultText     String?
  exitCode       Int?
  durationMs     Int?
  costUsd        Decimal? @db.Decimal(10, 6)   // money is never Float
  inputTokens    Int?
  outputTokens   Int?
  cacheReadTokens     Int?
  cacheCreationTokens Int?
  usageJson      Json?      // raw usage block, forward-compat
  skippedLines   Int      @default(0)

  createdAt      DateTime  @default(now())
  startedAt      DateTime?  // set when claimed/spawned; null while QUEUED
  finishedAt     DateTime?

  events         RunEvent[]

  @@index([status, createdAt])        // scheduler: oldest QUEUED
  @@index([projectId, status])        // scheduler: per-project running check
  @@index([conversationId])           // thread fetch
}

model RunEvent {
  id        String    @id @default(cuid())
  runId     String
  run       CampusRun @relation(fields: [runId], references: [id], onDelete: Cascade)
  seq       Int
  type      String    // stream-json "type" (system|assistant|user|result)
  payload   Json      // redacted event, clamped to RUN_EVENT_MAX_BYTES
  createdAt DateTime  @default(now())
  @@unique([runId, seq])              // dedupe: replayed line never doubles
}
```

- **Decimal cost**, normalized token columns (queried by analytics) alongside raw
  `usageJson` (forward-compat).
- `@@unique([runId, seq])` enforces dedupe at the DB; persist with conflict-ignore so a
  replayed/duplicate line is a no-op.
- `conversationId` = root run's id (root sets it to its own id right after create);
  continues copy the parent's. Indexed for whole-thread fetch.
- `parentRunId` self-relation is `onDelete: SetNull` (project deletion still cascades via
  `projectId`; individual runs aren't user-deletable in this app).
- **Payload clamp**: an event whose redacted payload exceeds `RUN_EVENT_MAX_BYTES`
  (default 32kb) is stored/broadcast as `{ truncated: true, type, bytes }` — one giant
  tool result can't bloat a row or a socket frame.
- Migration: existing rows keep `startedAt`; `createdAt` backfilled from it; `costUsd`
  Float→Decimal cast; existing `RunStatus` values map unchanged (new members added).

### Endpoints & socket

New/changed HTTP (all behind the existing loopback guard):

- `POST /api/projects/:id/runs` — body gains `permissionMode`, `model`; queues (429 only
  past the 10-deep per-project queue cap).
- `POST /api/runs/:id/continue` — as above; `model`/`permissionMode` optional overrides.
- `POST /api/runs/:id/stop` — cancels `QUEUED | STARTING | RUNNING`.
- `GET /api/runs/:id/events?after=<seq>&take=<n>` — **cursor pagination**: events with
  `seq > after`, ascending, `take` default 200 / max 1000. Client backfills with the last
  seq it holds. (Resolves the earlier "no pagination" open question.)
- `GET /api/runs/:id/thread` — the whole conversation (`conversationId`), runs in order,
  for threaded rendering.
- `GET /api/agents/:id/events?take=100` — agent-scoped `ClaudeEvent` history for the
  inspector.

New socket events in `SOCKET_EVENTS`: `run:event` (one transcript line, project room, dedup
by `(runId, seq)` on the client), `run:updated` (every status transition incl. queue
movement, campus room). `run:started` / `run:finished` keep their meaning.

### Security

- **Env allowlist, not denylist.** Replace `{ ...process.env, DATABASE_URL: undefined }`
  with an explicit allowlist: `PATH`, `HOME`, `SHELL`, `LANG`, the campus hook URL var,
  and the CLI's own auth/config vars (`ANTHROPIC_API_KEY`, `CLAUDE_*`, `ANTHROPIC_*`).
  Everything else — including secrets for unrelated services — is dropped. Extensible via
  `RUN_ENV_ALLOWLIST`. Denylisting one var leaked the whole environment.
- **stderr redaction** before persist (above).
- **Prompt not in argv** — delivered on stdin (above); no process-list exposure.
- **Retention.** `RunEvent` cascade-deletes with its run. A prune sweep (opportunistic on
  boot + reusing the existing `db:prune` path) drops runs older than `RUN_RETENTION_DAYS`
  (default 30, `0` = keep forever), bounding unbounded event growth.
- Unchanged: loopback-only, args-array spawn, redaction before persist/broadcast,
  `bypassPermissions` excluded, destructive commands still hit the deny-default approval
  hook inside the child, payload size limits on ingest endpoints.

## Part B — Lab UI

- **Bottom dock**: the timeline strip becomes a tabbed dock — `Timeline | Console`.
  Console renders the selected run's **whole conversation thread** (`GET
  /api/runs/:id/thread` → each run's events): prompt/response turns in order, assistant
  text blocks, tool-call chips (name + primary target), per-run result block, cost +
  duration footer, autoscroll with a pin toggle, Stop button, and a Continue input at the
  bottom (posts `/continue`, which appends a new turn to the thread). A live run appends
  from `run:event`.
- **Reconnect recovery**: the store tracks the last `seq` seen per open console run. On
  socket reconnect it calls `GET /api/runs/:id/events?after=<lastSeq>` to backfill the
  gap, then resumes live `run:event`. Incoming events dedupe by `(runId, seq)`, so a
  backfill overlapping a live event never doubles a line. Kiosk hides the dock as today.
- **Launcher** (`RunPanel` v2, in the project inspector): prompt textarea; model +
  permission-mode dropdowns; queue list with per-item cancel; run history (status pill,
  cost, duration, "open in console"). "Send task" always enabled now — it queues.
- **Top bar**: global `running/queued` badge next to the connection pill; 3D/2D view
  toggle (Part E).
- **Analytics panel**: adds a per-project spend line (sum `costUsd`).
- **Store**: `runs` slice extends with `runEvents[runId]`, `lastSeqByRun[runId]`,
  `consoleRunId`, `conversationId`, queue-aware statuses, `viewMode`. Socket wiring in
  `useCampusSocket` adds `run:event` / `run:updated` and the reconnect backfill.

## Part C — Callsigns & role labels

- `AgentsService` assigns a **callsign** at agent creation: curated list (~60 short
  robot names — Bolt, Vega, Juno, Pixel, …) in the API, deterministic index from a hash
  of the stable agent identity, `-2`/`-3` suffix on collision within the project. Lands
  in `ProjectAgent.generatedName` and becomes the `displayName` at creation. Existing
  agents: one-time backfill for rows whose `displayName` still equals the raw
  auto-derived value (never rows a user renamed).
- Role labels humanized in the web (pure mapping fn + tests): `main-claude` → `Lead`,
  known `subagent_type`s → prettified (`general-purpose` → `Explorer`, etc.), unknown
  types → title-cased fallback. Raw ids remain in the inspector's developer details.
- Rename flow (`PATCH /api/agents/:id`) unchanged; renamed agents are never overwritten
  by callsign logic.
- Projects keep directory-derived names.

## Part D — Hover bots

`AgentAvatar` is rewritten with the **same props/interface** — `OfficeAgent`, routing,
labels, camera-follow all untouched.

- **Body**: rounded floating chassis (RoundedBox/capsule mix) in the existing role
  color from `agentBodyColor`; dark glass visor; **emissive eyes whose shape encodes
  visual state** — dots (idle), focused bars (working), scanning sweep (checking),
  alert mark (attention), happy arcs (completed). Antenna with status light replaces
  the chest pin. Small side paddles wiggle on celebrate. Soft emissive hover ring
  underneath; grounding via existing `ContactShadows`. Lead keeps the gold halo.
- **Variety**: accent color + antenna style (3 variants) hashed from agent id —
  replaces skin/hair variants.
- **Motion**: identical waypoint system (`routeBetween` untouched). Gait code becomes
  hover-glide: lean into travel direction proportional to speed, sine bob at rest and
  in flight, lower hover at the desk stool position facing the monitor, spin-bounce on
  celebrate, dim visor + slow bob when resting. Attention beacon and selection ring
  stay.
- **Cleanup**: delete dead `lib/theme.ts` entries (`robotJoint/Servo/Trim/Visor`,
  `grass`, `earth`, `hubPlatform`, `studioPlatform`) and add the new bot accent set.
- Warm office environment, rooms, desks, palette: unchanged.

## Part E — 2D top-down map

- `viewMode: '3d' | '2d'` in the store; persisted to localStorage; `?view=2d` query
  override (kiosk-friendly). Toggle in the top bar.
- `2d` **unmounts the Canvas entirely** (deliberate perf win) and renders `CampusMap`:
  a single SVG whose viewBox derives from the `office-layout` world extents (x/z
  plane). Rooms = outlined zones with status-colored door strips + name; desks = small
  rects; shared review area drawn; bots = role-colored circles with status ring,
  callsign text, pulsing ring on attention.
- Positions come from the **same** `agentWorldTarget` selector; movement is a
  straight-line CSS transition (~600ms). Documented: the map is a status view, not a
  pathing sim — no waypoint animation in 2D.
- Click room/bot → same store selection actions; inspector, dock, approvals identical
  in both modes. Kiosk in 2D: chrome hidden, attention flash overlay still works;
  camera director is a no-op.

## Testing

- Pure unit: stream-json line parser (fixture lines incl. malformed + oversize→truncated),
  scheduler claim/eligibility rule, idempotent-finalize guard (double-finalize is a
  no-op), callsign generator (determinism + collision), role-label mapper, env-allowlist
  builder (secrets dropped, CLI vars kept), payload clamp.
- Integration (`apps/api`, real Postgres as today): full run lifecycle with a **stub
  `CLAUDE_BIN`** fixture script that reads the prompt from stdin, emits canned stream-json
  (init event with `session_id`, assistant/tool lines, final `result`) and exits — covers
  start→stream→finalize, session_id captured from init, queueing past the
  project/global limits, the 10-deep 429, stop on QUEUED/STARTING/RUNNING with
  process-group teardown, continue wiring (`--resume <sessionId>` + inherited options
  observed by the stub), cursor pagination + `after` backfill, restart recovery
  (RUNNING/STARTING/STOPPING → FAILED then reschedule), and dedupe on `(runId, seq)`.
  A stub that sleeps verifies SIGTERM→grace→SIGKILL and the timeout path (short
  `RUN_TIMEOUT_MS` override → TIMED_OUT).
- Web (`ui.test.tsx` pattern): Console rendering from run events, RunPanel v2 states,
  CampusMap renders rooms/bots from store fixtures, view toggle.
- e2e: extend existing suite with a 2D-toggle smoke and a console smoke against the
  stub CLI. Schema isolation rules unchanged (`campus_test` / `campus_smoke`).

## Build order (each step shippable)

1. Runs v2 backend (streaming, queue, continue, options, migrations, stub-CLI tests)
2. Console + launcher UI
3. Callsigns + role labels
4. Hover bots
5. 2D map
6. Analytics/polish (spend line, badges)

## Risks / open questions

- stream-json event shapes may drift between CLI versions: parser is tolerant (unknown
  `type` persisted as-is, UI renders known types, skips unknown), result-field lookup
  defensive. Verify against CLI 2.1.215 output during implementation.
- **Verify during implementation**: stdin-prompt delivery in print+stream-json mode; that
  the init `system` event carries `session_id`; exact `result` field names for cost/usage.
  Each has a documented fallback (argv prompt; session_id from result; `usageJson` raw).
- `--resume` of a STOPPED run's session may be refused by the CLI → run fails with the
  CLI's message; acceptable, visible.
- Process-group kill assumes POSIX; Windows unsupported (noted in lifecycle).
