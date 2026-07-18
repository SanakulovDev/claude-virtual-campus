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
