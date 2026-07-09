import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm, writeFile, mkdir, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../src/app.module';

const execFileAsync = promisify(execFile);

async function gitFixture(files: Record<string, string>): Promise<string> {
  const dir = await realpath(await mkdtemp(path.join(tmpdir(), 'campus-it-')));
  for (const [name, content] of Object.entries(files)) {
    const full = path.join(dir, name);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, content);
  }
  await execFileAsync('git', ['init', '-q', '-b', 'main'], { cwd: dir });
  await execFileAsync('git', ['config', 'user.email', 't@t.com'], { cwd: dir });
  await execFileAsync('git', ['config', 'user.name', 't'], { cwd: dir });
  await execFileAsync('git', ['add', '.'], { cwd: dir });
  await execFileAsync('git', ['commit', '-qm', 'init'], { cwd: dir });
  return dir;
}

describe('Claude event pipeline (integration)', () => {
  let app: INestApplication;
  const cleanupDirs: string[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await Promise.all(cleanupDirs.map((d) => rm(d, { recursive: true, force: true })));
  });

  async function send(cwd: string, sessionId: string, body: Record<string, unknown>) {
    return request(app.getHttpServer())
      .post('/api/claude/events')
      .send({ session_id: sessionId, cwd, ...body })
      .expect((res) => {
        if (res.status !== 201 && res.status !== 200) {
          throw new Error(`unexpected status ${res.status}: ${JSON.stringify(res.body)}`);
        }
      });
  }

  it('runs a PHP event flow end-to-end and creates a room + agent', async () => {
    const dir = await gitFixture({
      'composer.json': '{"require":{"laravel/framework":"^11.0"}}',
      artisan: '#!/usr/bin/env php',
    });
    cleanupDirs.push(dir);
    const sessionId = randomUUID();

    await send(dir, sessionId, { hook_event_name: 'SessionStart' });
    await send(dir, sessionId, { hook_event_name: 'UserPromptSubmit', prompt: 'Implement refresh-token rotation' });
    await send(dir, sessionId, { hook_event_name: 'PreToolUse', tool_name: 'Read', tool_input: { file_path: `${dir}/composer.json` } });
    await send(dir, sessionId, { hook_event_name: 'PreToolUse', tool_name: 'Edit', tool_input: { file_path: `${dir}/app/Services/PaymentService.php` } });
    await send(dir, sessionId, { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'vendor/bin/phpunit' } });
    await send(dir, sessionId, { hook_event_name: 'PostToolUse', tool_name: 'Bash', tool_input: { command: 'vendor/bin/phpunit' }, tool_response: { is_error: false } });
    await send(dir, sessionId, { hook_event_name: 'Stop' });
    await send(dir, sessionId, { hook_event_name: 'SessionEnd' });

    const projectsRes = await request(app.getHttpServer()).get('/api/projects').expect(200);
    const project = projectsRes.body.find((p: { rootPath: string }) => p.rootPath === dir);
    expect(project).toBeDefined();
    expect(project.technologies.map((t: { techId: string }) => t.techId)).toEqual(expect.arrayContaining(['php', 'laravel']));
    expect(project.agents[0].status).toBe('idle');

    const eventsRes = await request(app.getHttpServer()).get(`/api/projects/${project.id}/events`).expect(200);
    expect(eventsRes.body.length).toBe(8);
  });

  it('runs a Python event flow and detects pytest as a test command', async () => {
    const dir = await gitFixture({ 'pyproject.toml': '[tool.poetry]\nname="x"', 'app/services/payment.py': 'x=1' });
    cleanupDirs.push(dir);
    const sessionId = randomUUID();
    await send(dir, sessionId, { hook_event_name: 'SessionStart' });
    await send(dir, sessionId, { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'python -m pytest' } });

    const projectsRes = await request(app.getHttpServer()).get('/api/projects').expect(200);
    const project = projectsRes.body.find((p: { rootPath: string }) => p.rootPath === dir);
    expect(project.technologies.some((t: { techId: string }) => t.techId === 'python')).toBe(true);

    const eventsRes = await request(app.getHttpServer()).get(`/api/projects/${project.id}/events`).expect(200);
    const bashEvent = eventsRes.body.find((e: { normalizedType: string }) => e.normalizedType === 'command_run');
    expect(bashEvent).toBeDefined();
  });

  it('runs a Go event flow and moves the agent to the testing zone for `go test`', async () => {
    const dir = await gitFixture({ 'go.mod': 'module example.com/x\n\ngo 1.22', 'main.go': 'package main' });
    cleanupDirs.push(dir);
    const sessionId = randomUUID();
    await send(dir, sessionId, { hook_event_name: 'SessionStart' });
    await send(dir, sessionId, { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'go test ./...' } });

    const projectsRes = await request(app.getHttpServer()).get('/api/projects').expect(200);
    const project = projectsRes.body.find((p: { rootPath: string }) => p.rootPath === dir);
    const agent = project.agents.find((a: { externalAgentId: string }) => a.externalAgentId === 'main-claude');
    expect(agent.currentZoneKey).toBe('testing-station');
    expect(agent.activity).toBe('testing');
  });

  it('handles an unknown/non-git project without failing', async () => {
    const dir = await realpath(await mkdtemp(path.join(tmpdir(), 'campus-it-unknown-')));
    cleanupDirs.push(dir);
    const sessionId = randomUUID();
    await send(dir, sessionId, { hook_event_name: 'SessionStart' });

    const projectsRes = await request(app.getHttpServer()).get('/api/projects').expect(200);
    const project = projectsRes.body.find((p: { rootPath: string }) => p.rootPath === dir);
    expect(project).toBeDefined();
    expect(project.isGitRepository).toBe(false);
  });

  it('is idempotent for duplicate SessionStart events on the same session', async () => {
    const dir = await gitFixture({ 'go.mod': 'module dup', 'main.go': 'package main' });
    cleanupDirs.push(dir);
    const sessionId = randomUUID();
    await send(dir, sessionId, { hook_event_name: 'SessionStart' });
    await send(dir, sessionId, { hook_event_name: 'SessionStart' });

    const projectsRes = await request(app.getHttpServer()).get('/api/projects').expect(200);
    const project = projectsRes.body.find((p: { rootPath: string }) => p.rootPath === dir);
    expect(project.agents.filter((a: { externalAgentId: string }) => a.externalAgentId === 'main-claude').length).toBe(1);
  });

  it('rejects a malformed payload with 400 instead of crashing', async () => {
    await request(app.getHttpServer()).post('/api/claude/events').send({ nonsense: true }).expect(400);
  });
});
