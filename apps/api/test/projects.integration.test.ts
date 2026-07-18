import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm, writeFile, realpath } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../src/app.module';

const execFileAsync = promisify(execFile);

async function gitFixture(): Promise<string> {
  const dir = await realpath(await mkdtemp(path.join(tmpdir(), 'campus-del-')));
  await writeFile(path.join(dir, 'go.mod'), 'module example.com/x\n\ngo 1.22\n');
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

  it('deletes a room and its cascade, and 404s on a second delete', async () => {
    const dir = await gitFixture();
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
});
