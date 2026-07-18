# Campus Run Commands Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Type a task into a room's inspector panel and a headless `claude -p` run starts in that project's directory; its hooks animate the agent, its final answer is saved and readable, and it can be stopped.

**Architecture:** New `CampusRun` Prisma model + NestJS `RunsModule` (spawn via `execFile` args-array, child handles in an in-memory Map, loopback-only guard). Two new socket events feed a `runs` slice in the zustand store; a self-contained `RunPanel` component mounts in the existing InspectorDrawer. No new event path — the spawned run reports through the ordinary hook pipeline.

**Tech Stack:** NestJS, Prisma/Postgres, zod, Socket.IO, React/zustand, vitest (integration tests use a stub shell script as `CLAUDE_BIN`).

## Global Constraints

- Spec: `docs/superpowers/specs/2026-07-18-campus-run-commands-design.md` — exact statuses `RUNNING|COMPLETED|FAILED|STOPPED`, guards in order (loopback 403 → 404 → per-project 409 → global-3 429), prompt zod bounds 1–10,000 trimmed, spawn args `['-p', prompt, '--output-format', 'text']`, `timeout: 30 * 60 * 1000`, `maxBuffer: 10 * 1024 * 1024`, boot cleanup marks stale RUNNING → FAILED with `resultText = 'API restarted'`.
- Prompt is data end to end: JSON → zod → argv element. Never a shell string (CLAUDE.md security rule).
- Runs endpoint hard-refuses on non-loopback binds; the guard shares the exact host-resolution code `main.ts` uses.
- No hook-payload content is ever executed — this launches Claude with a UI-typed prompt only (CLAUDE.md prohibition stays intact).
- Integration tests: real Postgres `campus_test` schema (`pnpm db:up` prerequisite), stub `CLAUDE_BIN`, never the real binary.
- Kiosk untouched (inspector already hidden there).
- Gates before done: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.

---

### Task 1: contracts events + CampusRun schema

**Files:**
- Modify: `packages/contracts/src/socket.ts` (SOCKET_EVENTS)
- Modify: `apps/api/prisma/schema.prisma`
- Migration: `pnpm --filter @campus/api exec prisma migrate dev --name campus_run`

**Interfaces:**
- Produces: `SOCKET_EVENTS.runStarted = 'run:started'`, `SOCKET_EVENTS.runFinished = 'run:finished'`; Prisma model `CampusRun` + enum `RunStatus` + `Project.runs` relation. Task 2 imports the model via `@prisma/client`; Task 3 imports the two event names.

- [ ] **Step 1: Add socket events**

In `packages/contracts/src/socket.ts`, add to `SOCKET_EVENTS` after `eventReceived`:

```ts
  runStarted: 'run:started',
  runFinished: 'run:finished',
```

- [ ] **Step 2: Add the Prisma model**

In `apps/api/prisma/schema.prisma`, add `runs CampusRun[]` to the `Project` model's relation list (after `snapshots ActivitySnapshot[]`), and append at the end of the file:

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

- [ ] **Step 3: Create the migration + regenerate client**

Run: `pnpm --filter @campus/api exec prisma migrate dev --name campus_run`
Expected: new folder under `apps/api/prisma/migrations/*_campus_run/` and `Generated Prisma Client`. (This applies to the dev DB in `.env`; the `campus_test`/`campus_smoke` schemas pick it up from their own `migrate deploy` in test setup.)

- [ ] **Step 4: Verify compile**

Run: `pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/contracts/src/socket.ts apps/api/prisma
git commit -m "feat(api): CampusRun model + run socket events"
```

---

### Task 2: RunsModule — spawn, guards, stop, boot cleanup (TDD)

**Files:**
- Create: `apps/api/src/config/api-host.ts`
- Modify: `apps/api/src/main.ts:26-28`
- Create: `apps/api/src/runs/runs.service.ts`
- Create: `apps/api/src/runs/runs.controller.ts`
- Create: `apps/api/src/runs/runs.module.ts`
- Modify: `apps/api/src/app.module.ts` (register RunsModule)
- Test: `apps/api/test/runs.integration.test.ts`
- Test: `apps/api/src/config/api-host.test.ts`

