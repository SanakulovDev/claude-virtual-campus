'use client';

import { PALETTE } from '../../lib/theme';
import {
  buildingBounds, HALL_HALF, REVIEW_SCREEN, CORE_LEN,
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

/** Server rack: dark cabinet with a strip of small status LEDs on the face. */
function ServerRack({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.9, 0]} castShadow>
        <boxGeometry args={[1.0, 1.8, 0.8]} />
        <meshStandardMaterial color={PALETTE.rack} roughness={0.7} metalness={0.2} />
      </mesh>
      <mesh position={[0, 0.9, 0.41]}>
        <planeGeometry args={[0.86, 1.64]} />
        <meshStandardMaterial color={PALETTE.rackFace} roughness={0.6} />
      </mesh>
      {[0.5, 0.9, 1.3].map((y, i) => (
        <mesh key={y} position={[-0.25, y, 0.42]}>
          <planeGeometry args={[0.18, 0.04]} />
          <meshStandardMaterial
            color={i === 1 ? '#3ecf8e' : '#2c3644'}
            emissive={i === 1 ? '#3ecf8e' : '#2c3644'}
            emissiveIntensity={i === 1 ? 0.9 : 0.4}
            toneMapped={false}
          />
        </mesh>
      ))}
    </group>
  );
}

/** Big shared review screen on the core's north wall -- checking agents glide here. */
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
          color={checking ? '#f2b23c' : '#141a23'}
          emissive={checking ? '#f2b23c' : '#1c2530'}
          emissiveIntensity={checking ? 0.5 : 0.25}
        />
      </mesh>
    </group>
  );
}

/**
 * The lab shell: dark floor slab, a lit hallway spine with emissive lane strips, low outer
 * walls (roofless -- the isometric camera looks in from above) and a server-rack core.
 * Rooms come from OfficeRoom; robots from the scene.
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
        <meshStandardMaterial color={PALETTE.floor} roughness={1} />
      </mesh>
      {/* hallway strip + emissive lane edges */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0.01, 0]} receiveShadow>
        <planeGeometry args={[w, HALL_HALF * 2]} />
        <meshStandardMaterial color={PALETTE.hallwayFloor} roughness={1} />
      </mesh>
      {[-HALL_HALF, HALL_HALF].map((z) => (
        <mesh key={z} rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0.02, z]}>
          <planeGeometry args={[w, 0.1]} />
          <meshStandardMaterial color={PALETTE.laneGlow} emissive={PALETTE.laneGlow} emissiveIntensity={0.8} toneMapped={false} />
        </mesh>
      ))}

      {/* outer walls */}
      <Wall cx={cx} cz={b.minZ} w={w} d={WALL_T} />
      <Wall cx={cx} cz={b.maxZ} w={w} d={WALL_T} />
      <Wall cx={b.minX} cz={0} w={WALL_T} d={d} />
      <Wall cx={b.maxX} cz={0} w={WALL_T} d={d} />

      {/* core: shared review wall + server racks along the south side */}
      <ReviewWall checking={anyChecking} />
      {[-11.8, -10.4, -9.0].map((x) => (
        <ServerRack key={x} position={[x, 0, 6.2]} />
      ))}
      <ServerRack position={[-CORE_LEN + 0.9, 0, -5.8]} />
    </group>
  );
}
