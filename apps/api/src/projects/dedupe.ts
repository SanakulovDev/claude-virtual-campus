import type { PrismaClient, Prisma, Project } from '@prisma/client';

/**
 * Merges Project rows that share a rootPath -- the residue of the identity bugs fixed in
 * project-inspector (remote added later, cwd-keyed non-git rooms). Manual-only: invoked by
 * scripts/db-dedupe.ts, never automatically.
 */
export async function mergeDuplicateProjects(
  prisma: PrismaClient,
  options: { dryRun: boolean },
): Promise<{ groups: number; merged: number }> {
  const all = await prisma.project.findMany({ orderBy: { createdAt: 'asc' } });
  const byRoot = new Map<string, Project[]>();
  for (const project of all) {
    if (project.rootPath.trim() === '') continue;
    const group = byRoot.get(project.rootPath) ?? [];
    group.push(project);
    byRoot.set(project.rootPath, group);
  }

  let groups = 0;
  let merged = 0;
  for (const [rootPath, rows] of byRoot) {
    if (rows.length < 2) continue;
    groups += 1;
    const remoteRows = rows.filter((r) => r.projectKey.startsWith('remote:'));
    // rows.length >= 2 here (checked above), so both indices are always in bounds.
    const survivor = remoteRows.length > 0 ? remoteRows[remoteRows.length - 1]! : rows[0]!;
    const duplicates = rows.filter((r) => r.id !== survivor.id);
    console.log(`${rootPath}: keeping ${survivor.projectKey}, merging ${duplicates.length} duplicate(s)`);
    if (options.dryRun) continue;

    for (const dup of duplicates) {
      await prisma.$transaction(async (tx) => {
        await mergeAgents(tx, dup.id, survivor.id);
        await tx.claudeSession.updateMany({ where: { projectId: dup.id }, data: { projectId: survivor.id } });
        await tx.task.updateMany({ where: { projectId: dup.id }, data: { projectId: survivor.id } });
        await tx.claudeEvent.updateMany({ where: { projectId: dup.id }, data: { projectId: survivor.id } });
        await tx.toolExecution.updateMany({ where: { projectId: dup.id }, data: { projectId: survivor.id } });
        await tx.approvalRequest.updateMany({ where: { projectId: dup.id }, data: { projectId: survivor.id } });
        await tx.activitySnapshot.updateMany({ where: { projectId: dup.id }, data: { projectId: survivor.id } });
        // modules/technologies are re-derived on the next event; deleting avoids
        // (projectId, relativePath)/(projectId, techId) unique clashes.
        await tx.projectModule.deleteMany({ where: { projectId: dup.id } });
        await tx.projectTechnology.deleteMany({ where: { projectId: dup.id } });
        await tx.project.delete({ where: { id: dup.id } });
      });
      merged += 1;
    }
  }
  return { groups, merged };
}

/** Moves agents to the survivor; on (projectId, externalAgentId) clash, folds the dup
 * agent's history into the survivor's agent and deletes the dup agent. */
async function mergeAgents(tx: Prisma.TransactionClient, dupProjectId: string, survivorProjectId: string) {
  const dupAgents = await tx.projectAgent.findMany({ where: { projectId: dupProjectId } });
  for (const agent of dupAgents) {
    const clash = agent.externalAgentId
      ? await tx.projectAgent.findUnique({
          where: { projectId_externalAgentId: { projectId: survivorProjectId, externalAgentId: agent.externalAgentId } },
        })
      : null;
    if (!clash) {
      await tx.projectAgent.update({ where: { id: agent.id }, data: { projectId: survivorProjectId } });
      continue;
    }
    await tx.claudeEvent.updateMany({ where: { agentId: agent.id }, data: { agentId: clash.id } });
    await tx.toolExecution.updateMany({ where: { agentId: agent.id }, data: { agentId: clash.id } });
    await tx.taskAssignment.updateMany({ where: { agentId: agent.id }, data: { agentId: clash.id } });
    await tx.projectAgent.delete({ where: { id: agent.id } });
  }
}
