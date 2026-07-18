import { roomPlacement, zoneAt } from './office-layout';

type V3 = [number, number, number];

/**
 * Waypoint path from `from` to `to` through the office. No navmesh: rooms open onto the
 * hallway, the core opens onto the hallway, so every route is at most
 * own-door -> hallway lane -> destination door -> target. `lane` (from laneFor) offsets
 * the hallway leg so concurrent walkers don't share one line. The path always ends
 * exactly at `to`; a same-zone move is just [to].
 */
export function routeBetween(from: V3, to: V3, lane: number): V3[] {
  const fromZone = zoneAt(from[0], from[2]);
  const toZone = zoneAt(to[0], to[2]);

  // Same room, or hallway<->hallway: walk straight there.
  if (fromZone.kind === toZone.kind) {
    if (fromZone.kind !== 'room') return [to];
    if (fromZone.index === (toZone as { index: number }).index) return [to];
  }

  const path: V3[] = [];
  let entryX = from[0];
  if (fromZone.kind === 'room') {
    const door = roomPlacement(fromZone.index).door;
    path.push([door[0], 0, door[2]]);
    entryX = door[0];
  }

  let exitX = to[0];
  let exitDoor: V3 | null = null;
  if (toZone.kind === 'room') {
    const door = roomPlacement(toZone.index).door;
    exitDoor = [door[0], 0, door[2]];
    exitX = door[0];
  }

  // Hallway leg along the lane, only when there is actual x distance to cover.
  if (Math.abs(exitX - entryX) > 0.5) {
    path.push([entryX, 0, lane]);
    path.push([exitX, 0, lane]);
  }

  if (exitDoor) path.push(exitDoor);
  path.push(to);
  return path;
}
