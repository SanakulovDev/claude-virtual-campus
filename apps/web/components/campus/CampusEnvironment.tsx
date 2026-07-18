'use client';

import { PALETTE } from '../../lib/theme';

/** Warm interior daylight for the Agent Lab. Roofless open-plan office viewed from a fixed
 * isometric angle -- an architectural model, not a game level. No textures. */
export function CampusEnvironment() {
  return (
    <>
      <color attach="background" args={[PALETTE.sceneBackground]} />
      <hemisphereLight args={['#fff6e8', '#c9c3b8', 0.85]} />
      <ambientLight intensity={0.35} />
      <directionalLight
        position={[40, 70, 40]}
        intensity={1.15}
        color="#fff3e2"
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
      <directionalLight position={[-50, 35, -40]} intensity={0.25} color="#cdd8e6" />
    </>
  );
}
