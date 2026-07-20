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

/** Stub claude: reads the prompt from stdin (proving it is never on argv), echoes the
 * DATABASE_URL it sees inside a JSON event (proving the child never inherits it), and
 * emits stream-json: an init system event with a session_id, an assistant line, then a
 * result. The session id it reports depends on whether IT was invoked with --resume: a
 * fresh run gets 'sess-root', a resumed one gets 'sess-resumed' -- this is what makes the
 * continue-of-a-continue session capture (Fix 2) provable, since a stub that always echoed
 * back the same session id could never distinguish "captured the parent's stale id" from
 * "captured its own". Sleeps when STUB_SLEEP is set. Fails (is_error result + exit 3) when
 * the prompt contains fail-me. Emits a secret-shaped token in the result text when the
 * prompt contains leak-secret (proves resultText is redacted before persist/broadcast). */
const STUB = `#!/bin/sh
PROMPT=$(cat)
echo "$@" >> "\${STUB_ARGS_FILE:-/dev/null}"
case "$*" in
  *--resume*) SID=sess-resumed ;;
  *) SID=sess-root ;;
esac
echo "{\\"type\\":\\"system\\",\\"subtype\\":\\"init\\",\\"session_id\\":\\"$SID\\"}"
echo "{\\"type\\":\\"assistant\\",\\"message\\":\\"db:[$DATABASE_URL]\\"}"
echo "{\\"type\\":\\"assistant\\",\\"message\\":\\"$PROMPT\\"}"
if [ -n "$STUB_SLEEP" ]; then sleep "$STUB_SLEEP"; fi
if echo "$PROMPT" | grep -q fail-me; then
  echo "{\\"type\\":\\"result\\",\\"is_error\\":true,\\"result\\":\\"boom\\"}"
  exit 3
fi
if echo "$PROMPT" | grep -q leak-secret; then
  echo "{\\"type\\":\\"result\\",\\"is_error\\":false,\\"result\\":\\"here: sk-abcdefghij0123456789extra\\",\\"total_cost_usd\\":0.01,\\"duration_ms\\":5,\\"session_id\\":\\"$SID\\",\\"usage\\":{\\"input_tokens\\":3,\\"output_tokens\\":4}}"
  exit 0
fi
echo "{\\"type\\":\\"result\\",\\"is_error\\":false,\\"result\\":\\"stub-result: $PROMPT\\",\\"total_cost_usd\\":0.01,\\"duration_ms\\":5,\\"session_id\\":\\"$SID\\",\\"usage\\":{\\"input_tokens\\":3,\\"output_tokens\\":4}}"
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
    process.env.RUN_ENV_ALLOWLIST = 'STUB_SLEEP,STUB_ARGS_FILE'; // let the stub's sleep/argv-dump knobs reach the child env
    delete process.env.STUB_SLEEP;

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
    delete process.env.CLAUDE_BIN;
    delete process.env.RUN_ENV_ALLOWLIST;
    delete process.env.STUB_SLEEP;
    await Promise.all(cleanupDirs.map((d) => rm(d, { recursive: true, force: true })));
  });

  async function waitForTerminal(runId: string, timeoutMs = 10000) {
    const start = Date.now();
    for (;;) {
      const run = await prisma.campusRun.findUnique({ where: { id: runId } });
      if (run && ['COMPLETED', 'FAILED', 'STOPPED', 'TIMED_OUT'].includes(run.status)) return run;
      if (Date.now() - start > timeoutMs) throw new Error(`run ${runId} still ${run?.status}`);
      await new Promise((r) => setTimeout(r, 150));
    }
  }

  it('streams stream-json into RunEvent rows and finalizes COMPLETED', async () => {
    const project = await makeProject('stream');
    const res = await request(app.getHttpServer()).post(`/api/projects/${project.id}/runs`).send({ prompt: 'hello world' });
    expect(res.status).toBe(201);
    const run = await waitForTerminal(res.body.id);
    expect(run.status).toBe('COMPLETED');
    expect(run.sessionId).toBe('sess-root'); // fresh run, no --resume in argv
    expect(run.resultText).toContain('hello world');
    expect(run.costUsd?.toString()).toBe('0.01');
    expect(run.inputTokens).toBe(3);
    const events = await prisma.runEvent.findMany({ where: { runId: run.id }, orderBy: { seq: 'asc' } });
    expect(events[0].type).toBe('system');
    expect(events.some((e) => e.type === 'result')).toBe(true);
    expect(events.map((e) => e.seq)).toEqual(events.map((_, i) => i)); // seq is 0..n dense
    // DATABASE_URL is stripped from the spawned child's env -- proven via a persisted event.
    const dbEvent = await prisma.runEvent.findFirst({ where: { runId: run.id, type: 'assistant' }, orderBy: { seq: 'asc' } });
    expect(JSON.stringify(dbEvent?.payload)).toContain('db:[]'); // env allowlist dropped DATABASE_URL
  });

  it('marks a failing run FAILED with the error result text', async () => {
    const project = await makeProject('streamfail');
    const res = await request(app.getHttpServer()).post(`/api/projects/${project.id}/runs`).send({ prompt: 'please fail-me' });
    const run = await waitForTerminal(res.body.id);
    expect(run.status).toBe('FAILED');
    expect(run.resultText).toContain('boom');
  });

  it('redacts a secret-shaped token in the model result text before persisting', async () => {
    const project = await makeProject('leak');
    const res = await request(app.getHttpServer()).post(`/api/projects/${project.id}/runs`).send({ prompt: 'please leak-secret' });
    const run = await waitForTerminal(res.body.id);
    expect(run.status).toBe('COMPLETED');
    expect(run.resultText).toContain('[REDACTED]');
    expect(run.resultText).not.toContain('sk-abcdefghij0123456789extra');
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

  it('disables start/list/stop on a non-loopback bind', async () => {
    const project = await makeProject('non-loopback');
    process.env.API_HOST = '0.0.0.0';
    try {
      await request(app.getHttpServer())
        .post(`/api/projects/${project.id}/runs`)
        .send({ prompt: 'should be blocked' })
        .expect(403);
      await request(app.getHttpServer()).get(`/api/projects/${project.id}/runs`).expect(403);
      await request(app.getHttpServer()).post(`/api/runs/some-run-id/stop`).expect(403);
    } finally {
      delete process.env.API_HOST;
    }
  });

  it('enforces unique (runId, seq) on run events', async () => {
    const project = await makeProject('uniqseq');
    const run = await prisma.campusRun.create({ data: { projectId: project.id, prompt: 'x' } });
    await prisma.runEvent.create({ data: { runId: run.id, seq: 0, type: 'system', payload: {} } });
    await expect(
      prisma.runEvent.create({ data: { runId: run.id, seq: 0, type: 'assistant', payload: {} } }),
    ).rejects.toThrow();
  });

  it('queues a second run for the same project, then runs it after the first finishes', async () => {
    process.env.STUB_SLEEP = '1';
    try {
      const project = await makeProject('queue');
      const a = await request(app.getHttpServer()).post(`/api/projects/${project.id}/runs`).send({ prompt: 'first' });
      const b = await request(app.getHttpServer()).post(`/api/projects/${project.id}/runs`).send({ prompt: 'second' });
      expect(a.status).toBe(201);
      expect(b.status).toBe(201);
      const bFresh = await prisma.campusRun.findUnique({ where: { id: b.body.id } });
      expect(['QUEUED', 'STARTING']).toContain(bFresh!.status); // not RUNNING while A holds the project
      const bDone = await waitForTerminal(b.body.id, 20000);
      expect(bDone.status).toBe('COMPLETED');
    } finally {
      delete process.env.STUB_SLEEP;
    }
  });

  it('rejects past the 10-deep per-project queue cap', async () => {
    process.env.STUB_SLEEP = '3';
    try {
      const project = await makeProject('cap');
      for (let i = 0; i < 11; i++) {
        await request(app.getHttpServer()).post(`/api/projects/${project.id}/runs`).send({ prompt: `r${i}` });
      }
      const over = await request(app.getHttpServer()).post(`/api/projects/${project.id}/runs`).send({ prompt: 'too-many' });
      expect(over.status).toBe(429);
    } finally {
      delete process.env.STUB_SLEEP;
    }
  }, 30000);

  it('accepts a per-run permissionMode and model', async () => {
    const project = await makeProject('opts');
    const res = await request(app.getHttpServer()).post(`/api/projects/${project.id}/runs`).send({ prompt: 'x', permissionMode: 'plan', model: 'opus' });
    expect(res.status).toBe(201);
    const run = await waitForTerminal(res.body.id);
    expect(run.permissionMode).toBe('plan');
    expect(run.model).toBe('opus');
  });

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

  it('never re-finalizes a run that already reached a terminal status (stop racing a natural completion)', async () => {
    const project = await makeProject('idempotency');
    const run = await prisma.campusRun.create({ data: { projectId: project.id, prompt: 'x', status: 'RUNNING' } });
    const svc = app.get(RunsService) as unknown as { finalize: (id: string, o: Record<string, unknown>) => Promise<void> };
    // The child's close handler wins the race and finalizes COMPLETED first...
    await svc.finalize(run.id, { status: 'COMPLETED', resultText: 'done' });
    // ...then a stop() arriving a moment later must not clobber it back to STOPPED: its
    // guarded updateMany (status must still be STARTING/RUNNING/STOPPING/QUEUED) matches
    // 0 rows once the row is COMPLETED, so this call is a no-op.
    await svc.finalize(run.id, { status: 'STOPPED', resultText: 'stopped' });
    const row = await prisma.campusRun.findUnique({ where: { id: run.id } });
    expect(row!.status).toBe('COMPLETED'); // not clobbered
    expect(row!.resultText).toBe('done');
  });

  it('continues a conversation with --resume and inherited options', async () => {
    const argsFile = path.join(await mkdtemp(path.join(tmpdir(), 'campus-args-')), 'args.log');
    process.env.STUB_ARGS_FILE = argsFile;
    const project = await makeProject('continue');
    const first = await request(app.getHttpServer()).post(`/api/projects/${project.id}/runs`).send({ prompt: 'start', model: 'opus', permissionMode: 'plan' });
    const firstDone = await waitForTerminal(first.body.id);
    expect(firstDone.sessionId).toBe('sess-root'); // fresh run, no --resume in argv

    const cont = await request(app.getHttpServer()).post(`/api/runs/${first.body.id}/continue`).send({ prompt: 'and then?' });
    expect(cont.status).toBe(201);
    const contDone = await waitForTerminal(cont.body.id);
    expect(contDone.parentRunId).toBe(first.body.id);
    expect(contDone.conversationId).toBe(firstDone.conversationId);
    expect(contDone.model).toBe('opus');          // inherited
    expect(contDone.permissionMode).toBe('plan');  // inherited

    const argsLog = (await import('node:fs')).readFileSync(argsFile, 'utf8');
    expect(argsLog).toContain('--resume sess-root'); // launch() uses the parent's session AT LAUNCH
    delete process.env.STUB_ARGS_FILE;
  });

  it('captures a continue row\'s OWN session id instead of leaving the inherited parent id, so the next continue resumes the latest turn', async () => {
    const argsFile = path.join(await mkdtemp(path.join(tmpdir(), 'campus-args-')), 'args.log');
    process.env.STUB_ARGS_FILE = argsFile;
    const project = await makeProject('continue-session');

    const root = await request(app.getHttpServer()).post(`/api/projects/${project.id}/runs`).send({ prompt: 'start' });
    const rootDone = await waitForTerminal(root.body.id);
    expect(rootDone.sessionId).toBe('sess-root');

    // The continue row is CREATED with the parent's sessionId (so launch() can --resume
    // it), but the stub reports back 'sess-resumed' once it sees --resume on its own argv.
    // Without Fix 2's unconditional capture, `!run.sessionId` is false for this row (it
    // inherited 'sess-root' at creation) and the capture branch never runs -- the row would
    // stay stuck on the root's now-stale id forever.
    const cont = await request(app.getHttpServer()).post(`/api/runs/${root.body.id}/continue`).send({ prompt: 'and then?' });
    const contDone = await waitForTerminal(cont.body.id);
    expect(contDone.sessionId).toBe('sess-resumed');

    // And the NEXT continue must resume the latest turn ('sess-resumed'), not the root.
    const cont2 = await request(app.getHttpServer()).post(`/api/runs/${cont.body.id}/continue`).send({ prompt: 'once more?' });
    await waitForTerminal(cont2.body.id);
    const argsLog = (await import('node:fs')).readFileSync(argsFile, 'utf8');
    expect(argsLog).toContain('--resume sess-resumed');
    delete process.env.STUB_ARGS_FILE;
  });

  it('rejects continuing a run that has no session to resume with 409', async () => {
    const project = await makeProject('continue-409');
    const parent = await prisma.campusRun.create({
      data: { projectId: project.id, prompt: 'no session ever captured', status: 'FAILED', sessionId: null },
    });
    const res = await request(app.getHttpServer()).post(`/api/runs/${parent.id}/continue`).send({ prompt: 'try anyway' });
    expect(res.status).toBe(409);
  });

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

  it('rejects non-numeric after/take on the run events endpoint with 400, not a 500', async () => {
    const project = await makeProject('events-bad-query');
    const res = await request(app.getHttpServer()).post(`/api/projects/${project.id}/runs`).send({ prompt: 'events please' });
    const run = await waitForTerminal(res.body.id);
    await request(app.getHttpServer()).get(`/api/runs/${run.id}/events?after=abc`).expect(400);
    await request(app.getHttpServer()).get(`/api/runs/${run.id}/events?take=xyz`).expect(400);
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
});
