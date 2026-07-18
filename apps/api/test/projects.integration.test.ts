import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm, writeFile, mkdir, realpath } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
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

describe('project deletion (integration)', () => {
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

  it('deletes a room and its cascade, and 404s on a second delete', async () => {
    const dir = await gitFixture({ 'go.mod': 'module example.com/x\n\ngo 1.22\n' });
    cleanupDirs.push(dir);
    const sessionId = randomUUID();

    // Create the room + some cascade rows via the real pipeline.
    await request(app.getHttpServer())
      .post('/api/claude/events')
      .send({ session_id: sessionId, cwd: dir, hook_event_name: 'SessionStart' })
      .expect((r) => {
        if (r.status !== 200 && r.status !== 201) throw new Error(`status ${r.status}`);
      });

    const listed = await request(app.getHttpServer()).get('/api/projects').expect(200);
    const project = listed.body.find((p: { rootPath: string }) => p.rootPath === dir);
    expect(project).toBeDefined();

    await request(app.getHttpServer()).delete(`/api/projects/${project.id}`).expect(200);

    const after = await request(app.getHttpServer()).get('/api/projects').expect(200);
    expect(after.body.find((p: { id: string }) => p.id === project.id)).toBeUndefined();

    await request(app.getHttpServer()).delete(`/api/projects/${project.id}`).expect(404);
  });

  it('installs campus hooks into a project path without touching its manifest', async () => {
    const dir = await realpath(await mkdtemp(path.join(tmpdir(), 'campus-install-')));
    cleanupDirs.push(dir);
    const manifest = '{"name":"demo"}';
    await writeFile(path.join(dir, 'package.json'), manifest);

    await request(app.getHttpServer())
      .post('/api/projects/install')
      .send({ path: dir })
      .expect((r) => {
        if (r.status !== 200 && r.status !== 201) throw new Error(`status ${r.status}: ${JSON.stringify(r.body)}`);
      });

    expect(existsSync(path.join(dir, '.claude/hooks/send-event.sh'))).toBe(true);
    expect(existsSync(path.join(dir, '.claude/settings.json'))).toBe(true);
    expect(readFileSync(path.join(dir, 'package.json'), 'utf8')).toBe(manifest);

    await request(app.getHttpServer()).post('/api/projects/install').send({ path: '' }).expect(400);
  });

  it('upgrades a path-keyed room in place when the repo gains a remote', async () => {
    const dir = await gitFixture({ 'README.md': '# x' }); // git repo, no remote
    cleanupDirs.push(dir);
    const sessionId = randomUUID();

    await send(dir, sessionId, { hook_event_name: 'SessionStart' });
    const before = await request(app.getHttpServer()).get('/api/projects').expect(200);
    const room = before.body.find((p: { rootPath: string }) => p.rootPath === dir);
    expect(room).toBeDefined();
    expect(room.projectKey.startsWith('path:')).toBe(true);

    await execFileAsync('git', ['remote', 'add', 'origin', `https://github.com/acme/${path.basename(dir)}.git`], { cwd: dir });
    await send(dir, sessionId, { hook_event_name: 'UserPromptSubmit', prompt: 'hi' });

    const after = await request(app.getHttpServer()).get('/api/projects').expect(200);
    const rooms = after.body.filter((p: { rootPath: string }) => p.rootPath === dir);
    expect(rooms).toHaveLength(1); // no second room
    expect(rooms[0].id).toBe(room.id); // same row, upgraded
    expect(rooms[0].projectKey.startsWith('remote:')).toBe(true);
  });

  it('survives two concurrent first events without losing either', async () => {
    const dir = await gitFixture({ 'README.md': '# y' });
    cleanupDirs.push(dir);
    await Promise.all([
      send(dir, randomUUID(), { hook_event_name: 'SessionStart' }),
      send(dir, randomUUID(), { hook_event_name: 'SessionStart' }),
    ]);
    const res = await request(app.getHttpServer()).get('/api/projects').expect(200);
    expect(res.body.filter((p: { rootPath: string }) => p.rootPath === dir)).toHaveLength(1);
  });
});
