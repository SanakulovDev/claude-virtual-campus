'use client';

import { PALETTE } from '../../lib/theme';

/** Ground, sky colour, fog and lighting for the whole campus. Warm, soft, low-contrast --
 * a lit architectural model, not a dark game level. No textures or external HDRs. */
export function CampusEnvironment() {
  return (
    <>
      <color attach="background" args={[PALETTE.sceneBackground]} />
      <fog attach="fog" args={[PALETTE.sceneBackground, 90, 240]} />

      <hemisphereLight args={['#ffffff', '#c8ccd2', 0.85]} />
      <ambientLight intensity={0.25} />
      <directionalLight
        position={[60, 90, 40]}
        intensity={1.1}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={1}
        shadow-camera-far={400}
        shadow-camera-left={-160}
        shadow-camera-right={160}
        shadow-camera-top={160}
        shadow-camera-bottom={-160}
        shadow-bias={-0.0004}
      />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
        <circleGeometry args={[240, 64]} />
        <meshStandardMaterial color={PALETTE.ground} roughness={1} />
      </mesh>
    </>
  );
}