**Interfaces:**
- Consumes: `CampusRun`/`RunStatus` from `@prisma/client`; `SOCKET_EVENTS.runStarted/runFinished`; `RealtimeGateway.emitToCampus`; `PrismaService`.
- Produces (Task 3/4 rely on these):
  - `POST /api/projects/:projectId/runs` body `{ prompt: string }` → 201 with the run row; 403/404/409/429 per spec.
  - `GET /api/projects/:projectId/runs` → newest-first array, max 20.
  - `POST /api/runs/:runId/stop` → run row (STOPPED); 404 unknown, 409 not RUNNING.
  - `resolveApiHost(): string` and `isLoopbackHost(host: string): boolean` in `api-host.ts`.

- [ ] **Step 1: Write the failing unit test for the host helpers**

Create `apps/api/src/config/api-host.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { isLoopbackHost } from './api-host';

describe('isLoopbackHost', () => {
  it('accepts loopback binds', () => {
    expect(isLoopbackHost('127.0.0.1')).toBe(true);
    expect(isLoopbackHost('localhost')).toBe(true);
    expect(isLoopbackHost('::1')).toBe(true);
  });

  it('rejects exposed binds', () => {
    expect(isLoopbackHost('0.0.0.0')).toBe(false);
    expect(isLoopbackHost('::')).toBe(false);
    expect(isLoopbackHost('192.168.1.20')).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to verify failure**

Run: `pnpm --filter @campus/api exec vitest run src/config/api-host.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement api-host.ts and use it in main.ts**

Create `apps/api/src/config/api-host.ts`:

```ts
/** Single source of truth for the API bind host -- main.ts listens on it and the runs
 * endpoint refuses to spawn on anything non-loopback. Sharing the resolution prevents
 * the guard drifting from the real bind. */
export function resolveApiHost(): string {
  return process.env.API_HOST ?? '127.0.0.1';
}

export function isLoopbackHost(host: string): boolean {
  return host === '127.0.0.1' || host === 'localhost' || host === '::1';
}
```

In `apps/api/src/main.ts` replace the inline host lines:

```ts
import { resolveApiHost } from './config/api-host';
```

```ts
  const port = Number(process.env.API_PORT ?? 4000);
  // Local default stays 127.0.0.1 (security); containers set API_HOST=0.0.0.0 so the
  // published port is reachable from the host.
  const host = resolveApiHost();
  await app.listen(port, host);
```

Run: `pnpm --filter @campus/api exec vitest run src/config/api-host.test.ts`
Expected: PASS.

- [ ] **Step 4: Write the failing integration tests**

