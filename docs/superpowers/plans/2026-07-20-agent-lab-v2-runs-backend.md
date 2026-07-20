# Agent Lab v2 — Phase 1: Runs v2 Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the fire-and-forget `claude -p` runs feature into a streaming, queued, resumable run engine: live stream-json transcripts, a single-entry atomic scheduler, a full status state machine, process-group teardown, and hardened spawn security.

**Architecture:** Extend the existing `RunsService` (NestJS, single-process) in place. Pure logic (env allowlist, stream-json parsing, payload clamp, scheduler selection) is extracted into small tested functions under `apps/api/src/runs/`; the service composes them and owns process/DB side effects. Persistence is Prisma/Postgres; realtime is the existing Socket.IO gateway. No agent SDK, no second event path.

**Tech Stack:** NestJS 10, Prisma 5 + Postgres, `child_process.spawn`, zod, vitest (swc) with a stub `CLAUDE_BIN` shell script, Socket.IO.

## Global Constraints

- **Loopback-only:** every run mutation stays behind `assertLoopback()` (`isLoopbackHost(resolveApiHost())`). Copied verbatim from the existing service.
- **Prompt is data, never shell:** spawn with an args array; the prompt goes over **stdin**, never argv, never a shell string.
- **Redact before persist and before broadcast:** every stored/emitted payload passes `redactSensitiveData` from `@campus/event-normalizer`.
- **No `bypassPermissions`:** `permissionMode` is limited to `default | acceptEdits | plan`.
- **Env allowlist, not denylist:** the child inherits only an explicit allowlist; secrets for unrelated services are dropped.
- **Single-process scheduler:** NestJS runs one process here; no distributed locking. Correctness comes from a guarded atomic DB claim, not in-memory state.
- **Tests need Postgres:** `apps/api` tests hit real Postgres on schema `campus_test`. Run `pnpm db:up` first. `DATABASE_URL` is assigned by `test/setup.ts` — never rely on an exported value.
- **Money is never Float:** `costUsd` is `Decimal(10,6)`.
- **Spec:** `docs/superpowers/specs/2026-07-20-agent-lab-v2-design.md` (Part A).

## File Structure

| Path | Responsibility | Change |
|---|---|---|
| `apps/api/prisma/schema.prisma` | `RunStatus` enum, `CampusRun`, new `RunEvent` | Modify |
| `apps/api/src/runs/run-env.ts` | `buildRunEnv` — env allowlist | Create |
| `apps/api/src/runs/run-env.test.ts` | allowlist unit tests | Create |
| `apps/api/src/runs/stream-parser.ts` | `parseStreamLine`, `clampPayload`, outcome extraction | Create |
| `apps/api/src/runs/stream-parser.test.ts` | parser unit tests | Create |
| `apps/api/src/runs/scheduler.ts` | `selectClaimable` — pure eligibility rule | Create |
| `apps/api/src/runs/scheduler.test.ts` | scheduler-rule unit tests | Create |
| `apps/api/src/runs/runs.service.ts` | spawn/stream/finalize/schedule/stop/continue | Modify (large) |
| `apps/api/src/runs/runs.controller.ts` | run/continue/events/thread routes + DTO | Modify |
| `apps/api/src/agents/agents.controller.ts` | `GET /api/agents/:id/events` | Modify |
| `apps/api/src/agents/agents.service.ts` | `listEvents` | Modify |
| `packages/contracts/src/socket.ts` | `runEvent`, `runUpdated` event names | Modify |
| `apps/api/test/runs.integration.test.ts` | rewrite stub → stdin+stream-json; new cases | Modify |

**Interfaces produced by the pure modules (used across tasks):**

```ts
// run-env.ts
export function buildRunEnv(source: NodeJS.ProcessEnv): NodeJS.ProcessEnv;

// stream-parser.ts
export type ParsedLine = { type: string; payload: unknown };
export function parseStreamLine(line: string): ParsedLine | null;       // null = skip (blank/unparseable)
export function clampPayload(payload: unknown, maxBytes: number): unknown; // returns {truncated:true,type,bytes} if over
export interface RunOutcome {
  status: 'COMPLETED' | 'FAILED';
  resultText: string | null;
  costUsd: string | null;          // decimal string for Prisma Decimal
  durationMs: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  cacheReadTokens: number | null;
  cacheCreationTokens: number | null;
  usageJson: unknown | null;
  sessionId: string | null;
}
export function extractOutcome(resultEvent: unknown): RunOutcome;        // reads a stream-json type:"result" event
export function extractSessionId(systemEvent: unknown): string | null;   // reads init type:"system" event

// scheduler.ts
export interface ClaimInput {
  queued: { id: string; projectId: string; createdAt: Date }[];         // oldest first
  runningProjectIds: Set<string>;                                        // projects with a RUNNING/STARTING run
  freeSlots: number;                                                     // globalLimit - (running+starting)
}
export function selectClaimable(input: ClaimInput): string[];            // run ids to flip QUEUED->STARTING
```

---

### Task 1: Schema — status machine, CampusRun columns, RunEvent

**Files:**
- Modify: `apps/api/prisma/schema.prisma:241-258`
- Test: `apps/api/test/runs.integration.test.ts` (add one case; full rewrite lands in Task 5)

**Interfaces:**
- Produces: `RunEvent` model, expanded `CampusRun`, `RunStatus` with 8 members. Every later task consumes these.

- [ ] **Step 1: Write the failing test** — append inside the existing `describe('runs (integration)')` in `apps/api/test/runs.integration.test.ts`:

```ts
it('enforces unique (runId, seq) on run events', async () => {
  const project = await makeProject('uniqseq');
  const run = await prisma.campusRun.create({ data: { projectId: project.id, prompt: 'x' } });
  await prisma.runEvent.create({ data: { runId: run.id, seq: 0, type: 'system', payload: {} } });
  await expect(
    prisma.runEvent.create({ data: { runId: run.id, seq: 0, type: 'assistant', payload: {} } }),
  ).rejects.toThrow();
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `pnpm --filter @campus/api exec vitest run test/runs.integration.test.ts -t "unique"`
Expected: FAIL — `prisma.runEvent` is undefined / model does not exist.

- [ ] **Step 3: Edit the enum** — replace `apps/api/prisma/schema.prisma:241-246`:

```prisma
enum RunStatus {
  QUEUED
  STARTING
  RUNNING
  STOPPING
  COMPLETED
  FAILED
  STOPPED
  TIMED_OUT
}
```

- [ ] **Step 4: Replace the `CampusRun` model and add `RunEvent`** — replace `apps/api/prisma/schema.prisma:248-258`:

```prisma
model CampusRun {
  id             String    @id @default(cuid())
  projectId      String
  project        Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)
  prompt         String
  status         RunStatus @default(QUEUED)

  parentRunId    String?
  parent         CampusRun?  @relation("RunThread", fields: [parentRunId], references: [id], onDelete: SetNull)
  children       CampusRun[] @relation("RunThread")
  conversationId String?

  permissionMode String   @default("default")
  model          String?
  sessionId      String?

  resultText          String?
  exitCode            Int?
  durationMs          Int?
  costUsd             Decimal? @db.Decimal(10, 6)
  inputTokens         Int?
  outputTokens        Int?
  cacheReadTokens     Int?
  cacheCreationTokens Int?
  usageJson           Json?
  skippedLines        Int      @default(0)

  createdAt      DateTime  @default(now())
  startedAt      DateTime?
  finishedAt     DateTime?

  events         RunEvent[]

  @@index([status, createdAt])
  @@index([projectId, status])
  @@index([conversationId])
}

