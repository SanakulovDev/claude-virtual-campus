'use client';

import { useMemo } from 'react';
import { Text } from '@react-three/drei';
import { MEDIUM_ROOM_ZONES, OFFICE_ZONE_KEYS, type OfficeZoneKey } from '@campus/contracts';
import { OfficeZone } from './OfficeZone';
import { AgentAvatar } from '../agents/AgentAvatar';
import { useCampusStore } from '../../stores/campusStore';
import type { ProjectRow } from '../../lib/types';

const TEMPLATE_SCALE: Record<ProjectRow['roomTemplate'], number> = { SMALL: 0.85, MEDIUM: 1, LARGE: 1.3 };
const ROOM_FLOOR_SIZE = 16;

interface ProjectRoomProps {
  project: ProjectRow;
  position: [number, number, number];
}

export function ProjectRoom({ project, position }: ProjectRoomProps) {
  const scale = TEMPLATE_SCALE[project.roomTemplate];
  const selection = useCampusStore((s) => s.selection);
  const selectProject = useCampusStore((s) => s.selectProject);
  const selectAgent = useCampusStore((s) => s.selectAgent);
  const focusProjectRoom = useCampusStore((s) => s.focusProjectRoom);

  const agentsByZone = useMemo(() => {
    const map = new Map<OfficeZoneKey, typeof project.agents>();
    for (const agent of project.agents) {
      const list = map.get(agent.currentZoneKey) ?? [];
      list.push(agent);
      map.set(agent.currentZoneKey, list);
    }
    return map;
  }, [project.agents]);

  const isSelected = selection.selectedProjectId === project.id;
  const techLine = project.technologies.length > 0
    ? project.technologies.slice(0, 4).map((t) => t.displayName).join(' / ')
    : 'No technology detected yet';

  return (
    <group
      position={position}
      scale={scale}
      onClick={(e) => {
        e.stopPropagation();
        selectProject(project.id);
        focusProjectRoom(project.id);
      }}
    >
      {/* floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[ROOM_FLOOR_SIZE, ROOM_FLOOR_SIZE]} />
        <meshStandardMaterial color={isSelected ? '#1e293b' : '#161a23'} />
      </mesh>

      {/* cutaway back walls */}
      <mesh position={[0, 1.5, -ROOM_FLOOR_SIZE / 2]}>
        <boxGeometry args={[ROOM_FLOOR_SIZE, 3, 0.2]} />
        <meshStandardMaterial color="#22283a" />
      </mesh>
      <mesh position={[-ROOM_FLOOR_SIZE / 2, 1.5, 0]}>
        <boxGeometry args={[0.2, 3, ROOM_FLOOR_SIZE]} />
        <meshStandardMaterial color="#22283a" />
      </mesh>

      {/* sign */}
      <Text position={[0, 3.2, -ROOM_FLOOR_SIZE / 2 + 0.3]} fontSize={0.5} color="white" anchorX="center">
        {project.name}
      </Text>
      <Text position={[0, 2.6, -ROOM_FLOOR_SIZE / 2 + 0.3]} fontSize={0.22} color="#94a3b8" anchorX="center">
        {techLine}
      </Text>

      {OFFICE_ZONE_KEYS.map((zoneKey) => (
        <OfficeZone key={zoneKey} zoneKey={zoneKey} position={MEDIUM_ROOM_ZONES[zoneKey]} />
      ))}

      {Array.from(agentsByZone.entries()).flatMap(([zoneKey, agents]) =>
        agents.map((agent, index) => {
          const base = MEDIUM_ROOM_ZONES[zoneKey];
          const angle = (index / Math.max(agents.length, 1)) * Math.PI * 2;
          const offsetRadius = agents.length > 1 ? 0.6 : 0;
          const targetPosition: [number, number, number] = [
            base[0] + Math.cos(angle) * offsetRadius,
            0,
            base[2] + 1 + Math.sin(angle) * offsetRadius,
          ];
          return (
            <AgentAvatar
              key={agent.id}
              agent={agent}
              targetPosition={targetPosition}
              selected={selection.selectedAgentId === agent.id}
              onSelect={() => selectAgent(agent.id)}
            />
          );
        }),
      )}
    </group>
  );
}

export { ROOM_FLOOR_SIZE };