Create `apps/api/test/runs.integration.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { chmod, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { PrismaClient } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { RunsService } from '../src/runs/runs.service';

/** Stub claude binary: prints a marker + the prompt; sleeps when STUB_SLEEP is set;
 * exits non-zero when the prompt contains "fail-me". */
const STUB = `#!/bin/sh
if echo "$2" | grep -q fail-me; then echo "boom" >&2; exit 3; fi
if [ -n "$STUB_SLEEP" ]; then sleep "$STUB_SLEEP"; fi
echo "stub-result: $2"
`;

describe('runs (integration)', () => {
  let app: INestApplication;
  const prisma = new PrismaClient();
  const cleanupDirs: string[] = [];

  async function makeProject(name: string) {
    const dir = await mkdtemp(path.join(tmpdir(), 'campus-run-'));
    cleanupDirs.push(dir);
    return prisma.project.create({
      data: { projectKey: `path:run-test-${name}-${Date.now()}`, name, rootPath: dir },
    });
  }

  beforeAll(async () => {
    const stubDir = await mkdtemp(path.join(tmpdir(), 'campus-stub-'));
    cleanupDirs.push(stubDir);
    const stubPath = path.join(stubDir, 'claude-stub.sh');
    await writeFile(stubPath, STUB);
    await chmod(stubPath, 0o755);
    process.env.CLAUDE_BIN = stubPath;
    delete process.env.STUB_SLEEP;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
    delete process.env.CLAUDE_BIN;
    delete process.env.STUB_SLEEP;
    await Promise.all(cleanupDirs.map((d) => rm(d, { recursive: true, force: true })));
  });

  async function waitForTerminal(runId: string, timeoutMs = 10000) {
    const start = Date.now();
    for (;;) {
      const run = await prisma.campusRun.findUnique({ where: { id: runId } });
      if (run && run.status !== 'RUNNING') return run;
      if (Date.now() - start > timeoutMs) throw new Error(`run ${runId} still RUNNING`);
      await new Promise((r) => setTimeout(r, 150));
    }
  }

  it('spawns, captures the result, and completes', async () => {
    const project = await makeProject('ok');
    const res = await request(app.getHttpServer())
      .post(`/api/projects/${project.id}/runs`)
      .send({ prompt: 'say hello' })
      .expect(201);
    expect(res.body.status).toBe('RUNNING');

    const done = await waitForTerminal(res.body.id);
    expect(done.status).toBe('COMPLETED');
    expect(done.resultText).toContain('stub-result: say hello');
    expect(done.exitCode).toBe(0);
  });

  it('marks non-zero exits FAILED with the stderr tail', async () => {
    const project = await makeProject('fail');
    const res = await request(app.getHttpServer())
      .post(`/api/projects/${project.id}/runs`)
      .send({ prompt: 'please fail-me now' })
      .expect(201);
    const done = await waitForTerminal(res.body.id);
    expect(done.status).toBe('FAILED');
    expect(done.resultText).toContain('boom');
    expect(done.exitCode).toBe(3);
  });

  it('rejects a second run for the same project with 409, and stop() ends the first', async () => {
    process.env.STUB_SLEEP = '30';
    try {
      const project = await makeProject('busy');
      const first = await request(app.getHttpServer())
        .post(`/api/projects/${project.id}/runs`)
        .send({ prompt: 'long task' })
        .expect(201);

      await request(app.getHttpServer())
        .post(`/api/projects/${project.id}/runs`)
        .send({ prompt: 'second task' })
        .expect(409);

      const stopped = await request(app.getHttpServer())
        .post(`/api/runs/${first.body.id}/stop`)
        .expect(201);
      expect(stopped.body.status).toBe('STOPPED');
    } finally {
      delete process.env.STUB_SLEEP;
    }
  });

  it('enforces the global limit of 3 concurrent runs with 429', async () => {
    process.env.STUB_SLEEP = '30';
    const started: string[] = [];
    try {
      for (const name of ['g1', 'g2', 'g3']) {
        const project = await makeProject(name);
        const res = await request(app.getHttpServer())
          .post(`/api/projects/${project.id}/runs`)
          .send({ prompt: 'busy' })
          .expect(201);
        started.push(res.body.id);
      }
      const fourth = await makeProject('g4');
      await request(app.getHttpServer())
        .post(`/api/projects/${fourth.id}/runs`)
        .send({ prompt: 'one too many' })
        .expect(429);
    } finally {
      for (const id of started) {
        await request(app.getHttpServer()).post(`/api/runs/${id}/stop`);
      }
      delete process.env.STUB_SLEEP;
    }
  });

  it('rejects blank and oversized prompts', async () => {
    const project = await makeProject('bad-input');
    await request(app.getHttpServer())
      .post(`/api/projects/${project.id}/runs`)
      .send({ prompt: '   ' })
      .expect(400);
    await request(app.getHttpServer())
      .post(`/api/projects/${project.id}/runs`)
      .send({ prompt: 'x'.repeat(10_001) })
      .expect(400);
  });

  it('marks stale RUNNING rows FAILED on boot', async () => {
    const project = await makeProject('stale');
    const stale = await prisma.campusRun.create({
      data: { projectId: project.id, prompt: 'orphaned', status: 'RUNNING' },
    });
    await app.get(RunsService).onModuleInit();
    const row = await prisma.campusRun.findUnique({ where: { id: stale.id } });
    expect(row?.status).toBe('FAILED');
    expect(row?.resultText).toBe('API restarted');
  });

  it('lists a project runs newest first', async () => {
    const project = await makeProject('list');
    for (const prompt of ['one', 'two']) {
      const res = await request(app.getHttpServer())
        .post(`/api/projects/${project.id}/runs`)
        .send({ prompt })
        .expect(201);
      await waitForTerminal(res.body.id);
    }
    const list = await request(app.getHttpServer())
      .get(`/api/projects/${project.id}/runs`)
      .expect(200);
    expect(list.body).toHaveLength(2);
    expect(list.body[0].prompt).toBe('two');
  });
});
```