model RunEvent {
  id        String    @id @default(cuid())
  runId     String
  run       CampusRun @relation(fields: [runId], references: [id], onDelete: Cascade)
  seq       Int
  type      String
  payload   Json
  createdAt DateTime  @default(now())

  @@unique([runId, seq])
}
```

Note: `startedAt` lost its `@default(now())` — it is set on spawn now. Existing rows keep their value; the migration below backfills nothing else.

- [ ] **Step 5: Create the migration**

Run: `pnpm --filter @campus/api exec prisma migrate dev --name runs_v2 --create-only`
Then open the generated `apps/api/prisma/migrations/*_runs_v2/migration.sql` and confirm it: adds the enum values, adds the columns, creates `RunEvent` with the unique index and the three `CampusRun` indexes. If Prisma emits a `startedAt` drop-default that would null existing rows, edit the SQL to `ALTER COLUMN "startedAt" DROP DEFAULT` only (do not touch existing data).

- [ ] **Step 6: Apply and regenerate**

Run: `pnpm db:up && pnpm --filter @campus/api exec prisma migrate deploy && pnpm --filter @campus/api exec prisma generate`
Expected: migration applied, client regenerated.

- [ ] **Step 7: Run the test to confirm it passes**

Run: `pnpm --filter @campus/api exec vitest run test/runs.integration.test.ts -t "unique"`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations apps/api/test/runs.integration.test.ts
git commit -m "feat(api): runs v2 schema -- status machine, run threading columns, RunEvent"
```

---

### Task 2: Env allowlist (`buildRunEnv`)

**Files:**
- Create: `apps/api/src/runs/run-env.ts`
- Test: `apps/api/src/runs/run-env.test.ts`

**Interfaces:**
- Produces: `buildRunEnv(source): NodeJS.ProcessEnv` — consumed by the service spawn (Task 5).

- [ ] **Step 1: Write the failing test** — `apps/api/src/runs/run-env.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildRunEnv } from './run-env';

describe('buildRunEnv', () => {
  it('keeps CLI + system vars, drops everything else', () => {
    const env = buildRunEnv({
      PATH: '/usr/bin', HOME: '/home/x', SHELL: '/bin/zsh', LANG: 'en_US.UTF-8',
      ANTHROPIC_API_KEY: 'sk-ant', CLAUDE_CONFIG_DIR: '/c', CAMPUS_HOOK_URL: 'http://127.0.0.1:4000',
      DATABASE_URL: 'postgres://secret', AWS_SECRET_ACCESS_KEY: 'nope', STRIPE_KEY: 'nope',
    });
    expect(env.PATH).toBe('/usr/bin');
    expect(env.HOME).toBe('/home/x');
    expect(env.ANTHROPIC_API_KEY).toBe('sk-ant');
    expect(env.CLAUDE_CONFIG_DIR).toBe('/c');
    expect(env.CAMPUS_HOOK_URL).toBe('http://127.0.0.1:4000');
    expect(env.DATABASE_URL).toBeUndefined();
    expect(env.AWS_SECRET_ACCESS_KEY).toBeUndefined();
    expect(env.STRIPE_KEY).toBeUndefined();
  });

  it('honors the RUN_ENV_ALLOWLIST extension', () => {
    const env = buildRunEnv({ MY_EXTRA: 'v', RUN_ENV_ALLOWLIST: 'MY_EXTRA' });
    expect(env.MY_EXTRA).toBe('v');
  });
});
```

- [ ] **Step 2: Run to confirm it fails**

Run: `pnpm --filter @campus/api exec vitest run src/runs/run-env.test.ts`
Expected: FAIL — cannot find `./run-env`.

- [ ] **Step 3: Implement** — `apps/api/src/runs/run-env.ts`:

```ts
/** The child gets an explicit allowlist, never the full environment. A denylist of one
 * variable would leak every unrelated secret in the parent process; this drops them by
 * default. Prefix matches cover the CLI's own config family. */
const EXACT = new Set(['PATH', 'HOME', 'SHELL', 'LANG', 'LC_ALL', 'TERM', 'TMPDIR', 'CAMPUS_HOOK_URL']);
const PREFIXES = ['CLAUDE_', 'ANTHROPIC_'];

export function buildRunEnv(source: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const extra = (source.RUN_ENV_ALLOWLIST ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const allowExact = new Set([...EXACT, ...extra]);
  const out: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(source)) {
    if (value === undefined) continue;
    if (allowExact.has(key) || PREFIXES.some((p) => key.startsWith(p))) out[key] = value;
  }
  return out;
}
```

- [ ] **Step 4: Run to confirm it passes**

Run: `pnpm --filter @campus/api exec vitest run src/runs/run-env.test.ts`
Expected: PASS (both cases).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/runs/run-env.ts apps/api/src/runs/run-env.test.ts
git commit -m "feat(api): env allowlist builder for run children"
```

---

### Task 3: Stream-json parser, payload clamp, outcome extraction

**Files:**
- Create: `apps/api/src/runs/stream-parser.ts`
- Test: `apps/api/src/runs/stream-parser.test.ts`

**Interfaces:**
- Produces: `parseStreamLine`, `clampPayload`, `extractOutcome`, `extractSessionId`, `RunOutcome` — consumed by the service (Task 5).

- [ ] **Step 1: Write the failing test** — `apps/api/src/runs/stream-parser.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseStreamLine, clampPayload, extractOutcome, extractSessionId } from './stream-parser';

describe('parseStreamLine', () => {
  it('parses a json line', () => {
    expect(parseStreamLine('{"type":"assistant","x":1}')).toEqual({ type: 'assistant', payload: { type: 'assistant', x: 1 } });
  });
  it('skips blank and unparseable lines', () => {
    expect(parseStreamLine('')).toBeNull();
    expect(parseStreamLine('   ')).toBeNull();
    expect(parseStreamLine('not json')).toBeNull();
  });
  it('defaults a missing type to "unknown"', () => {
    expect(parseStreamLine('{"foo":1}')).toEqual({ type: 'unknown', payload: { foo: 1 } });
  });
});

describe('clampPayload', () => {
  it('passes small payloads through', () => {
    expect(clampPayload({ a: 1 }, 1000)).toEqual({ a: 1 });
  });
  it('replaces oversize payloads with a truncation marker', () => {
    const big = { type: 'assistant', blob: 'x'.repeat(500) };
    const out = clampPayload(big, 100) as { truncated: boolean; type: string; bytes: number };
    expect(out.truncated).toBe(true);
    expect(out.type).toBe('assistant');
    expect(out.bytes).toBeGreaterThan(100);
  });
});

describe('extractSessionId', () => {
  it('reads session_id from an init system event', () => {
    expect(extractSessionId({ type: 'system', subtype: 'init', session_id: 'sess-1' })).toBe('sess-1');
  });
  it('returns null when absent', () => {
    expect(extractSessionId({ type: 'assistant' })).toBeNull();
  });
});

describe('extractOutcome', () => {
  it('maps a successful result event', () => {
    const o = extractOutcome({
      type: 'result', subtype: 'success', is_error: false, result: 'done',
      total_cost_usd: 0.0123, duration_ms: 4200, session_id: 'sess-1',
      usage: { input_tokens: 10, output_tokens: 20, cache_read_input_tokens: 5, cache_creation_input_tokens: 2 },
    });
    expect(o.status).toBe('COMPLETED');
    expect(o.resultText).toBe('done');
    expect(o.costUsd).toBe('0.0123');
    expect(o.durationMs).toBe(4200);
    expect(o.inputTokens).toBe(10);
    expect(o.outputTokens).toBe(20);
    expect(o.cacheReadTokens).toBe(5);
    expect(o.cacheCreationTokens).toBe(2);
    expect(o.sessionId).toBe('sess-1');
  });
  it('maps an error result event to FAILED', () => {
    const o = extractOutcome({ type: 'result', is_error: true, result: 'nope' });
    expect(o.status).toBe('FAILED');
    expect(o.resultText).toBe('nope');
  });
});
```

- [ ] **Step 2: Run to confirm it fails**

Run: `pnpm --filter @campus/api exec vitest run src/runs/stream-parser.test.ts`
Expected: FAIL — cannot find `./stream-parser`.

- [ ] **Step 3: Implement** — `apps/api/src/runs/stream-parser.ts`:

