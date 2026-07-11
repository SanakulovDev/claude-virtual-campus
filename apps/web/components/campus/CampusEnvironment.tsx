'use client';

import { PALETTE } from '../../lib/theme';

const ISLAND_R = 60;

/** The floating campus island: a grass top over a tapered earthy landmass, framed by soft
 * daylight and gentle fog. A lit architectural model, not a dark game level. No textures. */
export function CampusEnvironment() {
  return (
    <>
      <color attach="background" args={[PALETTE.sceneBackground]} />
      <fog attach="fog" args={[PALETTE.sceneBackground, 120, 300]} />

      <hemisphereLight args={['#fff6e8', '#b9c3cf', 0.9]} />
      <ambientLight intensity={0.28} />
      <directionalLight
        position={[70, 95, 55]}
        intensity={1.25}
        color="#fff3e2"
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
      {/* cool fill from the opposite side to keep shadows from going flat/grey */}
      <directionalLight position={[-60, 40, -50]} intensity={0.25} color="#cdd8e6" />

      {/* grass top -- lifted a hair above the earth so their faces never z-fight */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.08, 0]} receiveShadow>
        <circleGeometry args={[ISLAND_R, 96]} />
        <meshStandardMaterial color={PALETTE.grass} roughness={1} />
      </mesh>
      {/* thin grass lip so the lawn reads as soil-topped turf from the side */}
      <mesh position={[0, -0.6, 0]}>
        <cylinderGeometry args={[ISLAND_R, ISLAND_R * 0.96, 1.4, 96]} />
        <meshStandardMaterial color={PALETTE.grassEdge} roughness={1} />
      </mesh>
      {/* one smooth earthy cone -> the whole landmass tapering to a point below */}
      <mesh position={[0, -14, 0]}>
        <coneGeometry args={[ISLAND_R * 0.95, 27, 80]} />
        <meshStandardMaterial color={PALETTE.earth} roughness={1} />
      </mesh>
    </>
  );
}
