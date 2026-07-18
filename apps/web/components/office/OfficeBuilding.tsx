'use client';

import { PALETTE } from '../../lib/theme';
import {
  buildingBounds, HALL_HALF, REVIEW_SCREEN, CORE_LEN, ROOMS_X0,
} from '../../selectors/office-layout';

const WALL_H = 2.4;
const WALL_T = 0.18;

function Wall({ cx, cz, w, d }: { cx: number; cz: number; w: number; d: number }) {
  return (
    <mesh position={[cx, WALL_H / 2, cz]} castShadow receiveShadow>
      <boxGeometry args={[w, WALL_H, d]} />
      <meshStandardMaterial color={PALETTE.wall} roughness={0.9} />
    </mesh>
  );
}

function Sofa({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.35, 0]} castShadow>
        <boxGeometry args={[4.4, 0.5, 1.4]} />
        <meshStandardMaterial color={PALETTE.sofa} roughness={0.95} />
      </mesh>
      <mesh position={[0, 0.75, -0.55]} castShadow>
        <boxGeometry args={[4.4, 0.7, 0.3]} />
        <meshStandardMaterial color={PALETTE.sofa} roughness={0.95} />
      </mesh>
    </group>
  );
}

function CoffeeMachine({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.55, 0]} castShadow>
        <boxGeometry args={[0.9, 1.1, 0.7]} />
        <meshStandardMaterial color={PALETTE.deskWoodDark} roughness={0.85} />
      </mesh>
      <mesh position={[0, 1.35, 0]} castShadow>
        <boxGeometry args={[0.5, 0.5, 0.45]} />
        <meshStandardMaterial color={PALETTE.coffeeMachine} roughness={0.6} />
      </mesh>
    </group>
  );
}

function Plant({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.25, 0]} castShadow>
        <cylinderGeometry args={[0.28, 0.34, 0.5, 10]} />
        <meshStandardMaterial color={PALETTE.pot} roughness={1} />
      </mesh>
      <mesh position={[0, 0.85, 0]} castShadow>
        <sphereGeometry args={[0.5, 10, 10]} />
        <meshStandardMaterial color={PALETTE.foliage} roughness={1} />
      </mesh>
    </group>
  );
}

/** Big shared review screen on the core's north wall -- checking agents walk here. */
function ReviewWall({ checking }: { checking: boolean }) {
  return (
    <group position={[REVIEW_SCREEN[0], 0, REVIEW_SCREEN[2] - 0.4]}>
      <mesh position={[0, 1.7, 0]} castShadow>
        <boxGeometry args={[5.2, 2.4, 0.2]} />
        <meshStandardMaterial color={PALETTE.screenFrame} roughness={0.6} />
      </mesh>
      <mesh position={[0, 1.7, 0.12]}>
        <planeGeometry args={[4.7, 1.9]} />
        <meshStandardMaterial
          color={checking ? '#d69a3c' : '#1d2733'}
          emissive={checking ? '#d69a3c' : '#000000'}
          emissiveIntensity={checking ? 0.45 : 0}
        />
      </mesh>
    </group>
  );
}

/**
 * The lab shell: one floor slab, darker hallway strip, low outer walls (roofless -- the
 * isometric camera looks in from above) and the entrance-core furniture. Rooms come from
 * OfficeRoom; agents from the scene.
 */
export function OfficeBuilding({ projectCount, anyChecking }: { projectCount: number; anyChecking: boolean }) {
  const b = buildingBounds(projectCount);
  const w = b.maxX - b.minX;
  const d = b.maxZ - b.minZ;
  const cx = (b.minX + b.maxX) / 2;

  return (
    <group>
      {/* floor slab */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0, 0]} receiveShadow>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color={PALETTE.officeFloor} roughness={1} />
      </mesh>
      {/* hallway strip */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0.01, 0]} receiveShadow>
        <planeGeometry args={[w, HALL_HALF * 2]} />
        <meshStandardMaterial color={PALETTE.hallwayFloor} roughness={1} />
      </mesh>
      {/* lounge rug */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-CORE_LEN / 2, 0.02, 5.4]} receiveShadow>
        <circleGeometry args={[3.4, 24]} />
        <meshStandardMaterial color={PALETTE.rug} roughness={1} />
      </mesh>

      {/* outer walls */}
      <Wall cx={cx} cz={b.minZ} w={w} d={WALL_T} />
      <Wall cx={cx} cz={b.maxZ} w={w} d={WALL_T} />
      <Wall cx={b.minX} cz={0} w={WALL_T} d={d} />
      <Wall cx={b.maxX} cz={0} w={WALL_T} d={d} />
      {/* wall separating core from the first room pair (leaves the hallway open) */}
      <Wall cx={ROOMS_X0 - 0.5} cz={-(HALL_HALF + (d / 2 - HALL_HALF) / 2)} w={WALL_T} d={d / 2 - HALL_HALF} />
      <Wall cx={ROOMS_X0 - 0.5} cz={HALL_HALF + (d / 2 - HALL_HALF) / 2} w={WALL_T} d={d / 2 - HALL_HALF} />

      {/* core furniture */}
      <ReviewWall checking={anyChecking} />
      <Sofa position={[-7.2, 0, 6.2]} />
      <CoffeeMachine position={[-11.5, 0, 5.6]} />
      <Plant position={[-3.4, 0, 6.4]} />
      <Plant position={[-12.6, 0, 6.4]} />
    </group>
  );
}