```ts
export type ParsedLine = { type: string; payload: unknown };

export function parseStreamLine(line: string): ParsedLine | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  let payload: unknown;
  try {
    payload = JSON.parse(trimmed);
  } catch {
    return null;
  }
  const type = typeof (payload as { type?: unknown })?.type === 'string' ? (payload as { type: string }).type : 'unknown';
  return { type, payload };
}

export function clampPayload(payload: unknown, maxBytes: number): unknown {
  const bytes = Buffer.byteLength(JSON.stringify(payload) ?? '', 'utf8');
  if (bytes <= maxBytes) return payload;
  const type = typeof (payload as { type?: unknown })?.type === 'string' ? (payload as { type: string }).type : 'unknown';
  return { truncated: true, type, bytes };
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

export function extractSessionId(event: unknown): string | null {
  const id = (event as { session_id?: unknown })?.session_id;
  return typeof id === 'string' && id.length > 0 ? id : null;
}

export interface RunOutcome {
  status: 'COMPLETED' | 'FAILED';
  resultText: string | null;
  costUsd: string | null;
  durationMs: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  cacheReadTokens: number | null;
  cacheCreationTokens: number | null;
  usageJson: unknown | null;
  sessionId: string | null;
}

export function extractOutcome(event: unknown): RunOutcome {
  const e = (event ?? {}) as Record<string, unknown>;
  const usage = (e.usage ?? null) as Record<string, unknown> | null;
  const cost = num(e.total_cost_usd);
  return {
    status: e.is_error ? 'FAILED' : 'COMPLETED',
    resultText: typeof e.result === 'string' ? e.result : null,
    costUsd: cost === null ? null : String(cost),
    durationMs: num(e.duration_ms),
    inputTokens: usage ? num(usage.input_tokens) : null,
    outputTokens: usage ? num(usage.output_tokens) : null,
    cacheReadTokens: usage ? num(usage.cache_read_input_tokens) : null,
    cacheCreationTokens: usage ? num(usage.cache_creation_input_tokens) : null,
    usageJson: usage,
    sessionId: extractSessionId(event),
  };
}
```

- [ ] **Step 4: Run to confirm it passes**

Run: `pnpm --filter @campus/api exec vitest run src/runs/stream-parser.test.ts`
Expected: PASS (all describes).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/runs/stream-parser.ts apps/api/src/runs/stream-parser.test.ts
git commit -m "feat(api): stream-json line parser, payload clamp, outcome extraction"
```

---

### Task 4: Scheduler selection rule (`selectClaimable`)

**Files:**
- Create: `apps/api/src/runs/scheduler.ts`
- Test: `apps/api/src/runs/scheduler.test.ts`

**Interfaces:**
- Produces: `selectClaimable(input): string[]` and `ClaimInput` — consumed by `RunsService.schedule` (Task 6).

- [ ] **Step 1: Write the failing test** — `apps/api/src/runs/scheduler.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { selectClaimable } from './scheduler';

const d = (n: number) => new Date(2026, 0, 1, 0, 0, n);

