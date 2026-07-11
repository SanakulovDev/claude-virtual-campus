import * as THREE from 'three';
import { Pathfinding } from 'three-pathfinding';
import type { Vec3 } from '../selectors/campus-world-layout';

const ZONE = 'campus';
const pathfinding = new Pathfinding();
let ready = false;

/** Build the navmesh zone once from the authored nav ground geometry. */
export function buildCampusZone(ground: THREE.BufferGeometry): void {
  pathfinding.setZoneData(ZONE, Pathfinding.createZone(ground));
  ready = true;
}

/** Path between two world points along the navmesh, or a straight segment if not ready. */
export function findCampusPath(from: Vec3, to: Vec3): Vec3[] {
  if (!ready) return [from, to];
  const start = new THREE.Vector3(...from);
  const end = new THREE.Vector3(...to);
  const group = pathfinding.getGroup(ZONE, start);
  const path = pathfinding.findPath(start, end, ZONE, group);
  if (!path || path.length === 0) return [from, to];
  return path.map((p) => [p.x, p.y, p.z] as Vec3);
}

/** Pure follower: advance `step` metres from `current` toward the next unreached corner. */
export function nextPathPoint(
  path: Vec3[],
  current: Vec3,
  step: number,
): { point: Vec3; index: number; arrived: boolean } {
  if (path.length === 0) return { point: current, index: 0, arrived: true };
  const target = path[path.length - 1]!;
  const dx = target[0] - current[0];
  const dz = target[2] - current[2];
  const dist = Math.hypot(dx, dz);
  if (dist <= step || dist === 0) return { point: [target[0], current[1], target[2]], index: path.length - 1, arrived: true };
  const k = step / dist;
  return { point: [current[0] + dx * k, current[1], current[2] + dz * k], index: path.length - 1, arrived: false };
}
