import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { mergeDuplicateProjects } from '../src/projects/dedupe';

describe('mergeDuplicateProjects (integration)', () => {
  const prisma = new PrismaClient();
  afterAll(() => prisma.$disconnect());

  async function makeDupPair() {
    const rootPath = `/fake/dedupe-${Math.random().toString(36).slice(2)}`;
    const survivor = await prisma.project.create({
      data: { projectKey: `remote:${rootPath}`, name: 'a', rootPath },
    });
    const dup = await prisma.project.create({
      data: { projectKey: `path:${rootPath}`, name: 'a', rootPath },
    });
    const session = await prisma.claudeSession.create({
      data: { externalSessionId: `s-${rootPath}`, projectId: dup.id, cwd: rootPath },
    });
    const agent = await prisma.projectAgent.create({
      data: { projectId: dup.id, agentType: 'main-claude', displayName: 'Main' },
    });
    await prisma.claudeEvent.create({
      data: {
        projectId: dup.id, sessionId: session.id, agentId: agent.id,
        hookEventName: 'SessionStart', normalizedType: 'session_start',
        payload: {}, occurredAt: new Date(),
      },
    });
    return { survivor, dup, rootPath };
  }

  it('moves history to the survivor and deletes the duplicate row', async () => {
    const { survivor, dup, rootPath } = await makeDupPair();

    const result = await mergeDuplicateProjects(prisma, { dryRun: false });
    expect(result.merged).toBeGreaterThanOrEqual(1);

    const rows = await prisma.project.findMany({ where: { rootPath } });
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(survivor.id);
    expect(await prisma.claudeEvent.count({ where: { projectId: survivor.id } })).toBe(1);
    expect(await prisma.claudeSession.count({ where: { projectId: survivor.id } })).toBe(1);
    expect(await prisma.projectAgent.count({ where: { projectId: survivor.id } })).toBe(1);
    expect(await prisma.project.findUnique({ where: { id: dup.id } })).toBeNull();
  });

  it('does nothing on --dry-run', async () => {
    const { rootPath } = await makeDupPair();
    await mergeDuplicateProjects(prisma, { dryRun: true });
    expect(await prisma.project.count({ where: { rootPath } })).toBe(2);
  });
});
