'use client';

import { RoundedBox } from '@react-three/drei';
import { PALETTE } from '../../lib/theme';

export type DeskMonitorKind = 'off' | 'reading' | 'coding' | 'command' | 'database' | 'documentation' | 'infrastructure';

const MONITOR_COLOR: Record<DeskMonitorKind, string> = {
  off: '#2b303a',
  reading: '#3fb6d8',
  coding: '#4fbf7f',
  command: '#8a93a0',
  database: '#e07fb0',
  documentation: '#c9b45f',
  infrastructure: '#d68a5a',
};

/** Light-wood desk with a dark monitor. The monitor tint communicates the work kind so an
 * agent reading vs. coding vs. running a command reads differently WITHOUT walking off to a
 * separate station. */
export function AgentDesk({ position, monitor }: { position: [number, number, number]; monitor: DeskMonitorKind }) {
  const screen = MONITOR_COLOR[monitor];
  const lit = monitor !== 'off';
  return (
    <group position={position}>
      {/* desktop */}
      <RoundedBox args={[2.2, 0.14, 1.2]} radius={0.05} position={[0, 0.95, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={PALETTE.deskWood} roughness={0.85} />
      </RoundedBox>
      {[-0.9, 0.9].map((x) => (
        <mesh key={x} position={[x, 0.47, 0]} castShadow>
          <boxGeometry args={[0.14, 0.9, 1.0]} />
          <meshStandardMaterial color={PALETTE.deskWoodDark} roughness={0.85} />
        </mesh>
      ))}
      {/* monitor, faces the seat (-Z where the avatar stands is +Z side; screen faces +Z toward front) */}
      <mesh position={[0, 1.45, -0.35]} castShadow>
        <boxGeometry args={[1.3, 0.75, 0.08]} />
        <meshStandardMaterial color={PALETTE.monitor} roughness={0.5} />
      </mesh>
      <mesh position={[0, 1.45, -0.31]}>
        <planeGeometry args={[1.14, 0.6]} />
        <meshStandardMaterial color={screen} emissive={screen} emissiveIntensity={lit ? 0.6 : 0.05} />
      </mesh>
      <mesh position={[0, 1.05, -0.35]} castShadow>
        <cylinderGeometry args={[0.06, 0.1, 0.2, 8]} />
        <meshStandardMaterial color={PALETTE.monitor} />
      </mesh>

      {/* flanking side monitors, angled inward toward the main screen */}
      {[-0.72, 0.72].map((x) => (
        <group key={x}>
          <mesh position={[x, 1.4, -0.28]} rotation={[0, x < 0 ? 0.35 : -0.35, 0]} castShadow>
            <boxGeometry args={[0.55, 0.34, 0.05]} />
            <meshStandardMaterial color={PALETTE.monitor} roughness={0.5} />
          </mesh>
          <mesh position={[x, 1.4, -0.28]} rotation={[0, x < 0 ? 0.35 : -0.35, 0]}>
            <planeGeometry args={[0.46, 0.26]} />
            <meshStandardMaterial color={screen} emissive={screen} emissiveIntensity={lit ? 0.5 : 0.05} />
          </mesh>
        </group>
      ))}

      {/* office chair, pushed in beside the desk -- clear of the desktop footprint (|x| > 1.1)
          and clear of the avatar's stand spot in front of the desk (desk z + 0.95) */}
      <group position={[1.4, 0, 0.25]}>
        <mesh position={[0, 0.5, 0]} castShadow>
          <boxGeometry args={[0.5, 0.08, 0.5]} />
          <meshStandardMaterial color={PALETTE.reviewFrame} roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.8, 0.24]} castShadow>
          <boxGeometry args={[0.5, 0.6, 0.08]} />
          <meshStandardMaterial color={PALETTE.reviewFrame} roughness={0.6} />
        </mesh>
        <mesh position={[0, 0.26, 0]}>
          <cylinderGeometry args={[0.04, 0.04, 0.5, 8]} />
          <meshStandardMaterial color={PALETTE.tableLeg} />
        </mesh>
      </group>
    </group>
  );
}
