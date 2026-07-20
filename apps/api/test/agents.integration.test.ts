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
import { AGENT_NAME_POOL } from '@campus/contracts';
import { AppModule } from '../src/app.module';

const execFileAsync = promisify(execFile);

async function gitFixture(): Promise<string> {
  const dir = await realpath(await mkdtemp(path.join(tmpdir(), 'campus-agents-')));
  await writeFile(path.join(dir, 'go.mod'), 'module example.com/agents\n\ngo 1.22');
  await execFileAsync('git', ['init', '-q', '-b', 'main'], { cwd: dir });
  await execFileAsync('git', ['config', 'user.email', 't@t.com'], { cwd: dir });
  await execFileAsync('git', ['config', 'user.name', 't'], { cwd: dir });
  await execFileAsync('git', ['add', '.'], { cwd: dir });
  await execFileAsync('git', ['commit', '-qm', 'init'], { cwd: dir });
  return dir;
}

describe('Agent identities (integration)', () => {
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

  const http = () => request(app.getHttpServer());
  async function send(cwd: string, sessionId: string, body: Record<string, unknown>) {
    return http()
      .post('/api/claude/events')
      .send({ session_id: sessionId, cwd, ...body })
      .expect((res) => {
        if (res.status !== 200 && res.status !== 201) throw new Error(`status ${res.status}`);
      });
  }
  async function getProject(dir: string) {
    const res = await http().get('/api/projects').expect(200);
    return res.body.find((p: { rootPath: string }) => p.rootPath === dir);
  }

  it('gives main Claude the Team Lead identity, not a raw id', async () => {
    const dir = await gitFixture();
    cleanupDirs.push(dir);
    const sessionId = randomUUID();
    await send(dir, sessionId, { hook_event_name: 'SessionStart' });

    const project = await getProject(dir);
    const main = project.agents.find((a: { externalAgentId: string }) => a.externalAgentId === 'main-claude');
    expect(main.displayName).toBe('Claude');
    expect(main.role).toBe('Team Lead');
  });

  it('names real subagents from the pool and reuses the same teammate on restart', async () => {
    const dir = await gitFixture();
    cleanupDirs.push(dir);
    const sessionId = randomUUID();
    await send(dir, sessionId, { hook_event_name: 'SessionStart' });
    // start the same subagent kind twice (e.g. after a reconnect/restart)
    const planTask = { hook_event_name: 'PreToolUse', tool_name: 'Task', tool_input: { subagent_type: 'plan', description: 'Plan the work' } };
    await send(dir, sessionId, planTask);
    await send(dir, sessionId, { hook_event_name: 'SubagentStop' });
    await send(dir, sessionId, planTask);

    const project = await getProject(dir);
    const planners = project.agents.filter((a: { agentType: string }) => a.agentType === 'plan');
    expect(planners.length).toBe(1); // no duplicate after restart
    expect(planners[0].role).toBe('Planner');
    expect((AGENT_NAME_POOL as readonly string[]).includes(planners[0].displayName)).toBe(true);
    expect(planners[0].displayName).not.toMatch(/^(agent-|subagent-|.*:sub:)/);
  });

  it('never assigns two subagents the same name in one project', async () => {
    const dir = await gitFixture();
    cleanupDirs.push(dir);
    const sessionId = randomUUID();
    await send(dir, sessionId, { hook_event_name: 'SessionStart' });
    for (const type of ['plan', 'qa-engineer', 'code-reviewer']) {
      await send(dir, sessionId, { hook_event_name: 'PreToolUse', tool_name: 'Task', tool_input: { subagent_type: type } });
      await send(dir, sessionId, { hook_event_name: 'SubagentStop' });
    }
    const project = await getProject(dir);
    const subNames = project.agents
      .filter((a: { externalAgentId: string }) => a.externalAgentId !== 'main-claude')
      .map((a: { displayName: string }) => a.displayName);
    expect(new Set(subNames).size).toBe(subNames.length);
    expect(subNames.length).toBe(3);
  });

  it('renames an agent and resets back to the generated name (persisted)', async () => {
    const dir = await gitFixture();
    cleanupDirs.push(dir);
    const sessionId = randomUUID();
    await send(dir, sessionId, { hook_event_name: 'SessionStart' });
    await send(dir, sessionId, { hook_event_name: 'PreToolUse', tool_name: 'Task', tool_input: { subagent_type: 'qa-engineer' } });

    let project = await getProject(dir);
    const qa = project.agents.find((a: { agentType: string }) => a.agentType === 'qa-engineer');
    const generated = qa.displayName;

    await http().patch(`/api/agents/${qa.id}`).send({ name: 'Beatrice' }).expect(200);
    project = await getProject(dir);
    expect(project.agents.find((a: { id: string }) => a.id === qa.id).displayName).toBe('Beatrice');

    // reset with null restores the generated name
    await http().patch(`/api/agents/${qa.id}`).send({ name: null }).expect(200);
    project = await getProject(dir);
    expect(project.agents.find((a: { id: string }) => a.id === qa.id).displayName).toBe(generated);
  });

  it('applies presentation overrides from .claude/campus.json', async () => {
    const dir = await gitFixture();
    cleanupDirs.push(dir);
    await mkdir(path.join(dir, '.claude'), { recursive: true });
    await writeFile(
      path.join(dir, '.claude', 'campus.json'),
      JSON.stringify({ team: [{ agentType: 'plan', name: 'Ada', role: 'Chief Planner' }] }),
    );
    const sessionId = randomUUID();
    await send(dir, sessionId, { hook_event_name: 'SessionStart' });
    await send(dir, sessionId, { hook_event_name: 'PreToolUse', tool_name: 'Task', tool_input: { subagent_type: 'plan' } });

    const project = await getProject(dir);
    const planner = project.agents.find((a: { agentType: string }) => a.agentType === 'plan');
    expect(planner.displayName).toBe('Ada');
    expect(planner.role).toBe('Chief Planner');
  });

  it('returns an agent event history newest-first', async () => {
    const dir = await gitFixture();
    cleanupDirs.push(dir);
    const sessionId = randomUUID();
    await send(dir, sessionId, { hook_event_name: 'SessionStart' });
    await send(dir, sessionId, { hook_event_name: 'PreToolUse', tool_name: 'Read', tool_input: { file_path: 'x.go' } });

    const project = await getProject(dir);
    const main = project.agents.find((a: { externalAgentId: string }) => a.externalAgentId === 'main-claude');

    const res = await http().get(`/api/agents/${main.id}/events`).expect(200);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
    expect(res.body.map((e: { hookEventName: string }) => e.hookEventName)).toContain('SessionStart');
    expect(res.body.map((e: { hookEventName: string }) => e.hookEventName)).toContain('PreToolUse');
    const receivedTimes = res.body.map((e: { receivedAt: string }) => new Date(e.receivedAt).getTime());
    expect(receivedTimes).toEqual([...receivedTimes].sort((a, b) => b - a)); // newest first
  });

  it('rejects a non-numeric take on the agent events endpoint with 400, not a 500', async () => {
    const dir = await gitFixture();
    cleanupDirs.push(dir);
    const sessionId = randomUUID();
    await send(dir, sessionId, { hook_event_name: 'SessionStart' });
    const project = await getProject(dir);
    const main = project.agents.find((a: { externalAgentId: string }) => a.externalAgentId === 'main-claude');
    await http().get(`/api/agents/${main.id}/events?take=abc`).expect(400);
  });
});