- [ ] **Step 5: Run to verify failure**

Run: `pnpm --filter @campus/api exec vitest run test/runs.integration.test.ts`
Expected: FAIL — `../src/runs/runs.service` not found.

- [ ] **Step 6: Implement the service**

Create `apps/api/src/runs/runs.service.ts`:

```ts
import { ConflictException, ForbiddenException, HttpException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { execFile, type ChildProcess } from 'node:child_process';
import type { CampusRun } from '@prisma/client';
import { SOCKET_EVENTS } from '@campus/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { isLoopbackHost, resolveApiHost } from '../config/api-host';

const RUN_TIMEOUT_MS = 30 * 60 * 1000;
const MAX_BUFFER = 10 * 1024 * 1024;
const GLOBAL_RUN_LIMIT = 3;

@Injectable()
export class RunsService implements OnModuleInit {
  /** Live child handles; entries vanish on API restart (stop() then only flips the row). */
  private readonly children = new Map<string, ChildProcess>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
  ) {}

  /** Runs interrupted by an API restart can never finish -- mark them honestly. */
  async onModuleInit() {
    await this.prisma.campusRun.updateMany({
      where: { status: 'RUNNING' },
      data: { status: 'FAILED', resultText: 'API restarted', finishedAt: new Date() },
    });
  }

  async start(projectId: string, prompt: string): Promise<CampusRun> {
    if (!isLoopbackHost(resolveApiHost())) {
      throw new ForbiddenException('runs are disabled on non-loopback binds');
    }
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);

    const busy = await this.prisma.campusRun.count({ where: { projectId, status: 'RUNNING' } });
    if (busy > 0) throw new ConflictException('a run is already active for this project');

    const globalBusy = await this.prisma.campusRun.count({ where: { status: 'RUNNING' } });
    if (globalBusy >= GLOBAL_RUN_LIMIT) throw new HttpException('run limit reached', 429);

    const run = await this.prisma.campusRun.create({ data: { projectId, prompt } });
    this.spawn(run, project.rootPath);
    this.realtime.emitToCampus(SOCKET_EVENTS.runStarted, run);
    return run;
  }

  /** execFile with an args array: the prompt is data, never shell input. */
  private spawn(run: CampusRun, cwd: string) {
    const child = execFile(
      process.env.CLAUDE_BIN ?? 'claude',
      ['-p', run.prompt, '--output-format', 'text'],
      { cwd, timeout: RUN_TIMEOUT_MS, maxBuffer: MAX_BUFFER },
      (error, stdout, stderr) => {
        void this.finalize(run.id, error, stdout, stderr);
      },
    );
    this.children.set(run.id, child);
  }

  private async finalize(runId: string, error: unknown, stdout: string, stderr: string) {
    this.children.delete(runId);
    const current = await this.prisma.campusRun.findUnique({ where: { id: runId } });
    if (!current || current.status !== 'RUNNING') return; // stop() already resolved it

    const failure = error as { code?: number | string; killed?: boolean } | null;
    const timedOut = failure?.killed === true;
    const exitCode = typeof failure?.code === 'number' ? failure.code : failure ? null : 0;
    const status = failure ? 'FAILED' : 'COMPLETED';
    const resultText = failure
      ? timedOut
        ? 'timed out after 30m'
        : (stderr.trim().slice(-2000) || String((failure as Error).message ?? 'run failed'))
      : stdout.trim();

    const run = await this.prisma.campusRun.update({
      where: { id: runId },
      data: { status, resultText, exitCode, finishedAt: new Date() },
    });
    this.realtime.emitToCampus(SOCKET_EVENTS.runFinished, run);
  }

  async stop(runId: string): Promise<CampusRun> {
    const run = await this.prisma.campusRun.findUnique({ where: { id: runId } });
    if (!run) throw new NotFoundException(`Run ${runId} not found`);
    if (run.status !== 'RUNNING') throw new ConflictException('run is not running');

    const child = this.children.get(runId);
    if (child) child.kill('SIGTERM');
    this.children.delete(runId);
    // If the handle is gone (API restarted since spawn) the process is orphaned; the row
    // is still resolved so the UI never shows a phantom RUNNING run (documented caveat).
    const stopped = await this.prisma.campusRun.update({
      where: { id: runId },
      data: { status: 'STOPPED', finishedAt: new Date() },
    });
    this.realtime.emitToCampus(SOCKET_EVENTS.runFinished, stopped);
    return stopped;
  }

  async listForProject(projectId: string): Promise<CampusRun[]> {
    return this.prisma.campusRun.findMany({
      where: { projectId },
      orderBy: { startedAt: 'desc' },
      take: 20,
    });
  }
}
```