describe('selectClaimable', () => {
  it('claims one run per idle project, oldest first, within free slots', () => {
    const ids = selectClaimable({
      queued: [
        { id: 'a1', projectId: 'A', createdAt: d(1) },
        { id: 'a2', projectId: 'A', createdAt: d(2) },
        { id: 'b1', projectId: 'B', createdAt: d(3) },
      ],
      runningProjectIds: new Set(),
      freeSlots: 5,
    });
    expect(ids).toEqual(['a1', 'b1']); // a2 waits: A now has a claimed run
  });

  it('skips projects that already have a running run', () => {
    const ids = selectClaimable({
      queued: [{ id: 'a1', projectId: 'A', createdAt: d(1) }, { id: 'b1', projectId: 'B', createdAt: d(2) }],
      runningProjectIds: new Set(['A']),
      freeSlots: 5,
    });
    expect(ids).toEqual(['b1']);
  });

  it('never exceeds free slots', () => {
    const ids = selectClaimable({
      queued: [
        { id: 'a1', projectId: 'A', createdAt: d(1) },
        { id: 'b1', projectId: 'B', createdAt: d(2) },
        { id: 'c1', projectId: 'C', createdAt: d(3) },
      ],
      runningProjectIds: new Set(),
      freeSlots: 2,
    });
    expect(ids).toEqual(['a1', 'b1']);
  });

  it('claims nothing when no slots', () => {
    expect(selectClaimable({ queued: [{ id: 'a1', projectId: 'A', createdAt: d(1) }], runningProjectIds: new Set(), freeSlots: 0 })).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to confirm it fails**

Run: `pnpm --filter @campus/api exec vitest run src/runs/scheduler.test.ts`
Expected: FAIL — cannot find `./scheduler`.

- [ ] **Step 3: Implement** — `apps/api/src/runs/scheduler.ts`:

```ts
export interface ClaimInput {
  queued: { id: string; projectId: string; createdAt: Date }[];
  runningProjectIds: Set<string>;
  freeSlots: number;
}

/** Pick run ids to flip QUEUED->STARTING: oldest first, at most one per project, never
 * more than the free global slots, never a project that already has a run in flight. */
export function selectClaimable({ queued, runningProjectIds, freeSlots }: ClaimInput): string[] {
  const ordered = [...queued].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const claimedProjects = new Set(runningProjectIds);
  const ids: string[] = [];
  for (const run of ordered) {
    if (ids.length >= freeSlots) break;
    if (claimedProjects.has(run.projectId)) continue;
    ids.push(run.id);
    claimedProjects.add(run.projectId);
  }
  return ids;
}
```

- [ ] **Step 4: Run to confirm it passes**

Run: `pnpm --filter @campus/api exec vitest run src/runs/scheduler.test.ts`
Expected: PASS (all four cases).

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/runs/scheduler.ts apps/api/src/runs/scheduler.test.ts
git commit -m "feat(api): pure scheduler selection rule for run queue"
```

---

### Task 5: Streaming spawn + idempotent finalize

Rewrite the service's spawn path: stdin prompt, `detached` process group, stream-json parsing into `RunEvent` rows with monotonic `seq`, `session_id` captured from the init event, and a guarded idempotent finalize that normalizes the outcome. Add the two socket event names. Rewrite the test stub to read stdin and emit stream-json.

**Files:**
- Modify: `apps/api/src/runs/runs.service.ts` (spawn, finalize, new helpers; keep `start`/`stop`/`listForProject` compiling — queue/lifecycle land in Tasks 6–7)
- Modify: `packages/contracts/src/socket.ts:20-22`
- Modify: `apps/api/test/runs.integration.test.ts` (stub + streaming cases)

**Interfaces:**
- Consumes: `buildRunEnv` (T2), `parseStreamLine`/`clampPayload`/`extractOutcome`/`extractSessionId` (T3).
- Produces: `run:event` and `run:updated` socket constants; `RunEvent` rows keyed by `(runId, seq)`; `CampusRun.sessionId` set from init.

- [ ] **Step 1: Add socket event names** — in `packages/contracts/src/socket.ts`, after the `runFinished` line (`:20-21`):

```ts
  runStarted: 'run:started',
  runFinished: 'run:finished',
  runEvent: 'run:event',
  runUpdated: 'run:updated',
```

Then rebuild contracts so the api picks them up:

Run: `pnpm --filter @campus/contracts build`

- [ ] **Step 2: Rewrite the stub and write the streaming test** — in `apps/api/test/runs.integration.test.ts`, replace the `STUB` constant with a stdin-reading stream-json emitter:

```ts
/** Stub claude: reads the prompt from stdin (proving it is never on argv), echoes the
 * DATABASE_URL it sees (proving the child never inherits it), and emits stream-json:
 * an init system event with a session_id, an assistant line, then a result. Sleeps when
 * STUB_SLEEP is set. Fails (is_error result + exit 3) when the prompt contains fail-me. */
const STUB = `#!/bin/sh
PROMPT=$(cat)
echo "{\\"type\\":\\"system\\",\\"subtype\\":\\"init\\",\\"session_id\\":\\"sess-stub\\"}"
echo "db:[$DATABASE_URL]"
echo "{\\"type\\":\\"assistant\\",\\"message\\":\\"$PROMPT\\"}"
if [ -n "$STUB_SLEEP" ]; then sleep "$STUB_SLEEP"; fi
if echo "$PROMPT" | grep -q fail-me; then
  echo "{\\"type\\":\\"result\\",\\"is_error\\":true,\\"result\\":\\"boom\\"}"
  exit 3
fi
echo "{\\"type\\":\\"result\\",\\"is_error\\":false,\\"result\\":\\"stub-result: $PROMPT\\",\\"total_cost_usd\\":0.01,\\"duration_ms\\":5,\\"session_id\\":\\"sess-stub\\",\\"usage\\":{\\"input_tokens\\":3,\\"output_tokens\\":4}}"
`;
```

Add streaming assertions (keep the existing `waitForTerminal` helper):

```ts
it('streams stream-json into RunEvent rows and finalizes COMPLETED', async () => {
  const project = await makeProject('stream');
  const res = await request(app.getHttpServer()).post(`/api/projects/${project.id}/runs`).send({ prompt: 'hello world' });
  expect(res.status).toBe(201);
  const run = await waitForTerminal(res.body.id);
  expect(run.status).toBe('COMPLETED');
  expect(run.sessionId).toBe('sess-stub');
  expect(run.resultText).toContain('hello world');
  expect(run.costUsd?.toString()).toBe('0.01');
  expect(run.inputTokens).toBe(3);
  const events = await prisma.runEvent.findMany({ where: { runId: run.id }, orderBy: { seq: 'asc' } });
  expect(events[0].type).toBe('system');
  expect(events.some((e) => e.type === 'result')).toBe(true);
  expect(events.map((e) => e.seq)).toEqual(events.map((_, i) => i)); // seq is 0..n dense
});

it('marks a failing run FAILED with the error result text', async () => {
  const project = await makeProject('streamfail');
  const res = await request(app.getHttpServer()).post(`/api/projects/${project.id}/runs`).send({ prompt: 'please fail-me' });
  const run = await waitForTerminal(res.body.id);
  expect(run.status).toBe('FAILED');
  expect(run.resultText).toContain('boom');
});
```

- [ ] **Step 3: Run to confirm it fails**

Run: `pnpm db:up && pnpm --filter @campus/api exec vitest run test/runs.integration.test.ts -t "streams stream-json"`
Expected: FAIL — events not persisted / `sessionId` null (service still buffers `execFile`).

- [ ] **Step 4: Rewrite the spawn + finalize path** in `apps/api/src/runs/runs.service.ts`. Replace the imports, constants, `spawn`, and `finalize` with:

```ts
import { ConflictException, ForbiddenException, HttpException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { spawn, type ChildProcess } from 'node:child_process';
import { createInterface } from 'node:readline';
import type { CampusRun } from '@prisma/client';
import { SOCKET_EVENTS } from '@campus/contracts';
import { redactSensitiveData } from '@campus/event-normalizer';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { isLoopbackHost, resolveApiHost } from '../config/api-host';
import { buildRunEnv } from './run-env';
import { parseStreamLine, clampPayload, extractOutcome, extractSessionId, type RunOutcome } from './stream-parser';

const RUN_TIMEOUT_MS = Number(process.env.RUN_TIMEOUT_MS ?? 30 * 60 * 1000);
const RUN_EVENT_MAX_BYTES = Number(process.env.RUN_EVENT_MAX_BYTES ?? 32 * 1024);
const STDERR_CAP = 16 * 1024;
const GLOBAL_RUN_LIMIT = 3;
```

Add per-run in-memory tracking near the `children` map:

```ts
  private readonly children = new Map<string, ChildProcess>();
  private readonly seqCounters = new Map<string, number>();
  private readonly timedOut = new Set<string>();
```

Replace `spawn(...)` with a stdin/stream-json version:

```ts
  /** spawn with an args array + stdin prompt: the prompt is data, never argv, never shell. */
  private launch(run: CampusRun, cwd: string) {
    const args = ['-p', '--output-format', 'stream-json', '--verbose', '--permission-mode', run.permissionMode];
    if (run.model) args.push('--model', run.model);
    if (run.parentRunId && run.sessionId) args.push('--resume', run.sessionId); // continue: parent's session copied onto the child before launch
    const child = spawn(process.env.CLAUDE_BIN ?? 'claude', args, {
      cwd,
      detached: true, // own process group so we can kill the whole tree
      env: buildRunEnv(process.env),
    });
    this.children.set(run.id, child);
    this.seqCounters.set(run.id, 0);

    child.stdin?.write(run.prompt);
    child.stdin?.end();

    let stderr = '';
    child.stderr?.on('data', (b: Buffer) => {
      stderr = (stderr + b.toString()).slice(-STDERR_CAP);
    });

    const rl = createInterface({ input: child.stdout! });
    let outcome: RunOutcome | null = null;
    rl.on('line', (line) => {
      const parsed = parseStreamLine(line);
      if (!parsed) {
        void this.bumpSkipped(run.id);
        return;
      }
      if (parsed.type === 'system' && !run.sessionId) {
        const sid = extractSessionId(parsed.payload);
        if (sid) void this.setSessionId(run.id, sid);
      }
      if (parsed.type === 'result') outcome = extractOutcome(parsed.payload);
      void this.persistEvent(run.id, parsed.type, parsed.payload);
      void this.markRunning(run.id);
    });

    child.on('error', (err) => void this.finalize(run.id, { status: 'FAILED', resultText: err.message }));
    child.on('close', (code) => {
      const timedOut = this.timedOut.delete(run.id);
      const status = timedOut ? 'TIMED_OUT' : outcome?.status ?? (code === 0 ? 'COMPLETED' : 'FAILED');
      const resultText = outcome?.resultText ?? (status === 'COMPLETED' ? '' : this.redactStderr(stderr) || `exit ${code}`);
      void this.finalize(run.id, { ...(outcome ?? {}), status, resultText, exitCode: code ?? null });
    });
  }

  private async persistEvent(runId: string, type: string, payload: unknown) {
    const seq = this.seqCounters.get(runId) ?? 0;
    this.seqCounters.set(runId, seq + 1);
    const redacted = redactSensitiveData(payload as Record<string, unknown>);
    const clamped = clampPayload(redacted, RUN_EVENT_MAX_BYTES);
    await this.prisma.runEvent.create({ data: { runId, seq, type, payload: clamped as object } }).catch(() => undefined);
    this.realtime.emitToCampus(SOCKET_EVENTS.runEvent, { runId, seq, type, payload: clamped });
  }

  private async bumpSkipped(runId: string) {
    await this.prisma.campusRun.update({ where: { id: runId }, data: { skippedLines: { increment: 1 } } }).catch(() => undefined);
  }

  private async setSessionId(runId: string, sessionId: string) {
    await this.prisma.campusRun.update({ where: { id: runId }, data: { sessionId } }).catch(() => undefined);
  }

  /** stderr can echo secrets/tracebacks -- redact with the canonical patterns before it
   * becomes resultText. Reuses redactSensitiveData (no second set of regexes to drift). */
  private redactStderr(s: string): string {
    return (redactSensitiveData({ v: s.trim() }) as { v?: string }).v ?? '';
  }

  /** STARTING -> RUNNING on first real output; guarded so it fires at most once. */
  private async markRunning(runId: string) {
    const res = await this.prisma.campusRun.updateMany({ where: { id: runId, status: 'STARTING' }, data: { status: 'RUNNING', startedAt: new Date() } });
    if (res.count > 0) {
      const run = await this.prisma.campusRun.findUnique({ where: { id: runId } });
      if (run) this.realtime.emitToCampus(SOCKET_EVENTS.runUpdated, run);
    }
  }
```

Replace `finalize` with an idempotent, outcome-normalizing version:

```ts
  /** Transition to a terminal status exactly once. A racing exit + result line, or stop +
   * exit, both call this; the status guard makes the second call a no-op. */
  private async finalize(runId: string, outcome: Partial<RunOutcome> & { status: CampusRun['status']; resultText?: string | null; exitCode?: number | null }) {
    this.children.delete(runId);
    this.seqCounters.delete(runId);
    const res = await this.prisma.campusRun.updateMany({
      where: { id: runId, status: { in: ['STARTING', 'RUNNING', 'STOPPING'] } },
      data: {
        status: outcome.status,
        resultText: outcome.resultText ?? undefined,
        exitCode: outcome.exitCode ?? undefined,
        durationMs: outcome.durationMs ?? undefined,
        costUsd: outcome.costUsd ?? undefined,
        inputTokens: outcome.inputTokens ?? undefined,
        outputTokens: outcome.outputTokens ?? undefined,
        cacheReadTokens: outcome.cacheReadTokens ?? undefined,
        cacheCreationTokens: outcome.cacheCreationTokens ?? undefined,
        usageJson: (outcome.usageJson ?? undefined) as object | undefined,
        finishedAt: new Date(),
      },
    });
    if (res.count === 0) return; // already finalized
    const run = await this.prisma.campusRun.findUnique({ where: { id: runId } });
    if (run) {
      this.realtime.emitToCampus(SOCKET_EVENTS.runFinished, run);
      this.realtime.emitToCampus(SOCKET_EVENTS.runUpdated, run);
    }
    await this.schedule(); // fill the freed slot (Task 6)
  }
```

For this task, add a temporary no-op `schedule` so the file compiles (Task 6 replaces it):

```ts
  private async schedule() { /* implemented in Task 6 */ }
```

Update `start()` to create the row and launch immediately (queueing lands in Task 6), setting status `STARTING`:

```ts
  async start(projectId: string, prompt: string, options: { permissionMode?: string; model?: string } = {}): Promise<CampusRun> {
    this.assertLoopback();
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);
    const run = await this.prisma.campusRun.create({
      data: { projectId, prompt, status: 'STARTING', startedAt: new Date(), permissionMode: options.permissionMode ?? 'default', model: options.model ?? null },
    });
    await this.prisma.campusRun.update({ where: { id: run.id }, data: { conversationId: run.id } });
    this.launch(run, project.rootPath);
    this.realtime.emitToCampus(SOCKET_EVENTS.runStarted, run);
    return run;
  }
```

Keep `stop()` and `listForProject()` as they are for now (Task 7 rewrites `stop`, Task 6 fixes ordering). Update `onModuleInit` to also cover the new transient states:

```ts
  async onModuleInit() {
    await this.prisma.campusRun.updateMany({
      where: { status: { in: ['RUNNING', 'STARTING', 'STOPPING'] } },
      data: { status: 'FAILED', resultText: 'API restarted', finishedAt: new Date() },
    });
    await this.schedule();
  }
```

- [ ] **Step 5: Run to confirm the streaming tests pass**

Run: `pnpm --filter @campus/api exec vitest run test/runs.integration.test.ts -t "stream"`
Expected: PASS — both `streams stream-json` and `marks a failing run FAILED`.

- [ ] **Step 6: Typecheck the workspace**

Run: `pnpm --filter @campus/api exec tsc --noEmit`
Expected: no errors. (If `redactSensitiveData`'s signature differs, adapt the call — it accepts and returns a record.)

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/runs/runs.service.ts packages/contracts/src/socket.ts apps/api/test/runs.integration.test.ts
git commit -m "feat(api): stream-json run transcripts, session capture, idempotent finalize"
```

---

### Task 6: Scheduler, queue, per-run limits, restart recovery

Turn `start`/`continue` into queueing operations and implement the real `schedule()` with the atomic claim. Add `permissionMode`/`model` to the DTO.

**Files:**
- Modify: `apps/api/src/runs/runs.service.ts` (`start`, `schedule`, add `QUEUE_LIMIT`)
- Modify: `apps/api/src/runs/runs.controller.ts` (DTO)
- Modify: `apps/api/test/runs.integration.test.ts` (queue cases)

**Interfaces:**
- Consumes: `selectClaimable` (T4).
- Produces: `start` returns a `QUEUED` run when busy; `schedule()` claims + launches.

- [ ] **Step 1: Write the failing tests** — add to `apps/api/test/runs.integration.test.ts`:

```ts
it('queues a second run for the same project, then runs it after the first finishes', async () => {
  process.env.STUB_SLEEP = '1';
  const project = await makeProject('queue');
  const a = await request(app.getHttpServer()).post(`/api/projects/${project.id}/runs`).send({ prompt: 'first' });
  const b = await request(app.getHttpServer()).post(`/api/projects/${project.id}/runs`).send({ prompt: 'second' });
  expect(a.status).toBe(201);
  expect(b.status).toBe(201);
  const bFresh = await prisma.campusRun.findUnique({ where: { id: b.body.id } });
  expect(['QUEUED', 'STARTING']).toContain(bFresh!.status); // not RUNNING while A holds the project
  const bDone = await waitForTerminal(b.body.id, 20000);
  expect(bDone.status).toBe('COMPLETED');
  delete process.env.STUB_SLEEP;
});

it('rejects past the 10-deep per-project queue cap', async () => {
  process.env.STUB_SLEEP = '3';
  const project = await makeProject('cap');
  for (let i = 0; i < 11; i++) {
    await request(app.getHttpServer()).post(`/api/projects/${project.id}/runs`).send({ prompt: `r${i}` });
  }
  const over = await request(app.getHttpServer()).post(`/api/projects/${project.id}/runs`).send({ prompt: 'too-many' });
  expect(over.status).toBe(429);
  delete process.env.STUB_SLEEP;
}, 30000);

it('accepts a per-run permissionMode and model', async () => {
  const project = await makeProject('opts');
  const res = await request(app.getHttpServer()).post(`/api/projects/${project.id}/runs`).send({ prompt: 'x', permissionMode: 'plan', model: 'opus' });
  expect(res.status).toBe(201);
  const run = await waitForTerminal(res.body.id);
  expect(run.permissionMode).toBe('plan');
  expect(run.model).toBe('opus');
});
```

- [ ] **Step 2: Run to confirm they fail**

Run: `pnpm --filter @campus/api exec vitest run test/runs.integration.test.ts -t "queue"`
Expected: FAIL — second run launches immediately (no queue) / 429 never returned.

- [ ] **Step 3: Update the DTO** — replace the schema in `apps/api/src/runs/runs.controller.ts`:

```ts
const startRunSchema = z.object({
  prompt: z.string().trim().min(1).max(10_000),
  permissionMode: z.enum(['default', 'acceptEdits', 'plan']).optional(),
  model: z.enum(['sonnet', 'opus', 'haiku']).optional(),
});
```

And pass the options through:

```ts
  @Post('api/projects/:projectId/runs')
  start(@Param('projectId') projectId: string, @Body() body: unknown) {
    const parsed = startRunSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    const { prompt, ...options } = parsed.data;
    return this.runs.start(projectId, prompt, options);
  }
```

- [ ] **Step 4: Rewrite `start` to queue, and implement `schedule`** in `apps/api/src/runs/runs.service.ts`. Add the cap constant near the others:

```ts
const QUEUE_LIMIT = 10;
```

Replace `start` (from Task 5) with a queueing version:

```ts
  async start(projectId: string, prompt: string, options: { permissionMode?: string; model?: string } = {}): Promise<CampusRun> {
    this.assertLoopback();
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);
    const queued = await this.prisma.campusRun.count({ where: { projectId, status: 'QUEUED' } });
    if (queued >= QUEUE_LIMIT) throw new HttpException('queue is full for this project', 429);

    const run = await this.prisma.campusRun.create({
      data: { projectId, prompt, status: 'QUEUED', permissionMode: options.permissionMode ?? 'default', model: options.model ?? null },
    });
    await this.prisma.campusRun.update({ where: { id: run.id }, data: { conversationId: run.id } });
    this.realtime.emitToCampus(SOCKET_EVENTS.runStarted, run);
    await this.schedule();
    return this.prisma.campusRun.findUnique({ where: { id: run.id } }) as Promise<CampusRun>;
  }
```

Replace the no-op `schedule` with the atomic claim:

```ts
  private isScheduling = false;
  private scheduleAgain = false;

  /** The ONLY place a run is spawned. Serialized in-process; correctness is the guarded
   * QUEUED->STARTING claim, which is a no-op for any row a concurrent pass already took. */
  private async schedule(): Promise<void> {
    if (this.isScheduling) { this.scheduleAgain = true; return; }
    this.isScheduling = true;
    try {
      do {
        this.scheduleAgain = false;
        const claimed = await this.prisma.$transaction(async (tx) => {
          const inFlight = await tx.campusRun.findMany({ where: { status: { in: ['RUNNING', 'STARTING'] } }, select: { projectId: true } });
          const freeSlots = GLOBAL_RUN_LIMIT - inFlight.length;
          if (freeSlots <= 0) return [];
          const queued = await tx.campusRun.findMany({ where: { status: 'QUEUED' }, orderBy: { createdAt: 'asc' }, select: { id: true, projectId: true, createdAt: true } });
          const ids = selectClaimable({ queued, runningProjectIds: new Set(inFlight.map((r) => r.projectId)), freeSlots });
          if (ids.length === 0) return [];
          await tx.campusRun.updateMany({ where: { id: { in: ids }, status: 'QUEUED' }, data: { status: 'STARTING', startedAt: new Date() } });
          return tx.campusRun.findMany({ where: { id: { in: ids }, status: 'STARTING' } });
        });
        for (const run of claimed) {
          const project = await this.prisma.project.findUnique({ where: { id: run.projectId } });
          if (!project) { await this.finalize(run.id, { status: 'FAILED', resultText: 'project missing' }); continue; }
          this.realtime.emitToCampus(SOCKET_EVENTS.runUpdated, run);
          this.launch(run, project.rootPath);
        }
      } while (this.scheduleAgain);
    } finally {
      this.isScheduling = false;
    }
  }
```

Import `selectClaimable` at the top:

```ts
import { selectClaimable } from './scheduler';
```

Fix `listForProject` ordering to `createdAt`:

```ts
      orderBy: { createdAt: 'desc' },
```

- [ ] **Step 5: Run to confirm the queue tests pass**

Run: `pnpm --filter @campus/api exec vitest run test/runs.integration.test.ts -t "queue"` then `-t "cap"` then `-t "permissionMode"`
Expected: PASS for all three.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/runs/runs.service.ts apps/api/src/runs/runs.controller.ts apps/api/test/runs.integration.test.ts
git commit -m "feat(api): run queue + atomic single-entry scheduler + per-run options"
```

---

### Task 7: Process lifecycle — stop, group kill, grace/SIGKILL, timeout, shutdown

**Files:**
- Modify: `apps/api/src/runs/runs.service.ts` (`stop`, `teardown`, timeout timer, `onModuleDestroy`)
- Modify: `apps/api/test/runs.integration.test.ts` (stop + timeout cases)

**Interfaces:**
- Consumes: everything from T5–T6.
- Produces: `stop` cancels QUEUED/STARTING/RUNNING; TIMED_OUT path.

- [ ] **Step 1: Write the failing tests** — add to `apps/api/test/runs.integration.test.ts`:

```ts
it('stops a running run via process-group SIGTERM', async () => {
  process.env.STUB_SLEEP = '30';
  const project = await makeProject('stop');
  const res = await request(app.getHttpServer()).post(`/api/projects/${project.id}/runs`).send({ prompt: 'long' });
  // wait until it is actually RUNNING
  for (let i = 0; i < 50; i++) {
    const r = await prisma.campusRun.findUnique({ where: { id: res.body.id } });
    if (r?.status === 'RUNNING') break;
    await new Promise((r) => setTimeout(r, 100));
  }
  const stopped = await request(app.getHttpServer()).post(`/api/runs/${res.body.id}/stop`).send();
  expect(stopped.status).toBe(201);
  const done = await waitForTerminal(res.body.id, 15000);
  expect(done.status).toBe('STOPPED');
  delete process.env.STUB_SLEEP;
}, 20000);

it('cancels a QUEUED run without a child', async () => {
  process.env.STUB_SLEEP = '5';
  const project = await makeProject('cancelq');
  await request(app.getHttpServer()).post(`/api/projects/${project.id}/runs`).send({ prompt: 'holder' });
  const q = await request(app.getHttpServer()).post(`/api/projects/${project.id}/runs`).send({ prompt: 'waiting' });
  const stopped = await request(app.getHttpServer()).post(`/api/runs/${q.body.id}/stop`).send();
  expect(stopped.status).toBe(201);
  const row = await prisma.campusRun.findUnique({ where: { id: q.body.id } });
  expect(row!.status).toBe('STOPPED');
  delete process.env.STUB_SLEEP;
}, 20000);

it('times out a run and marks it TIMED_OUT', async () => {
  process.env.STUB_SLEEP = '10';
  process.env.RUN_TIMEOUT_MS = '500';
  // fresh app so the new timeout is read
  const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app2 = mod.createNestApplication();
  await app2.init();
  try {
    const project = await makeProject('timeout');
    const res = await request(app2.getHttpServer()).post(`/api/projects/${project.id}/runs`).send({ prompt: 'slow' });
    const done = await waitForTerminal(res.body.id, 15000);
    expect(done.status).toBe('TIMED_OUT');
  } finally {
    await app2.close();
    delete process.env.STUB_SLEEP;
    delete process.env.RUN_TIMEOUT_MS;
  }
}, 20000);
```

Note: `RUN_TIMEOUT_MS` is read at module load in Task 5. For the timeout test to pick up the override, change the constant to be read lazily. In Task 5's constants, this is already `Number(process.env.RUN_TIMEOUT_MS ?? ...)` evaluated once at import. Change it to a getter in Step 3 below.

- [ ] **Step 2: Run to confirm they fail**

Run: `pnpm --filter @campus/api exec vitest run test/runs.integration.test.ts -t "stops a running"`
Expected: FAIL — `stop` still resolves the row to STOPPED but never STARTING/RUNNING-guards, and no group kill / TIMED_OUT path exists.

- [ ] **Step 3: Make the timeout lazily read and add the timer to `launch`** — in `runs.service.ts`, replace the `RUN_TIMEOUT_MS` const usage with a helper and start a timer in `launch` after `this.children.set(...)`:

```ts
const KILL_GRACE_MS = Number(process.env.RUN_KILL_GRACE_MS ?? 5000);
function runTimeoutMs() { return Number(process.env.RUN_TIMEOUT_MS ?? 30 * 60 * 1000); }
```

Track timers and start one in `launch`:

```ts
  private readonly timers = new Map<string, NodeJS.Timeout>();
```

```ts
    // inside launch(), after this.children.set(run.id, child):
    this.timers.set(run.id, setTimeout(() => {
      this.timedOut.add(run.id);
      void this.teardown(run.id, 'STOPPING');
    }, runTimeoutMs()));
```

Clear it in `finalize` (top of the method):

```ts
    const timer = this.timers.get(runId);
    if (timer) { clearTimeout(timer); this.timers.delete(runId); }
```

- [ ] **Step 4: Add `teardown` and rewrite `stop`**:

```ts
  /** Group SIGTERM -> grace -> group SIGKILL. The child's close handler runs finalize. */
  private async teardown(runId: string, nextStatus: 'STOPPING'): Promise<void> {
    await this.prisma.campusRun.updateMany({ where: { id: runId, status: { in: ['STARTING', 'RUNNING'] } }, data: { status: nextStatus } });
    const run = await this.prisma.campusRun.findUnique({ where: { id: runId } });
    if (run) this.realtime.emitToCampus(SOCKET_EVENTS.runUpdated, run);
    const child = this.children.get(runId);
    if (!child?.pid) return;
    try { process.kill(-child.pid, 'SIGTERM'); } catch { /* already gone */ }
    setTimeout(() => {
      if (this.children.has(runId) && child.pid) {
        try { process.kill(-child.pid, 'SIGKILL'); } catch { /* gone */ }
      }
    }, KILL_GRACE_MS);
  }

  async stop(runId: string): Promise<CampusRun> {
    this.assertLoopback();
    const run = await this.prisma.campusRun.findUnique({ where: { id: runId } });
    if (!run) throw new NotFoundException(`Run ${runId} not found`);
    if (!['QUEUED', 'STARTING', 'RUNNING'].includes(run.status)) throw new ConflictException('run is not stoppable');

    if (run.status === 'QUEUED') {
      return this.finalizeStopped(runId);
    }
    await this.teardown(runId, 'STOPPING');
    // if the child is already gone (orphaned after restart), resolve the row directly
    if (!this.children.get(runId)?.pid) return this.finalizeStopped(runId);
    return this.prisma.campusRun.findUnique({ where: { id: runId } }) as Promise<CampusRun>;
  }

  private async finalizeStopped(runId: string): Promise<CampusRun> {
    await this.finalize(runId, { status: 'STOPPED', resultText: 'stopped' });
    return this.prisma.campusRun.findUnique({ where: { id: runId } }) as Promise<CampusRun>;
  }
```

The child `close` handler from Task 5 already routes STOPPING→STOPPED because `finalize`'s guard includes `STOPPING` and `timedOut` sets TIMED_OUT. Confirm the `close` handler computes `status` as: `timedOut ? 'TIMED_OUT' : outcome?.status ?? (code === 0 ? 'COMPLETED' : 'FAILED')`. A SIGTERM'd child exits non-zero with no result event → `FAILED`. To make a stopped run read `STOPPED`, adjust the close handler to honor an in-progress stop:

```ts
    child.on('close', (code) => {
      const timedOut = this.timedOut.delete(run.id);
      void (async () => {
        const current = await this.prisma.campusRun.findUnique({ where: { id: run.id } });
        const status = timedOut ? 'TIMED_OUT'
          : current?.status === 'STOPPING' ? 'STOPPED'
          : outcome?.status ?? (code === 0 ? 'COMPLETED' : 'FAILED');
        const resultText = outcome?.resultText ?? (status === 'COMPLETED' ? '' : status === 'STOPPED' ? 'stopped' : this.redactStderr(stderr) || `exit ${code}`);
        await this.finalize(run.id, { ...(outcome ?? {}), status, resultText, exitCode: code ?? null });
      })();
    });
```

Replace the Task 5 `close` handler with this version.

- [ ] **Step 5: Add shutdown cleanup** — add `OnModuleDestroy` to the class implements and the method:

```ts
// class declaration:
export class RunsService implements OnModuleInit, OnModuleDestroy {
```

```ts
  onModuleDestroy() {
    for (const child of this.children.values()) {
      if (child.pid) { try { process.kill(-child.pid, 'SIGTERM'); } catch { /* gone */ } }
    }
  }
```

Import `OnModuleDestroy` from `@nestjs/common`.

- [ ] **Step 6: Run to confirm the lifecycle tests pass**

Run: `pnpm --filter @campus/api exec vitest run test/runs.integration.test.ts -t "stops a running"` then `-t "cancels a QUEUED"` then `-t "times out"`
Expected: PASS for all three.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/runs/runs.service.ts apps/api/test/runs.integration.test.ts
git commit -m "feat(api): run process-group teardown, stop, timeout (TIMED_OUT), shutdown cleanup"
```

---

### Task 8: Continue (conversation threading)

**Files:**
- Modify: `apps/api/src/runs/runs.service.ts` (`continue`)
- Modify: `apps/api/src/runs/runs.controller.ts` (route)
- Modify: `apps/api/test/runs.integration.test.ts` (continue case)

**Interfaces:**
- Consumes: T5–T7.
- Produces: `POST /api/runs/:id/continue` → child run with `parentRunId`, shared `conversationId`, `--resume`.

- [ ] **Step 1: Write the failing test** — the stub must record its argv so the test can assert `--resume`. Extend the stub to dump argv, then assert. Add near the top of the file a shared marker dir, and update `STUB` to append its args to a file:

Add to `STUB` (after `PROMPT=$(cat)`):

```
echo "$@" >> "${STUB_ARGS_FILE:-/dev/null}"
```

Test:

```ts
it('continues a conversation with --resume and inherited options', async () => {
  const argsFile = path.join(await mkdtemp(path.join(tmpdir(), 'campus-args-')), 'args.log');
  process.env.STUB_ARGS_FILE = argsFile;
  const project = await makeProject('continue');
  const first = await request(app.getHttpServer()).post(`/api/projects/${project.id}/runs`).send({ prompt: 'start', model: 'opus', permissionMode: 'plan' });
  const firstDone = await waitForTerminal(first.body.id);
  expect(firstDone.sessionId).toBe('sess-stub');

  const cont = await request(app.getHttpServer()).post(`/api/runs/${first.body.id}/continue`).send({ prompt: 'and then?' });
  expect(cont.status).toBe(201);
  const contDone = await waitForTerminal(cont.body.id);
  expect(contDone.parentRunId).toBe(first.body.id);
  expect(contDone.conversationId).toBe(firstDone.conversationId);
  expect(contDone.model).toBe('opus');          // inherited
  expect(contDone.permissionMode).toBe('plan');  // inherited

  const argsLog = (await import('node:fs')).readFileSync(argsFile, 'utf8');
  expect(argsLog).toContain('--resume sess-stub');
  delete process.env.STUB_ARGS_FILE;
});
```

- [ ] **Step 2: Run to confirm it fails**

Run: `pnpm --filter @campus/api exec vitest run test/runs.integration.test.ts -t "continues a conversation"`
Expected: FAIL — no `/continue` route (404).

- [ ] **Step 3: Add the service method** in `runs.service.ts`:

```ts
  async continue(parentId: string, prompt: string, overrides: { permissionMode?: string; model?: string } = {}): Promise<CampusRun> {
    this.assertLoopback();
    const parent = await this.prisma.campusRun.findUnique({ where: { id: parentId } });
    if (!parent) throw new NotFoundException(`Run ${parentId} not found`);
    if (!parent.sessionId) throw new ConflictException('parent run has no session to resume');
    const queued = await this.prisma.campusRun.count({ where: { projectId: parent.projectId, status: 'QUEUED' } });
    if (queued >= QUEUE_LIMIT) throw new HttpException('queue is full for this project', 429);

    const run = await this.prisma.campusRun.create({
      data: {
        projectId: parent.projectId,
        prompt,
        status: 'QUEUED',
        parentRunId: parent.id,
        conversationId: parent.conversationId ?? parent.id,
        sessionId: parent.sessionId, // copied so launch() emits --resume
        permissionMode: overrides.permissionMode ?? parent.permissionMode,
        model: overrides.model ?? parent.model,
      },
    });
    this.realtime.emitToCampus(SOCKET_EVENTS.runStarted, run);
    await this.schedule();
    return this.prisma.campusRun.findUnique({ where: { id: run.id } }) as Promise<CampusRun>;
  }
```

Note the `launch` guard from Task 5 is `if (run.parentRunId && run.sessionId) args.push('--resume', run.sessionId)` — a continue row carries both, a fresh row carries neither (its `sessionId` is set later from init), so only continues resume. Confirm that line matches.

- [ ] **Step 4: Add the route** in `runs.controller.ts`:

```ts
const continueRunSchema = z.object({
  prompt: z.string().trim().min(1).max(10_000),
  permissionMode: z.enum(['default', 'acceptEdits', 'plan']).optional(),
  model: z.enum(['sonnet', 'opus', 'haiku']).optional(),
});
```

```ts
  @Post('api/runs/:runId/continue')
  continueRun(@Param('runId') runId: string, @Body() body: unknown) {
    const parsed = continueRunSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    const { prompt, ...overrides } = parsed.data;
    return this.runs.continue(runId, prompt, overrides);
  }
```

- [ ] **Step 5: Run to confirm it passes**

Run: `pnpm --filter @campus/api exec vitest run test/runs.integration.test.ts -t "continues a conversation"`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/runs/runs.service.ts apps/api/src/runs/runs.controller.ts apps/api/test/runs.integration.test.ts
git commit -m "feat(api): continue a run -- threaded conversation via --resume with inherited options"
```

---

### Task 9: Read endpoints — cursor events, thread, agent events

**Files:**
- Modify: `apps/api/src/runs/runs.service.ts` (`listEvents`, `listThread`)
- Modify: `apps/api/src/runs/runs.controller.ts` (routes)
- Modify: `apps/api/src/agents/agents.service.ts` (`listEvents`)
- Modify: `apps/api/src/agents/agents.controller.ts` (route)
- Modify: `apps/api/test/runs.integration.test.ts` (pagination + thread cases)

**Interfaces:**
- Consumes: T5–T8.
- Produces: `GET /api/runs/:id/events?after=&take=`, `GET /api/runs/:id/thread`, `GET /api/agents/:id/events?take=`.

- [ ] **Step 1: Write the failing tests** — add to `apps/api/test/runs.integration.test.ts`:

```ts
it('paginates run events by seq cursor', async () => {
  const project = await makeProject('events');
  const res = await request(app.getHttpServer()).post(`/api/projects/${project.id}/runs`).send({ prompt: 'events please' });
  const run = await waitForTerminal(res.body.id);
  const all = await request(app.getHttpServer()).get(`/api/runs/${run.id}/events`);
  expect(all.status).toBe(200);
  expect(all.body.length).toBeGreaterThanOrEqual(3);
  expect(all.body[0].seq).toBe(0);
  const after0 = await request(app.getHttpServer()).get(`/api/runs/${run.id}/events?after=0`);
  expect(after0.body.every((e: { seq: number }) => e.seq > 0)).toBe(true);
});

it('returns the whole conversation thread in order', async () => {
  const project = await makeProject('thread');
  const first = await request(app.getHttpServer()).post(`/api/projects/${project.id}/runs`).send({ prompt: 'one' });
  await waitForTerminal(first.body.id);
  const cont = await request(app.getHttpServer()).post(`/api/runs/${first.body.id}/continue`).send({ prompt: 'two' });
  await waitForTerminal(cont.body.id);
  const thread = await request(app.getHttpServer()).get(`/api/runs/${first.body.id}/thread`);
  expect(thread.status).toBe(200);
  expect(thread.body.map((r: { prompt: string }) => r.prompt)).toEqual(['one', 'two']);
});
```

- [ ] **Step 2: Run to confirm they fail**

Run: `pnpm --filter @campus/api exec vitest run test/runs.integration.test.ts -t "paginates"`
Expected: FAIL — route 404.

- [ ] **Step 3: Add service reads** in `runs.service.ts`:

```ts
  async listEvents(runId: string, after: number | undefined, take: number) {
    this.assertLoopback();
    return this.prisma.runEvent.findMany({
      where: { runId, ...(after === undefined ? {} : { seq: { gt: after } }) },
      orderBy: { seq: 'asc' },
      take: Math.min(Math.max(take, 1), 1000),
    });
  }

  async listThread(runId: string) {
    this.assertLoopback();
    const run = await this.prisma.campusRun.findUnique({ where: { id: runId } });
    if (!run) throw new NotFoundException(`Run ${runId} not found`);
    const conversationId = run.conversationId ?? run.id;
    return this.prisma.campusRun.findMany({ where: { conversationId }, orderBy: { createdAt: 'asc' } });
  }
```

- [ ] **Step 4: Add run routes** in `runs.controller.ts` (add `Query` to the `@nestjs/common` import):

```ts
  @Get('api/runs/:runId/events')
  events(@Param('runId') runId: string, @Query('after') after?: string, @Query('take') take?: string) {
    return this.runs.listEvents(runId, after === undefined ? undefined : Number(after), take ? Number(take) : 200);
  }

  @Get('api/runs/:runId/thread')
  thread(@Param('runId') runId: string) {
    return this.runs.listThread(runId);
  }
```

- [ ] **Step 5: Add agent events** — in `apps/api/src/agents/agents.service.ts` add:

```ts
  async listEvents(agentId: string, take: number) {
    return this.prisma.claudeEvent.findMany({
      where: { agentId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(take, 1), 500),
    });
  }
```

In `apps/api/src/agents/agents.controller.ts` add (ensure `Get`, `Query` imported):

```ts
  @Get('api/agents/:agentId/events')
  events(@Param('agentId') agentId: string, @Query('take') take?: string) {
    return this.agents.listEvents(agentId, take ? Number(take) : 100);
  }
```

Confirm the `ClaudeEvent` model has an `agentId` field; if it is named differently (e.g. `projectAgentId`), use that name.

- [ ] **Step 6: Run to confirm they pass**

Run: `pnpm --filter @campus/api exec vitest run test/runs.integration.test.ts -t "paginates"` then `-t "whole conversation"`
Expected: PASS both.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/runs/runs.service.ts apps/api/src/runs/runs.controller.ts apps/api/src/agents/agents.service.ts apps/api/src/agents/agents.controller.ts apps/api/test/runs.integration.test.ts
git commit -m "feat(api): cursor-paginated run events, conversation thread, agent event history"
```

---

### Task 10: Full-suite verification

**Files:** none (verification only)

- [ ] **Step 1: Regenerate + typecheck + lint**

Run: `pnpm --filter @campus/api exec prisma generate && pnpm typecheck && pnpm lint`
Expected: no errors.

- [ ] **Step 2: Run the full API integration suite**

Run: `pnpm db:up && pnpm --filter @campus/api exec vitest run test/runs.integration.test.ts`
Expected: all run cases green, including the pre-existing ones (loopback guard, DATABASE_URL not inherited — the stub still echoes `db:[]` empty).

- [ ] **Step 3: Run every workspace's tests**

Run: `pnpm test`
Expected: all workspaces pass (pure unit suites for `run-env`, `stream-parser`, `scheduler` included).

- [ ] **Step 4: Build**

Run: `pnpm build`
Expected: success.

- [ ] **Step 5: Commit any lint/format fixups**

```bash
git add -A
git commit -m "chore(api): runs v2 verification fixups" --allow-empty
```

---

## Self-Review

**Spec coverage (Part A):**
- Status machine (QUEUED/STARTING/RUNNING/STOPPING/COMPLETED/FAILED/STOPPED/TIMED_OUT) — Task 1 (enum) + Tasks 5–8 (transitions). ✓
- Spawn: stdin prompt, args array, stream-json, `--verbose`, process group, session_id from init, seq, redact, clamp, stderr redaction+cap — Tasks 3, 5. ✓ (stderr redaction: apply `redactSensitiveData` to the stderr string before it becomes `resultText`; add in Task 5's close handler — **noted gap, see below**.)
- Scheduler: single entry, atomic claim, project/global concurrency, idempotent finalize — Tasks 4, 5, 6. ✓
- Process lifecycle: group SIGTERM, grace, SIGKILL, shutdown — Task 7. ✓
- Schema: durationMs, normalized tokens, Decimal cost, parent self-relation, unique(runId,seq), scheduler indexes, conversationId — Task 1. ✓
- Events: cursor pagination, dedupe by seq, payload clamp — Tasks 1 (unique), 3 (clamp), 9 (cursor). Reconnect recovery is client-side (Phase 2). ✓
- Continue: sessionId from init, inheritance, thread — Tasks 5, 8, 9. ✓
- Security: env allowlist, prompt not in argv, retention — Task 2, Task 5 (stdin). **Retention sweep is not yet a task — see gap.** ✓/partial

**Gaps found and resolved inline:**
1. **stderr redaction** — resolved in Task 5: a `redactStderr` helper wraps the canonical `redactSensitiveData` (no second regex set) and both close handlers (Task 5 + Task 7) run stderr through it before it becomes `resultText`.
2. **Retention sweep** — deferred: add a `RUN_RETENTION_DAYS` prune to the existing `db:prune` path. Low-risk and independent; **folded into Phase 6 (analytics/polish)** rather than blocking the backend. Documented here so it is not lost.

**Placeholder scan:** the only intentional stub is Task 5's temporary `schedule()` no-op, explicitly replaced in Task 6. No TBD/TODO left.

**Type consistency:** `RunOutcome` (T3) is consumed by `finalize` (T5) as `Partial<RunOutcome> & {...}`; `selectClaimable`/`ClaimInput` (T4) match `schedule`'s call (T6); socket names `runEvent`/`runUpdated` (T5 Step 1) match every emit. `launch`, `teardown`, `finalize`, `finalizeStopped`, `schedule`, `start`, `continue`, `stop`, `listEvents`, `listThread` names are used consistently across tasks.

## Notes for the implementer

- The stub `CLAUDE_BIN` is a `/bin/sh` script. Keep its JSON on single lines — the service splits stdout by line.
- If the installed CLI rejects a stdin prompt in `--print --output-format stream-json` mode, fall back to passing the prompt as the trailing positional arg (still an args-array element, never a shell string) and update the stub to read `$1`/`$@` instead of `cat`. The security property (no shell) holds either way; only the process-list exposure differs (documented in the spec risks).
- Run tests serially if the global run limit causes cross-test interference: `vitest run` in this repo already runs a file's tests in order; the limit is global, so avoid leaving sleeping stubs running across cases (each case deletes `STUB_SLEEP`).
