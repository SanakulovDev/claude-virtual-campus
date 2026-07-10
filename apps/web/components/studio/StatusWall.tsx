'use client';

import { useRef } from 'react';
import { RoundedBox, Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import type * as THREE from 'three';
import { PALETTE, STATE_COLOR, STATE_ICON, STATE_LABEL } from '../../lib/theme';
import { STUDIO_ANCHORS, STUDIO_HALF_WIDTH } from '../../selectors/studio-layout';
import type { ProjectVisualState } from '../../selectors/project-status.selector';

/**
 * Back-of-studio status wall. Shows the studio's high-level state as text + icon + a subtle
 * emissive beacon. Colour is never the only signal (spec section 11).
 */
export function StatusWall({ state, summary }: { state: ProjectVisualState; summary: string }) {
  const beaconRef = useRef<THREE.MeshStandardMaterial>(null);
  const pulsing = state === 'attention';
  useFrame(({ clock }) => {
    if (!beaconRef.current) return;
    beaconRef.current.emissiveIntensity = pulsing ? 0.4 + Math.abs(Math.sin(clock.elapsedTime * 3)) * 0.9 : 0.5;
  });

  const color = STATE_COLOR[state];
  const [wx, , wz] = STUDIO_ANCHORS.statusWall;

  return (
    <group position={[wx, 0, wz]}>
      <RoundedBox args={[STUDIO_HALF_WIDTH * 2 - 1, 3.6, 0.4]} radius={0.15} position={[0, 2.4, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={PALETTE.studioWall} roughness={0.9} />
      </RoundedBox>
      {/* beacon strip */}
      <mesh position={[0, 4.05, 0.25]}>
        <boxGeometry args={[STUDIO_HALF_WIDTH * 2 - 1.4, 0.2, 0.1]} />
        <meshStandardMaterial ref={beaconRef} color={color} emissive={color} emissiveIntensity={0.5} />
      </mesh>

      <Html position={[0, 2.6, 0.3]} center distanceFactor={22} pointerEvents="none">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '6px 14px',
            borderRadius: 10,
            background: 'rgba(255,255,255,0.9)',
            color: '#1a1d24',
            boxShadow: '0 2px 10px rgba(0,0,0,0.12)',
            whiteSpace: 'nowrap',
          }}
        >
          <span style={{ color, fontWeight: 800, fontSize: 16 }}>{STATE_ICON[state]}</span>
          <span style={{ fontWeight: 700, fontSize: 14 }}>{STATE_LABEL[state]}</span>
          {summary && <span style={{ fontSize: 12, color: '#5b616b', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}>{summary}</span>}
        </div>
      </Html>
    </group>
  );
}
