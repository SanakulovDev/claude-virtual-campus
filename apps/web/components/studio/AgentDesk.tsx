'use client';

import { RoundedBox } from '@react-three/drei';
import { PALETTE } from '../../lib/theme';

export type DeskMonitorKind = 'off' | 'reading' | 'coding' | 'command' | 'database' | 'documentation' | 'infrastructure';

const MONITOR_COLOR: Record<DeskMonitorKind, string> = {
  off: '#161b23',
  reading: '#3fb6d8',
  coding: '#3ecf8e',
  command: '#8b95a3',
  database: '#e07fb0',
  documentation: '#e0c95f',
  infrastructure: '#e0985a',
};

/** Steel workstation with a dark monitor. The monitor tint communicates the work kind so a
 * robot reading vs. coding vs. running a command reads differently WITHOUT gliding off to a
 * separate station. */
export function AgentDesk({ position, monitor }: { position: [number, number, number]; monitor: DeskMonitorKind }) {
  const screen = MONITOR_COLOR[monitor];
  const lit = monitor !== 'off';
  return (
    <group position={position}>
      {/* desktop */}
      <RoundedBox args={[2.2, 0.12, 1.2]} radius={0.04} position={[0, 0.95, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={PALETTE.deskTop} roughness={0.7} metalness={0.15} />
      </RoundedBox>
      {[-0.9, 0.9].map((x) => (
        <mesh key={x} position={[x, 0.47, 0]} castShadow>
          <boxGeometry args={[0.12, 0.9, 1.0]} />
          <meshStandardMaterial color={PALETTE.deskLeg} roughness={0.8} />
        </mesh>
      ))}
      {/* monitor, faces the seat */}
      <mesh position={[0, 1.45, -0.35]} castShadow>
        <boxGeometry args={[1.3, 0.75, 0.08]} />
        <meshStandardMaterial color={PALETTE.monitor} roughness={0.5} />
      </mesh>
      <mesh position={[0, 1.45, -0.31]}>
        <planeGeometry args={[1.14, 0.6]} />
        <meshStandardMaterial color={screen} emissive={screen} emissiveIntensity={lit ? 0.85 : 0.12} toneMapped={!lit} />
      </mesh>
      <mesh position={[0, 1.05, -0.35]} castShadow>
        <cylinderGeometry args={[0.06, 0.1, 0.2, 8]} />
        <meshStandardMaterial color={PALETTE.monitor} />
      </mesh>
      {/* console deck in front of the seat */}
      <RoundedBox args={[0.82, 0.04, 0.26]} radius={0.015} smoothness={2} position={[0, 1.03, 0.12]} castShadow>
        <meshStandardMaterial color={PALETTE.monitor} roughness={0.7} />
      </RoundedBox>
    </group>
  );
}
