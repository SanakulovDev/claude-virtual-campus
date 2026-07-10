'use client';

import { RoundedBox } from '@react-three/drei';
import { PALETTE } from '../../lib/theme';
import { STUDIO_HALF_DEPTH, STUDIO_HALF_WIDTH } from '../../selectors/studio-layout';

const W = STUDIO_HALF_WIDTH * 2 + 1;
const D = STUDIO_HALF_DEPTH * 2 + 1;
const POST_H = 4.2;

function Post({ x, z }: { x: number; z: number }) {
  return (
    <mesh position={[x, POST_H / 2, z]} castShadow>
      <cylinderGeometry args={[0.16, 0.16, POST_H, 10]} />
      <meshStandardMaterial color={PALETTE.studioTrim} roughness={0.8} />
    </mesh>
  );
}

/**
 * Open studio shell: a raised rounded floor, a low glass-topped rail on the two side edges,
 * corner posts and a light ceiling frame. Deliberately NOT an enclosed box -- the front
 * (+Z, toward the campus edge) and most of the volume stay open for the isometric camera.
 */
export function StudioPlatform({ accent }: { accent: string }) {
  return (
    <group>
      {/* floor */}
      <RoundedBox args={[W, 0.4, D]} radius={0.3} position={[0, 0.2, 0]} receiveShadow castShadow>
        <meshStandardMaterial color={PALETTE.studioPlatform} roughness={0.95} />
      </RoundedBox>
      {/* accent inlay near the front edge */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.41, D / 2 - 0.6]}>
        <planeGeometry args={[W - 1.5, 0.35]} />
        <meshStandardMaterial color={accent} roughness={0.7} />
      </mesh>

      {/* low side rails (glass) */}
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * (W / 2 - 0.1), 1.1, -1]} castShadow>
          <boxGeometry args={[0.12, 1.6, D - 3]} />
          <meshStandardMaterial color={PALETTE.glass} transparent opacity={0.22} roughness={0.1} />
        </mesh>
      ))}

      {/* corner posts */}
      <Post x={-W / 2 + 0.3} z={-D / 2 + 0.3} />
      <Post x={W / 2 - 0.3} z={-D / 2 + 0.3} />
      <Post x={-W / 2 + 0.3} z={D / 2 - 0.3} />
      <Post x={W / 2 - 0.3} z={D / 2 - 0.3} />

      {/* light ceiling frame (open) */}
      <group position={[0, POST_H, 0]}>
        {[-1, 1].map((s) => (
          <mesh key={`x${s}`} position={[s * (W / 2 - 0.3), 0, 0]} castShadow>
            <boxGeometry args={[0.18, 0.18, D - 0.6]} />
            <meshStandardMaterial color={PALETTE.studioTrim} roughness={0.8} />
          </mesh>
        ))}
        {[-1, 1].map((s) => (
          <mesh key={`z${s}`} position={[0, 0, s * (D / 2 - 0.3)]} castShadow>
            <boxGeometry args={[W - 0.6, 0.18, 0.18]} />
            <meshStandardMaterial color={PALETTE.studioTrim} roughness={0.8} />
          </mesh>
        ))}
      </group>
    </group>
  );
}
