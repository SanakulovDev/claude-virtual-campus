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

### Spawn & streaming

`RunsService.spawn` switches from buffered `execFile` to `spawn` with line-split stdout:

```
claude -p <prompt> --output-format stream-json --verbose [--permission-mode <m>] [--model <m>] [--resume <sessionId>]
```

- Still: args array (prompt is data, never shell), loopback-only guard, `DATABASE_URL`
  stripped from child env, 30m timeout (now enforced with a manual timer + SIGTERM,
  since `spawn` has no `timeout`+callback convenience), `CLAUDE_BIN` override honored.
- `--verbose` is included unconditionally: print-mode stream-json historically requires
  it, and the init system message it guarantees carries `session_id`. Verify exact
  behavior against the installed CLI (2.1.215) during implementation.
- **No `--include-partial-messages`** — message-level events only. Volume stays
  tens-to-hundreds of rows per run, not token deltas.
- Each stdout line: `JSON.parse` → `redactSensitiveData` (existing export from
  `@campus/event-normalizer`) → persist `RunEvent` → emit `run:event` to the project
  room. Unparseable lines are skipped, counted, and noted on the run's result on
  finalize (never crash the stream).
- stderr: buffered (cap 16kb, keep tail) for failure diagnostics, as today.
- The final `type: "result"` event carries `session_id`, `total_cost_usd`, `usage`,
  `duration_ms`, `is_error`, `result` — persisted onto `CampusRun`.

### Queue

- `RunStatus` gains `QUEUED`. `start()` behavior change: project busy → run is created
  `QUEUED` instead of 409; global limit (3 running) reached → also `QUEUED`. Hard cap:
  10 queued per project → 429 beyond.
- Pop rule: on every finalize/stop, pick the oldest `QUEUED` run whose project has no
  `RUNNING` run, while global running < limit; spawn it; repeat until no slot or no
  candidate. Single in-process scheduler method with a simple mutex flag (NestJS is
  single-process here; no distributed locking).
- `onModuleInit`: mark `RUNNING` → `FAILED` ("API restarted") as today, then run the pop
  rule so queued work resumes after restart.
- `stop()` on a `QUEUED` run: no child to kill; row → `STOPPED`. (Today stop rejects
  non-RUNNING; that check relaxes to RUNNING|QUEUED.)

### Continue (conversation)

- `POST /api/runs/:id/continue { prompt }` → creates a new `CampusRun` with
  `parentRunId = :id`, spawned with `--resume <parent.sessionId>`; queues like any run.
- Guard: parent has non-null `sessionId` (COMPLETED or STOPPED both fine — a stopped
  run's session may still be resumable; if the CLI refuses, the run fails visibly). 404
  if parent missing, 409 if no sessionId.

### Per-run options

Request body (zod): `prompt` (existing limits), `permissionMode` ∈
`default | acceptEdits | plan` (default `default`), `model` ∈
`sonnet | opus | haiku` (optional; omitted → CLI default). `bypassPermissions` is
**deliberately excluded** — it would gut the deny-default approval flow. Values map
1:1 to CLI flags; nothing is interpolated.

### Data model (Prisma)

```prisma
model CampusRun {
  // existing: id, projectId+relation(Cascade), prompt, status, resultText, exitCode, finishedAt
  status         RunStatus @default(QUEUED)
  startedAt      DateTime?              // was @default(now()); null while QUEUED, set on spawn
  createdAt      DateTime  @default(now())
  sessionId      String?
  parentRunId    String?
  permissionMode String    @default("default")
  model          String?
  costUsd        Float?
  usageJson      Json?
  events         RunEvent[]
}

model RunEvent {
  id        String   @id @default(cuid())
  runId     String
  run       CampusRun @relation(fields: [runId], references: [id], onDelete: Cascade)
  seq       Int
  type      String                      // stream-json "type" (system|assistant|user|result)
  payload   Json                        // redacted full event
  createdAt DateTime @default(now())
  @@index([runId, seq])
}
```

Migration note: existing rows get `startedAt` preserved; `createdAt` backfilled from
`startedAt`. Ordering for history switches to `createdAt desc`.

### Endpoints & socket

New/changed HTTP (all behind the existing loopback guard):

- `POST /api/projects/:id/runs` — body gains `permissionMode`, `model`; queues instead
  of 409/429 (429 only past the 10-deep queue cap).
- `POST /api/runs/:id/continue` — as above.
- `POST /api/runs/:id/stop` — now also cancels QUEUED.
- `GET /api/runs/:id/events` — transcript, `seq asc`, no pagination (bounded by
  message-level volume; revisit only if real runs exceed ~2k events).
- `GET /api/agents/:id/events?take=100` — agent-scoped `ClaudeEvent` history for the
  inspector (interactive-session observability).

New socket events in `SOCKET_EVENTS`: `run:event` (one transcript line, project room),
`run:updated` (status transitions incl. queue movements, campus room). `run:started` /
`run:finished` keep their current meaning.

### Security (unchanged posture)

Loopback-only, args-array spawn, `DATABASE_URL` stripped, redaction before persist and
broadcast, `bypassPermissions` excluded, destructive commands still hit the deny-default
approval hook inside the child. Payload size limits unchanged.

## Part B — Lab UI

- **Bottom dock**: the timeline strip becomes a tabbed dock — `Timeline | Console`.
  Console renders the selected run: assistant text blocks, tool-call chips (name +
  primary target), result block, cost + duration footer, autoscroll with a pin toggle,
  Stop button, and a Continue input at the bottom (posts `/continue`). Opening a
  historical run fetches `GET /api/runs/:id/events`; a live run appends from
  `run:event`. Kiosk hides the dock as it hides all chrome today.
- **Launcher** (`RunPanel` v2, in the project inspector): prompt textarea; model +
  permission-mode dropdowns; queue list with per-item cancel; run history (status pill,
  cost, duration, "open in console"). "Send task" always enabled now — it queues.
- **Top bar**: global `running/queued` badge next to the connection pill; 3D/2D view
  toggle (Part E).
- **Analytics panel**: adds a per-project spend line (sum `costUsd`).
- **Store**: `runs` slice extends with `runEvents[runId]`, `consoleRunId`, queue-aware
  statuses, `viewMode`. Socket wiring in `useCampusSocket` adds the two new events.

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

- Pure unit: stream-json line parser (fixture lines incl. malformed), queue pop rule,
  callsign generator (determinism + collision), role-label mapper.
- Integration (`apps/api`, real Postgres as today): full run lifecycle with a **stub
  `CLAUDE_BIN`** fixture script that emits canned stream-json and exits — covers
  start→stream→finalize, queueing past the project/global limits, stop on QUEUED and
  RUNNING, continue wiring (`--resume` arg observed by the stub), restart recovery.
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
- `--resume` of a STOPPED run's session may be refused by the CLI → run fails with the
  CLI's message; acceptable, visible.
- Long transcripts: no pagination on `GET /api/runs/:id/events` — revisit if real runs
  exceed ~2k events.