- [ ] **Step 7: Implement controller + module, register**

Create `apps/api/src/runs/runs.controller.ts`:

```ts
import { BadRequestException, Body, Controller, Get, Param, Post } from '@nestjs/common';
import { z } from 'zod';
import { RunsService } from './runs.service';

const startRunSchema = z.object({ prompt: z.string().trim().min(1).max(10_000) });

@Controller()
export class RunsController {
  constructor(private readonly runs: RunsService) {}

  @Post('api/projects/:projectId/runs')
  start(@Param('projectId') projectId: string, @Body() body: unknown) {
    const parsed = startRunSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    return this.runs.start(projectId, parsed.data.prompt);
  }

  @Get('api/projects/:projectId/runs')
  list(@Param('projectId') projectId: string) {
    return this.runs.listForProject(projectId);
  }

  @Post('api/runs/:runId/stop')
  stop(@Param('runId') runId: string) {
    return this.runs.stop(runId);
  }
}
```

Create `apps/api/src/runs/runs.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { RealtimeModule } from '../realtime/realtime.module';
import { RunsController } from './runs.controller';
import { RunsService } from './runs.service';

@Module({
  imports: [PrismaModule, RealtimeModule],
  controllers: [RunsController],
  providers: [RunsService],
})
export class RunsModule {}
```

`PrismaModule` and `RealtimeModule` exist at `apps/api/src/prisma/prisma.module.ts` and `apps/api/src/realtime/realtime.module.ts` (verified). Register `RunsModule` in `apps/api/src/app.module.ts`'s imports array (add `import { RunsModule } from './runs/runs.module';` and append `RunsModule,` after `RealtimeModule`).

- [ ] **Step 8: Run tests to verify green**

