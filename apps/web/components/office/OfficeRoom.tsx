'use client';

import { useMemo } from 'react';
import { Html } from '@react-three/drei';
import { PALETTE, STATE_COLOR, STATE_ICON, STATE_LABEL, HTML_Z_RANGE } from '../../lib/theme';
import { useKioskMode } from '../../hooks/useKioskMode';
import type { AgentRow, ProjectRow } from '../../lib/types';
import { roomPlacement, deskLocal, tableLocal, ROOM_W, ROOM_D } from '../../selectors/office-layout';
import { selectProjectVisualState } from '../../selectors/project-status.selector';
import { selectAgentVisualState } from '../../selectors/visual-state.selector';
import { assignDesks } from '../../selectors/desk-assignment';
import { AgentDesk, type DeskMonitorKind } from '../studio/AgentDesk';
import { PlanningTable } from '../studio/PlanningTable';

const WALL_H = 2.2;
const WALL_T = 0.14;
const DOOR_W = 2.4;

function monitorKind(agent: AgentRow): DeskMonitorKind {
  if (selectAgentVisualState(agent) !== 'working') return 'off';
  switch (agent.activity) {
    case 'researching': return 'reading';
    case 'coding': case 'formatting': return 'coding';
    case 'running_command': return 'command';
    case 'managing_database': return 'database';
    case 'managing_infrastructure': return 'infrastructure';
    default: return 'coding';
  }
}

/**
 * One project's bay: dark partitions with a glass rim and an open doorway onto the
 * hallway, a name plate + status strip above the door, workstations and a planning table.
 * Renders NO agents -- robots are scene-level so they can glide between bays.
 */
export function OfficeRoom({
  project, index, detail, onSelect,
}: {
  project: ProjectRow;
  index: number;
  detail: 'full' | 'reduced';
  onSelect: () => void;
}) {
  const kiosk = useKioskMode();
  const placement = useMemo(() => roomPlacement(index), [index]);
  const state = selectProjectVisualState(project.agents);
  const assigned = useMemo(() => assignDesks(project.agents), [project.agents]);

  const halfW = ROOM_W / 2;
  const halfD = ROOM_D / 2;
  const sideWallLen = (ROOM_W - DOOR_W) / 2;

  return (
    <group position={placement.center} rotation={[0, placement.rotationY, 0]}>
      {/* click plane to select the project */}
      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}
        onClick={(e) => { e.stopPropagation(); onSelect(); }}>
        <planeGeometry args={[ROOM_W, ROOM_D]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      {/* back wall (solid) + side partitions (glass) + front wall with doorway gap */}
      <mesh position={[0, WALL_H / 2, -halfD]} castShadow>
        <boxGeometry args={[ROOM_W, WALL_H, WALL_T]} />
        <meshStandardMaterial color={PALETTE.partition} roughness={0.9} />
      </mesh>
      {[-halfW, halfW].map((x) => (
        <group key={x}>
          <mesh position={[x, WALL_H / 2, 0]}>
            <boxGeometry args={[WALL_T, WALL_H, ROOM_D]} />
            <meshStandardMaterial color={PALETTE.partitionGlass} transparent opacity={0.16} roughness={0.2} />
          </mesh>
          <mesh position={[x, WALL_H, 0]}>
            <boxGeometry args={[WALL_T + 0.02, 0.05, ROOM_D]} />
            <meshStandardMaterial color={PALETTE.glassEdge} emissive={PALETTE.glassEdge} emissiveIntensity={0.7} toneMapped={false} />
          </mesh>
        </group>
      ))}
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh position={[side * (DOOR_W / 2 + sideWallLen / 2), WALL_H / 2, halfD]}>
            <boxGeometry args={[sideWallLen, WALL_H, WALL_T]} />
            <meshStandardMaterial color={PALETTE.partitionGlass} transparent opacity={0.16} roughness={0.2} />
          </mesh>
          <mesh position={[side * (DOOR_W / 2 + sideWallLen / 2), WALL_H, halfD]}>
            <boxGeometry args={[sideWallLen, 0.05, WALL_T + 0.02]} />
            <meshStandardMaterial color={PALETTE.glassEdge} emissive={PALETTE.glassEdge} emissiveIntensity={0.7} toneMapped={false} />
          </mesh>
        </group>
      ))}
      {/* status strip above the doorway */}
      <mesh position={[0, WALL_H + 0.12, halfD]}>
        <boxGeometry args={[DOOR_W + 0.4, 0.24, WALL_T + 0.04]} />
        <meshStandardMaterial color={STATE_COLOR[state]} emissive={STATE_COLOR[state]} emissiveIntensity={0.6} toneMapped={false} />
      </mesh>

      {/* name plate above the door -- screen-space Html, so it reads upright from any side */}
      <Html position={[0, WALL_H + 0.9, halfD]} center zIndexRange={HTML_Z_RANGE}>
        <button
          onClick={onSelect}
          className="pointer-events-auto whitespace-nowrap rounded border px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest"
          style={{
            background: 'rgba(10,13,18,0.82)',
            color: '#dbe1e8',
            borderColor: state === 'attention' ? STATE_COLOR.attention : 'rgba(255,255,255,0.14)',
            fontSize: kiosk ? '0.85rem' : undefined,
          }}
          title={STATE_LABEL[state]}
        >
          <span style={{ color: STATE_COLOR[state] }}>{STATE_ICON[state]}</span> {project.name}
        </button>
      </Html>

      {detail === 'full' && (
        <>
          <PlanningTable active={state === 'planning'} position={tableLocal()} />
          {assigned.map(({ agent, deskIndex }) => (
            <AgentDesk key={deskIndex} position={deskLocal(deskIndex)} monitor={monitorKind(agent)} />
          ))}
        </>
      )}
    </group>
  );
}
