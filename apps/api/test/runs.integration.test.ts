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
 * result. Sleeps when STUB_SLEEP is set. Fails (is_error result + exit 3) when the prompt
 * contains fail-me. Emits a secret-shaped token in the result text when the prompt
 * contains leak-secret (proves resultText is redacted before persist/broadcast). */
const STUB = `#!/bin/sh
PROMPT=$(cat)
echo "{\\"type\\":\\"system\\",\\"subtype\\":\\"init\\",\\"session_id\\":\\"sess-stub\\"}"
echo "{\\"type\\":\\"assistant\\",\\"message\\":\\"db:[$DATABASE_URL]\\"}"
echo "{\\"type\\":\\"assistant\\",\\"message\\":\\"$PROMPT\\"}"
if [ -n "$STUB_SLEEP" ]; then sleep "$STUB_SLEEP"; fi
if echo "$PROMPT" | grep -q fail-me; then
  echo "{\\"type\\":\\"result\\",\\"is_error\\":true,\\"result\\":\\"boom\\"}"
  exit 3
fi
if echo "$PROMPT" | grep -q leak-secret; then
  echo "{\\"type\\":\\"result\\",\\"is_error\\":false,\\"result\\":\\"here: sk-abcdefghij0123456789extra\\",\\"total_cost_usd\\":0.01,\\"duration_ms\\":5,\\"session_id\\":\\"sess-stub\\",\\"usage\\":{\\"input_tokens\\":3,\\"output_tokens\\":4}}"
  exit 0
fi
echo "{\\"type\\":\\"result\\",\\"is_error\\":false,\\"result\\":\\"stub-result: $PROMPT\\",\\"total_cost_usd\\":0.01,\\"duration_ms\\":5,\\"session_id\\":\\"sess-stub\\",\\"usage\\":{\\"input_tokens\\":3,\\"output_tokens\\":4}}"
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
    expect(run.sessionId).toBe('sess-stub');
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
});