Run: `pnpm --filter @campus/api exec vitest run test/runs.integration.test.ts src/config/api-host.test.ts`
Expected: PASS (sleeping-stub tests take a few seconds).
Then the whole API suite: `pnpm --filter @campus/api exec vitest run`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add apps/api/src/runs apps/api/src/config apps/api/src/main.ts apps/api/src/app.module.ts apps/api/test/runs.integration.test.ts
git commit -m "feat(api): RunsModule spawns headless claude runs with guards and stop"
```

---

### Task 3: web plumbing — types, socket, store slice (TDD)

**Files:**
- Modify: `apps/web/lib/types.ts`
- Modify: `apps/web/lib/socket.ts`
- Modify: `apps/web/stores/campusStore.ts`
- Modify: `apps/web/hooks/useCampusSocket.ts`
- Test: `apps/web/stores/campusStore.test.ts` (extend)

**Interfaces:**
- Consumes: Task 1's event names; Task 2's endpoints.
- Produces (Task 4 relies on): `RunRow` type; store `runs: Record<string, RunRow[]>` with actions `setProjectRuns(projectId, runs)` and `upsertRun(run)`; lib helpers `fetchProjectRuns(projectId): Promise<RunRow[]>`, `startRun(projectId, prompt): Promise<void>` (throws Error with server message on failure), `stopRun(runId): Promise<void>`.

- [ ] **Step 1: Add the RunRow type**

In `apps/web/lib/types.ts` add:

```ts
export interface RunRow {
  id: string;
  projectId: string;
  prompt: string;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED' | 'STOPPED';
  resultText: string | null;
  exitCode: number | null;
  startedAt: string;
  finishedAt: string | null;
}
```

- [ ] **Step 2: Write the failing store tests**

Add to `apps/web/stores/campusStore.test.ts` (match the file's existing setup/reset pattern):

```ts
describe('runs slice', () => {
  it('setProjectRuns replaces a project run list', () => {
    const run = { id: 'r1', projectId: 'p1', prompt: 'x', status: 'RUNNING', resultText: null, exitCode: null, startedAt: 't', finishedAt: null } as const;
    useCampusStore.getState().setProjectRuns('p1', [run]);
    expect(useCampusStore.getState().runs.p1).toHaveLength(1);
  });

  it('upsertRun prepends new runs and replaces existing ones in place', () => {
    const a = { id: 'a', projectId: 'p1', prompt: '1', status: 'RUNNING', resultText: null, exitCode: null, startedAt: 't1', finishedAt: null };
    useCampusStore.getState().setProjectRuns('p1', [a as never]);
    useCampusStore.getState().upsertRun({ ...a, status: 'COMPLETED', resultText: 'done' } as never);
    expect(useCampusStore.getState().runs.p1![0]!.status).toBe('COMPLETED');
    useCampusStore.getState().upsertRun({ ...a, id: 'b', prompt: '2' } as never);
    expect(useCampusStore.getState().runs.p1![0]!.id).toBe('b');
    expect(useCampusStore.getState().runs.p1).toHaveLength(2);
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `pnpm --filter @campus/web exec vitest run stores/campusStore.test.ts`
Expected: FAIL — `setProjectRuns` not a function.

- [ ] **Step 4: Implement store slice**

In `apps/web/stores/campusStore.ts`: import `RunRow` from `../lib/types`; add to the state interface

```ts
  runs: Record<string, RunRow[]>;
  setProjectRuns: (projectId: string, runs: RunRow[]) => void;
  upsertRun: (run: RunRow) => void;
```

initialize `runs: {},` next to `approvals`, and add the actions next to `resolveApproval`:

```ts
  setProjectRuns: (projectId, runs) =>
    set((state) => ({ runs: { ...state.runs, [projectId]: runs } })),

  upsertRun: (run) =>
    set((state) => {
      const list = state.runs[run.projectId] ?? [];
      const exists = list.some((r) => r.id === run.id);
      const next = exists ? list.map((r) => (r.id === run.id ? run : r)) : [run, ...list];
      return { runs: { ...state.runs, [run.projectId]: next.slice(0, 20) } };
    }),
```

Also clear a removed project's runs inside the existing `removeProject` action: after computing `projects`, add

```ts
      const { [projectId]: _droppedRuns, ...runs } = state.runs;
```

and include `runs` in its returned object.

Run: `pnpm --filter @campus/web exec vitest run stores/campusStore.test.ts`
Expected: PASS.

- [ ] **Step 5: Socket + REST helpers**

In `apps/web/hooks/useCampusSocket.ts`, following the exact pattern of the approval handlers (lines ~74-75/88-89): add

```ts
    const onRunEvent = (run: RunRow) => useCampusStore.getState().upsertRun(run);
    socket.on(SOCKET_EVENTS.runStarted, onRunEvent);
    socket.on(SOCKET_EVENTS.runFinished, onRunEvent);
```

with matching `socket.off(...)` lines in the cleanup, and the `RunRow` type import.

In `apps/web/lib/socket.ts` append:

```ts
import type { RunRow } from './types';

/** Recent runs for a project (newest first). */
export async function fetchProjectRuns(projectId: string): Promise<RunRow[]> {
  const res = await fetch(apiUrl(`/api/projects/${projectId}/runs`));
  if (!res.ok) return [];
  return (await res.json()) as RunRow[];
}

/** Start a headless run. Throws with the server's message (403/409/429) for inline display. */
export async function startRun(projectId: string, prompt: string): Promise<void> {
  const res = await fetch(apiUrl(`/api/projects/${projectId}/runs`), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ prompt }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? `Run failed to start (${res.status})`);
  }
}

export async function stopRun(runId: string): Promise<void> {
  await fetch(apiUrl(`/api/runs/${runId}/stop`), { method: 'POST' });
}
```

(Move the type import to the top of the file with the existing imports.)

- [ ] **Step 6: Verify + commit**

Run: `pnpm typecheck && pnpm --filter @campus/web exec vitest run`
Expected: PASS.

```bash
git add apps/web/lib/types.ts apps/web/lib/socket.ts apps/web/stores/campusStore.ts apps/web/hooks/useCampusSocket.ts apps/web/stores/campusStore.test.ts
git commit -m "feat(web): runs store slice + socket and REST plumbing"
```

---

### Task 4: RunPanel UI in the inspector

**Files:**
- Create: `apps/web/components/ui/RunPanel.tsx`
- Modify: `apps/web/components/ui/InspectorDrawer.tsx` (~line 334, above `<RemoveProjectControl ...>`)

**Interfaces:**
- Consumes: Task 3's store slice + helpers; the drawer's local `Section` component stays private — RunPanel brings its own heading markup consistent with `Section`'s styles.

- [ ] **Step 1: Implement RunPanel**

Create `apps/web/components/ui/RunPanel.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useCampusStore } from '../../stores/campusStore';
import { fetchProjectRuns, startRun, stopRun } from '../../lib/socket';
import type { RunRow } from '../../lib/types';

const STATUS_STYLE: Record<RunRow['status'], { bg: string; fg: string; label: string }> = {
  RUNNING: { bg: '#4f9d6922', fg: '#4f9d69', label: 'Running' },
  COMPLETED: { bg: '#4bb07a22', fg: '#4bb07a', label: 'Completed' },
  FAILED: { bg: '#d6604f22', fg: '#d6604f', label: 'Failed' },
  STOPPED: { bg: '#9aa3ad22', fg: '#9aa3ad', label: 'Stopped' },
};

function RunEntry({ run }: { run: RunRow }) {
  const [open, setOpen] = useState(false);
  const style = STATUS_STYLE[run.status];
  return (
    <li className="rounded-md border border-slate-200 bg-white p-2">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 flex-1 truncate text-[11px] text-slate-700" title={run.prompt}>
          {run.prompt}
        </span>
        <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ background: style.bg, color: style.fg }}>
          {style.label}
        </span>
        {run.status === 'RUNNING' && (
          <button
            onClick={() => void stopRun(run.id)}
            className="rounded-md border border-rose-200 px-2 py-0.5 text-[10px] text-rose-600 hover:bg-rose-50"
          >
            Stop
          </button>
        )}
      </div>
      {run.resultText && (
        <button onClick={() => setOpen(!open)} className="mt-1 text-[10px] text-slate-400 hover:text-slate-600">
          {open ? 'Hide result' : 'Show result'}
        </button>
      )}
      {open && run.resultText && (
        <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded bg-slate-50 p-2 text-[10px] text-slate-600">
          {run.resultText}
        </pre>
      )}
    </li>
  );
}

/**
 * Send a task to this project: spawns a headless Claude run in the project directory via
 * the API. The run's own hooks animate the room; destructive tools still go through the
 * approval drawer. One active run per project.
 */
export function RunPanel({ projectId }: { projectId: string }) {
  const runs = useCampusStore((s) => s.runs[projectId] ?? []);
  const setProjectRuns = useCampusStore((s) => s.setProjectRuns);
  const [prompt, setPrompt] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const busy = runs.some((r) => r.status === 'RUNNING');

  useEffect(() => {
    let cancelled = false;
    void fetchProjectRuns(projectId).then((list) => {
      if (!cancelled) setProjectRuns(projectId, list);
    });
    return () => {
      cancelled = true;
    };
  }, [projectId, setProjectRuns]);

  const send = async () => {
    const trimmed = prompt.trim();
    if (!trimmed || busy || sending) return;
    setSending(true);
    setError(null);
    try {
      await startRun(projectId, trimmed);
      setPrompt('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-2">
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={2}
        placeholder="Give this team a task…"
        className="w-full resize-none rounded-md border border-slate-300 bg-white p-2 text-xs text-slate-800 placeholder:text-slate-400"
      />
      <button
        onClick={() => void send()}
        disabled={busy || sending || prompt.trim().length === 0}
        className="w-full rounded-md bg-slate-900 py-2 text-xs font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {busy ? 'A run is active for this project' : sending ? 'Starting…' : 'Send task'}
      </button>
      {error && <p className="text-[11px] text-rose-600">{error}</p>}
      {runs.length > 0 && (
        <ul className="space-y-1.5">
          {runs.map((run) => (
            <RunEntry key={run.id} run={run} />
          ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Mount in InspectorDrawer**

In `apps/web/components/ui/InspectorDrawer.tsx`: `import { RunPanel } from './RunPanel';` and directly above the `<RemoveProjectControl project={project} />` line (~334), inside the same container, add:

```tsx
      <Section title="Send task">
        <RunPanel projectId={project.id} />
      </Section>
```

(If `RemoveProjectControl` isn't already wrapped in a `Section`, keep the new `Section` as a sibling immediately before it.)

- [ ] **Step 3: Verify**

Run: `pnpm lint && pnpm typecheck && pnpm --filter @campus/web exec vitest run && pnpm build`
Expected: PASS.

Manual (requires real `claude` on PATH and `pnpm dev` running; stop the docker api/web containers first per CLAUDE.md): open a room's inspector, send "list the files in this project and summarize", watch the agent work, expand the result when it lands, confirm the Stop button on a long prompt.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/ui/RunPanel.tsx apps/web/components/ui/InspectorDrawer.tsx
git commit -m "feat(web): send-task panel with run history in the inspector"
```

---

### Task 5: security docs + full gates

**Files:**
- Modify: `docs/security.md`

- [ ] **Step 1: Document**

Append to `docs/security.md`:

```markdown
## Campus runs (send task to agent)

`POST /api/projects/:id/runs` starts a headless `claude -p "<prompt>"` in the project's
directory. Safeguards:

- The prompt travels as data end to end (JSON -> zod -> argv element); it is never
  interpolated into a shell string.
- The endpoint refuses (403) whenever the API is bound to a non-loopback host. The guard
  shares the exact host resolution `main.ts` uses (`src/config/api-host.ts`), so it cannot
  drift from the real bind. In containers (`API_HOST=0.0.0.0`) runs are always disabled.
- One active run per project, at most 3 campus-wide; 30-minute hard timeout.
- The spawned run's tool use is gated by Claude's own permission system plus the campus
  approval flow -- destructive commands land in the approval drawer and deny by default.
- Caveat: if the API restarts while a run is active, the child process is orphaned; the
  run row is marked FAILED ("API restarted") and Stop on such a row only updates the row.
- This does not weaken the "never execute received commands" rule: nothing from hook
  payloads is executed; only a prompt typed by the local user in the campus UI reaches
  the `claude` binary, as an argument.
```

- [ ] **Step 2: Full gates**

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```
Expected: all green. (`pnpm test:e2e` unaffected by this feature — optional, remember docker api/web must be stopped.)

- [ ] **Step 3: Commit**

```bash
git add docs/security.md
git commit -m "docs: security notes for campus run commands"
```
