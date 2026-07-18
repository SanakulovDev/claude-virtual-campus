# Campus run commands: send tasks to agents from the UI

Date: 2026-07-18
Status: approved (user), pending implementation plan

## Problem

The campus is watch-only: hooks stream events from Claude Code into the campus, but there
is no way to hand an agent work from the campus UI. Interactive sessions cannot be typed
into from outside (hooks are one-way, request/response), so "send a command" means
**starting a new headless Claude run** in the project's directory. The run's own hooks
then stream its activity into the campus like any other session, and its destructive tool
calls route through the existing approval drawer (default deny on timeout).

Out of scope: steering an already-running interactive session; kiosk-mode input (kiosk
stays zero-interaction); queueing commands for future interactive sessions.

## A. Backend — RunsModule (`apps/api/src/runs/`)

### Data model (Prisma)

```prisma
enum RunStatus {
  RUNNING
  COMPLETED
  FAILED
  STOPPED
}

model CampusRun {
  id         String    @id @default(cuid())
  projectId  String
  project    Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)
  prompt     String
  status     RunStatus @default(RUNNING)
  resultText String?
  exitCode   Int?
  startedAt  DateTime  @default(now())
  finishedAt DateTime?
}
```

One migration. `Project` gains a `runs CampusRun[]` relation.

### Endpoints

- `POST /api/projects/:projectId/runs` — body `{ prompt: string }` (zod: 1–10,000 chars,
  trimmed non-empty). Guards, in order:
  1. **Loopback guard**: if the API is bound to anything but `127.0.0.1`/`localhost`,
     return 403 `runs are disabled on non-loopback binds` (this endpoint starts
     code-capable agent runs; it must never ride an exposed bind).
  2. Project exists (404 otherwise).
  3. No RUNNING row for this project (409 `a run is already active for this project`).
  4. Fewer than 3 RUNNING rows globally (429 `run limit reached`).
  Then create the row and spawn.
- `POST /api/runs/:runId/stop` — SIGTERM the child if held, mark STOPPED, `finishedAt`
  now. 404 unknown run; 409 if not RUNNING. If the child handle is gone (API restarted),
  mark STOPPED anyway (the process is orphaned; document this).
- `GET /api/projects/:projectId/runs` — most recent 20 runs, newest first.

### Spawn semantics

```ts
execFile(process.env.CLAUDE_BIN ?? 'claude',
  ['-p', prompt, '--output-format', 'text'],
  { cwd: project.rootPath, timeout: 30 * 60 * 1000, maxBuffer: 10 * 1024 * 1024 },
  callback)
```

- Args array only — the prompt is never shell-interpreted (same rule as everywhere else
  in this repo).
- Child handles live in an in-memory `Map<runId, ChildProcess>` for stop().
- Exit 0 → COMPLETED, `resultText` = stdout (trimmed). Non-zero/error → FAILED,
  `resultText` = stderr tail (or the error message, e.g. ENOENT when no `claude` binary —
  the docker container hits this by design and the run simply fails with a clear message).
  Timeout kill → FAILED, `resultText = 'timed out after 30m'`.
- On module init: `updateMany` stale RUNNING → FAILED with `resultText = 'API restarted'`.
- The spawned process inherits the API's user environment, so the user's normal Claude
  auth and the project's installed campus hooks apply. Events from the run arrive through
  the standard pipeline; no new event path.

## B. Realtime + store

- `SOCKET_EVENTS.runStarted` / `SOCKET_EVENTS.runFinished` (contracts), each carrying the
  serialized run row. Emitted campus-wide on create and on any terminal transition
  (COMPLETED/FAILED/STOPPED).
- `campusStore` gains `runs: Record<projectId, RunRow[]>` plus actions `setProjectRuns`,
  `upsertRun`. `useCampusSocket` subscribes to both events.
- Inspector fetches `GET .../runs` when a project is selected; socket events keep the
  list fresh afterward. Runs are not part of the bootstrap payload (lazy per project).

## C. UI — inspector panel only

In `InspectorDrawer`, a "Send task" section for the selected project:

- Textarea (2 rows, placeholder "Give this team a task…"), Send button. Disabled with an
  inline hint while the project has a RUNNING run.
- Run history list (newest first): truncated prompt, status chip (colors from
  `STATE_COLOR`-adjacent palette: running=working green, completed=completed, failed/
  stopped=attention/idle), relative time, expandable `resultText`, and a Stop button on
  the RUNNING row.
- Errors from the endpoints (403/409/429) render as inline text under the box, not toasts.
- Kiosk mode unaffected (inspector is already hidden there).

## D. Security

- Prompt handled as data end to end: JSON body → zod → argv element. No shell, no
  interpolation, 512kb global body cap already applies.
- The loopback guard (A.1) is a hard server-side check against the same resolved host
  value `main.ts` passes to `app.listen()` (exposed via a small provider), not a separate
  re-read of env that could drift from the real bind.
- This does not violate the "no executing received commands" prohibition: nothing from
  *hook payloads* is ever executed; this endpoint launches Claude with a prompt typed by
  the local user in the campus UI, and Claude's own permission system plus the campus
  approval flow (deny-by-default) gate its tool use.
- `docs/security.md` gains a section documenting all of the above, including the orphaned-
  process caveat on stop-after-restart.

## E. Testing

- Integration (real Postgres, `campus_test`): stub `CLAUDE_BIN` pointing at a tiny shell
  script fixture (echoes a marker, sleeps on demand) to test: spawn + COMPLETED result
  capture; FAILED on non-zero exit; per-project 409; global 429; stop → STOPPED; boot
  cleanup of stale RUNNING rows. No real Claude binary in CI.
- Unit: zod schema bounds; loopback-guard predicate.
- Web: store runs-slice tests (setProjectRuns/upsertRun ordering and replacement).
- Gates: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`; manual check with a
  real `claude` binary on the dev machine.
