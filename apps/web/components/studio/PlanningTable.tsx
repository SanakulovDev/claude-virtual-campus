'use client';

import { PALETTE, STATE_COLOR } from '../../lib/theme';

/** Shared planning table per bay: a dark round holo-table whose rim lights up while the
 * team is planning. One table for the whole bay -- no per-task planning stations. */
export function PlanningTable({ active, position }: { active: boolean; position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.75, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.7, 1.7, 0.14, 32]} />
        <meshStandardMaterial color={PALETTE.planningTable} roughness={0.6} metalness={0.2} />
      </mesh>
      <mesh position={[0, 0.4, 0]} castShadow>
        <cylinderGeometry args={[0.25, 0.35, 0.8, 12]} />
        <meshStandardMaterial color={PALETTE.tableLeg} roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.83, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.5, 1.62, 32]} />
        <meshStandardMaterial
          color={PALETTE.tableLeg}
          emissive={STATE_COLOR.planning}
          emissiveIntensity={active ? 0.9 : 0.08}
          toneMapped={false}
        />
      </mesh>
    </group>
  );
}
