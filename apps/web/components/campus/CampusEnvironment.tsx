'use client';

import { PALETTE } from '../../lib/theme';

/** Night-ops lighting: cool dim ambience so the emissive surfaces (visors, screens, lane
 * strips) carry the scene. Fixed isometric view -- an instrument panel, not a game level. */
export function CampusEnvironment() {
  return (
    <>
      <color attach="background" args={[PALETTE.sceneBackground]} />
      <hemisphereLight args={['#6b7789', '#232a36', 1.15]} />
      <ambientLight intensity={0.6} />
      <directionalLight
        position={[40, 70, 40]}
        intensity={1.35}
        color="#dfe6f0"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={1}
        shadow-camera-far={300}
        shadow-camera-left={-140}
        shadow-camera-right={140}
        shadow-camera-top={140}
        shadow-camera-bottom={-140}
        shadow-bias={-0.0004}
      />
      <directionalLight position={[-50, 35, -40]} intensity={0.3} color="#5a6e8c" />
    </>
  );
}
