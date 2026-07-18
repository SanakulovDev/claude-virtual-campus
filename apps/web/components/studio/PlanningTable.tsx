'use client';

import { PALETTE } from '../../lib/theme';

/** Shared planning table near the back of the studio. One table for the whole studio -- no
 * per-task planning stations. */
export function PlanningTable({ active, position }: { active: boolean; position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.75, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[1.7, 1.7, 0.16, 32]} />
        <meshStandardMaterial color={PALETTE.planningTable} roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.4, 0]} castShadow>
        <cylinderGeometry args={[0.25, 0.35, 0.8, 12]} />
        <meshStandardMaterial color={PALETTE.tableLeg} roughness={0.8} />
      </mesh>
      {active && (
        <mesh position={[0, 0.86, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.75, 2.0, 32]} />
          <meshStandardMaterial color={PALETTE.planningTable} emissive="#8b7fd6" emissiveIntensity={0.5} />
        </mesh>
      )}
    </group>
  );
}
