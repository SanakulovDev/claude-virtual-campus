'use client';

import { Text } from '@react-three/drei';
import type { OfficeZoneKey } from '@campus/contracts';

const ZONE_STYLE: Record<OfficeZoneKey, { color: string; label: string }> = {
  entrance: { color: '#475569', label: 'Entrance' },
  'planning-table': { color: '#8b5cf6', label: 'Planning' },
  'assigned-desk': { color: '#64748b', label: 'Desk' },
  'development-desk': { color: '#22c55e', label: 'Dev Desk' },
  'research-station': { color: '#0ea5e9', label: 'Research' },
  'testing-station': { color: '#f59e0b', label: 'Testing' },
  'build-station': { color: '#fb923c', label: 'Build' },
  'review-station': { color: '#c084fc', label: 'Review' },
  'database-station': { color: '#ec4899', label: 'Database' },
  'infrastructure-station': { color: '#ef4444', label: 'Infra' },
  'terminal-station': { color: '#94a3b8', label: 'Terminal' },
  'meeting-table': { color: '#a78bfa', label: 'Meeting' },
  'approval-desk': { color: '#f43f5e', label: 'Approval' },
  'task-board': { color: '#22d3ee', label: 'Task Board' },
};

/**
 * ponytail: spec names 12+ distinct station components (PlanningTable, ResearchStation,
 * TestingStation, ...); a single data-driven zone renderer covers all of them with the
 * same geometry, styled by zoneKey. Split into real per-station components when one of
 * them actually needs distinct geometry/behavior, not just a color/label.
 */
export function OfficeZone({ zoneKey, position }: { zoneKey: OfficeZoneKey; position: [number, number, number] }) {
  const style = ZONE_STYLE[zoneKey];
  return (
    <group position={position}>
      <mesh position={[0, 0.4, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.4, 0.8, 0.8]} />
        <meshStandardMaterial color={style.color} />
      </mesh>
      <Text position={[0, 0.85, 0.41]} fontSize={0.16} color="white" anchorX="center" anchorY="middle">
        {style.label}
      </Text>
    </group>
  );
}
