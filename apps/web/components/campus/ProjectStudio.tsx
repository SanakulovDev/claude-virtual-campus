'use client';

import { useMemo } from 'react';
import { projectAccent } from '../../lib/theme';
import type { AgentRow, ProjectRow } from '../../lib/types';
import { calculateStudioPlacement, studioDetailLevel } from '../../selectors/campus-layout';
import { selectProjectVisualState } from '../../selectors/project-status.selector';
import { selectAgentVisualState, selectStudioLocation } from '../../selectors/visual-state.selector';
import { assignDesks, deskPosition, locationPosition } from '../../selectors/studio-layout';
import { summarizeAgentAction } from '../../selectors/activity-summary.selector';
import { useCampusStore } from '../../stores/campusStore';
import { useDebouncedLocation } from '../../hooks/useDebouncedLocation';
import { useAmbientActivity } from '../../hooks/useAmbientActivity';
import { StudioPlatform } from '../studio/StudioPlatform';
import { StudioSign } from '../studio/StudioSign';
import { StatusWall } from '../studio/StatusWall';
import { PlanningTable } from '../studio/PlanningTable';
import { AgentDesk, type DeskMonitorKind } from '../studio/AgentDesk';
import { ReviewScreen } from '../studio/ReviewScreen';
import { AgentAvatar } from '../agents/AgentAvatar';

const REST_FACING = { desk: Math.PI, 'planning-table': Math.PI, 'review-screen': 0, attention: Math.PI } as const;

function monitorKind(agent: AgentRow): DeskMonitorKind {
  if (selectAgentVisualState(agent) !== 'working') return 'off';
  switch (agent.activity) {
    case 'researching':
      return 'reading';
    case 'coding':
    case 'formatting':
      return 'coding';
    case 'running_command':
      return 'command';
    case 'managing_database':
      return 'database';
    case 'managing_infrastructure':
      return 'infrastructure';
    default:
      return 'coding';
  }
}

/** One agent inside a studio. Owns its own debounced location so bursts of tool events
 * don't move it. Placed among crowd-mates sharing the planning table / review screen. */
function StudioAgent({
  agent,
  projectId,
  deskIndex,
  crowd,
}: {
  agent: AgentRow;
  projectId: string;
  deskIndex: number;
  crowd: { index: number; count: number };
}) {
  const visualState = selectAgentVisualState(agent);
  const desired = selectStudioLocation(visualState);
  const location = useDebouncedLocation(desired);
  const target = locationPosition(location, deskIndex, crowd.index, crowd.count);
  const ambient = useAmbientActivity(agent, projectId);
  const resting = useCampusStore((s) => Boolean(s.restingAgentIds[agent.id]));
  const selectAgent = useCampusStore((s) => s.selectAgent);
  const followAgent = useCampusStore((s) => s.followAgent);
  const selectedAgentId = useCampusStore((s) => s.selection.selectedAgentId);

  return (
    <AgentAvatar
      agent={agent}
      visualState={visualState}
      ambient={ambient}
      resting={resting}
      target={target}
      restFacingY={REST_FACING[location]}
      selected={selectedAgentId === agent.id}
      onSelect={() => selectAgent(agent.id)}
      onFollow={() => followAgent(agent.id)}
    />
  );
}

export function ProjectStudio({ project, index }: { project: ProjectRow; index: number }) {
  const placement = useMemo(() => calculateStudioPlacement(index), [index]);
  const accent = projectAccent(project.projectKey);
  const projectState = selectProjectVisualState(project.agents);
  const selectProject = useCampusStore((s) => s.selectProject);
  const focusProject = useCampusStore((s) => s.focusProjectRoom);

  const assigned = useMemo(() => assignDesks(project.agents), [project.agents]);
  const active = projectState !== 'idle';
  const detail = studioDetailLevel(placement.ring, active);

  // crowd counts for shared locations so agents fan out instead of stacking
  const planningAgents = assigned.filter((a) => selectStudioLocation(selectAgentVisualState(a.agent)) === 'planning-table');
  const reviewAgents = assigned.filter((a) => selectStudioLocation(selectAgentVisualState(a.agent)) === 'review-screen');

  const leadAction = project.agents.length > 0 ? summarizeAgentAction(project.agents[0]!) : '';
  const techLabel = project.technologies[0]?.displayName ?? '';
  const checking = projectState === 'checking';

  const select = () => {
    selectProject(project.id);
    focusProject(project.id);
  };

  return (
    <group position={placement.position} rotation={[0, placement.rotationY, 0]}>
      <mesh
        // invisible click plane covering the studio floor to select the project
        position={[0, 0.42, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        onClick={(e) => {
          e.stopPropagation();
          select();
        }}
      >
        <planeGeometry args={[17, 16]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      <StudioPlatform accent={accent} />
      <StudioSign name={project.name} accent={accent} tech={techLabel} onSelect={select} />
      <StatusWall state={projectState} summary={leadAction} />

      {detail === 'full' && (
        <>
          <PlanningTable active={projectState === 'planning'} />
          {assigned.map(({ agent, deskIndex }) => (
            <AgentDesk key={deskIndex} position={deskPosition(deskIndex)} monitor={monitorKind(agent)} />
          ))}
          <ReviewScreen checking={checking} summary={checking ? leadAction : ''} />
        </>
      )}

      {assigned.map(({ agent, deskIndex }) => {
        const loc = selectStudioLocation(selectAgentVisualState(agent));
        const crowdList = loc === 'planning-table' ? planningAgents : loc === 'review-screen' ? reviewAgents : [];
        const crowdIndex = crowdList.findIndex((a) => a.agent.id === agent.id);
        return (
          <StudioAgent
            key={agent.id}
            agent={agent}
            projectId={project.id}
            deskIndex={deskIndex}
            crowd={{ index: crowdIndex < 0 ? 0 : crowdIndex, count: crowdList.length || 1 }}
          />
        );
      })}
    </group>
  );
}
