import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { mkdtemp, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { AppModule } from '../src/app.module';

const prisma = new PrismaClient();

describe('Approvals (integration)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    await prisma.$connect();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('delegates a non-destructive command to the runtime approval policy', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'campus-approval-'));
    const res = await request(app.getHttpServer())
      .post('/api/claude/approval')
      .send({ session_id: randomUUID(), cwd: dir, hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'npm test' } })
      .expect(204);
    expect(res.text).toBe('');
  });

  it('blocks a destructive command and denies on timeout (safe default)', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'campus-approval-destructive-'));
    const start = Date.now();
    const res = await request(app.getHttpServer())
      .post('/api/claude/approval')
      .send({ session_id: randomUUID(), cwd: dir, hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'rm -rf /tmp/whatever' } })
      .expect(201);
    expect(res.body.hookSpecificOutput.permissionDecision).toBe('deny');
    expect(Date.now() - start).toBeGreaterThanOrEqual(1000);
  });

  it('resolves allow via the /allow endpoint before timeout', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'campus-approval-allow-'));
    const sessionId = randomUUID();
    const pending = request(app.getHttpServer())
      .post('/api/claude/approval')
      .send({ session_id: sessionId, cwd: dir, hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'sudo rm thing' } });
    // supertest/superagent only dispatches the request once its thenable is driven --
    // kick it off now instead of waiting until the final `await pending` below.
    pending.then(
      () => undefined,
      () => undefined,
    );

    await new Promise((resolve) => setTimeout(resolve, 300));
    const approval = await prisma.approvalRequest.findFirst({ where: { sessionExternalId: sessionId } });
    expect(approval).toBeDefined();
    await request(app.getHttpServer()).post(`/api/approvals/${approval!.id}/allow`).expect(201);

    const res = await pending;
    expect(res.body.hookSpecificOutput.permissionDecision).toBe('allow');
  });

  it('returns the Codex PermissionRequest decision shape', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'campus-approval-codex-'));
    const res = await request(app.getHttpServer())
      .post('/api/codex/approval')
      .send({ session_id: randomUUID(), cwd: dir, hook_event_name: 'PermissionRequest', tool_name: 'Bash', tool_input: { command: 'sudo rm thing' } })
      .expect(201);
    expect(res.body).toEqual({
      hookSpecificOutput: {
        hookEventName: 'PermissionRequest',
        decision: { behavior: 'deny', message: 'Approval timed out' },
      },
    });
  });
});
