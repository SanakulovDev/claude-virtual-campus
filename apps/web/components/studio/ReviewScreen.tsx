'use client';

import { RoundedBox, Html } from '@react-three/drei';
import { PALETTE, STATE_COLOR } from '../../lib/theme';
import { STUDIO_ANCHORS, STUDIO_HALF_WIDTH } from '../../selectors/studio-layout';

/** One shared review/checking screen for the whole studio. Test/build/lint/review status
 * shows here instead of at separate testing/build/lint/review stations. */
export function ReviewScreen({ checking, summary }: { checking: boolean; summary: string }) {
  const [x, , z] = STUDIO_ANCHORS.reviewScreen;
  const color = checking ? STATE_COLOR.checking : '#3a4150';
  return (
    <group position={[x, 0, z]} rotation={[0, Math.PI, 0]}>
      {/* stand */}
      <mesh position={[0, 0.6, 0]} castShadow>
        <boxGeometry args={[0.3, 1.2, 0.3]} />
        <meshStandardMaterial color={PALETTE.reviewFrame} roughness={0.7} />
      </mesh>
      <RoundedBox args={[STUDIO_HALF_WIDTH - 1, 2.4, 0.24]} radius={0.1} position={[0, 2.4, 0]} castShadow>
        <meshStandardMaterial color={PALETTE.reviewFrame} roughness={0.6} />
      </RoundedBox>
      <mesh position={[0, 2.4, 0.14]}>
        <planeGeometry args={[STUDIO_HALF_WIDTH - 1.5, 1.9]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={checking ? 0.5 : 0.15} />
      </mesh>
      {checking && (
        <Html position={[0, 2.4, 0.2]} center distanceFactor={20} pointerEvents="none">
          <div style={{ color: '#0d1013', fontWeight: 700, fontSize: 13, whiteSpace: 'nowrap' }}>{summary || 'Checking…'}</div>
        </Html>
      )}
    </group>
  );
}
