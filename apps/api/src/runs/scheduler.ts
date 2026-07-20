export interface ClaimInput {
  queued: { id: string; projectId: string; createdAt: Date }[];
  runningProjectIds: Set<string>;
  freeSlots: number;
}

/** Pick run ids to flip QUEUED->STARTING: oldest first, at most one per project, never
 * more than the free global slots, never a project that already has a run in flight. */
export function selectClaimable({ queued, runningProjectIds, freeSlots }: ClaimInput): string[] {
  const ordered = [...queued].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const claimedProjects = new Set(runningProjectIds);
  const ids: string[] = [];
  for (const run of ordered) {
    if (ids.length >= freeSlots) break;
    if (claimedProjects.has(run.projectId)) continue;
    ids.push(run.id);
    claimedProjects.add(run.projectId);
  }
  return ids;
}
