'use client';

import { useMemo } from 'react';
import type { AgentRow } from '../../lib/types';
import { useCampusStore } from '../../stores/campusStore';
import { useDebouncedLocation } from '../../hooks/useDebouncedLocation';
import { useAmbientActivity } from '../../hooks/useAmbientActivity';
import { selectAgentVisualState, selectStudioLocation } from '../../selectors/visual-state.selector';
import { ambientSpot, roomPlacement } from '../../selectors/office-layout';
import { agentWorldTarget } from '../../selectors/agent-world-target';
import { AgentAvatar } from '../agents/AgentAvatar';

/** Facing when parked: desks face the back wall (local -z); review faces the screen (north). */
function restFacing(location: string, north: boolean): number {
  if (location === 'review-screen') return Math.PI; // world -z (screen on the north wall)
  return north ? Math.PI : 0; // local -z in world terms per side
}

/**
 * One person in the lab. Resolves the agent's committed location + ambient life to a
 * world-space destination; AgentAvatar routes itself there through the hallway.
 */
export function OfficeAgent({
  agent, projectId, projectIndex, deskIndex, crowd, projectCount,
}: {
  agent: AgentRow;
  projectId: string;
  projectIndex: number;
  deskIndex: number;
  crowd: { index: number; count: number };
  projectCount: number;
}) {
  const visualState = selectAgentVisualState(agent);
  const desired = selectStudioLocation(visualState);
  const location = useDebouncedLocation(desired);
  const ambient = useAmbientActivity(agent, projectId);
  const resting = useCampusStore((s) => Boolean(s.restingAgentIds[agent.id]));
  const selectAgent = useCampusStore((s) => s.selectAgent);
  const followAgent = useCampusStore((s) => s.followAgent);
  const selectedAgentId = useCampusStore((s) => s.selection.selectedAgentId);
  const north = roomPlacement(projectIndex).north;

  const target = useMemo<[number, number, number]>(() => {
    if (ambient && !resting && location === 'desk') {
      const spot = ambientSpot(ambient.key, deskIndex + crowd.index + 1, projectIndex, projectCount);
      if (spot) return spot;
    }
    return agentWorldTarget(location, projectIndex, deskIndex, crowd.index, crowd.count);
  }, [ambient?.key, resting, location, deskIndex, crowd.index, crowd.count, projectIndex, projectCount]);

  return (
    <AgentAvatar
      agent={agent}
      visualState={visualState}
      ambient={ambient}
      resting={resting}
      target={target}
      restFacingY={restFacing(location, north)}
      selected={selectedAgentId === agent.id}
      onSelect={() => selectAgent(agent.id)}
      onFollow={() => followAgent(agent.id)}
    />
  );
}
