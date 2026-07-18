/**
 * World-space floorplan of the Agent Lab: one building, hallway spine along X, entrance
 * core (lounge + shared review) at negative X, project rooms attached in pairs north/south
 * of the hallway. Everything is derived from the project array index -- stable across
 * restarts, no persisted positions (the DB's roomPositionX/Z stay ignored).
 */

export const HALL_HALF = 3;
export const ROOM_W = 16;
export const ROOM_D = 12;
export const ROOM_GAP = 0.6;
export const ROOMS_X0 = 2;
export const CORE_LEN = 14;
const MARGIN = 1;

export interface RoomPlacement {
  center: [number, number, number];
  rotationY: number;
  door: [number, number, number];
  north: boolean;
  pair: number;
}

export function roomPlacement(index: number): RoomPlacement {
  const pair = Math.floor(index / 2);
  const north = index % 2 === 0;
  const x = ROOMS_X0 + pair * (ROOM_W + ROOM_GAP) + ROOM_W / 2;
  const z = (HALL_HALF + ROOM_D / 2) * (north ? -1 : 1);
  return {
    center: [x, 0, z],
    rotationY: north ? 0 : Math.PI,
    door: [x, 0, north ? -HALL_HALF : HALL_HALF],
    north,
    pair,
  };
}

/** Room-local -> world. Local +Z is the door wall (toward the hallway) on both sides. */
export function roomToWorld(index: number, local: [number, number, number]): [number, number, number] {
  const p = roomPlacement(index);
  if (p.north) return [p.center[0] + local[0], local[1], p.center[2] + local[2]];
  return [p.center[0] - local[0], local[1], p.center[2] - local[2]];
}

/** Desks fill the back half of a room (local -z), rows of 3, stable per agent. */
export function deskLocal(deskIndex: number): [number, number, number] {
  const perRow = 3;
  const row = Math.floor(deskIndex / perRow);
  const col = deskIndex % perRow;
  return [(col - 1) * 3.4 + 0.8, 0, -0.8 - row * 3.0];
}

/** Small planning table near the front-left of the room, clear of the door lane (door x=0). */
export function tableLocal(): [number, number, number] {
  return [-4.6, 0, 2.2];
}

export function buildingBounds(projectCount: number) {
  const pairs = Math.max(1, Math.ceil(projectCount / 2));
  return {
    minX: -CORE_LEN - MARGIN,
    maxX: ROOMS_X0 + pairs * (ROOM_W + ROOM_GAP) - ROOM_GAP + MARGIN,
    minZ: -(HALL_HALF + ROOM_D + MARGIN),
    maxZ: HALL_HALF + ROOM_D + MARGIN,
  };
}

export type OfficeZone = { kind: 'hallway' } | { kind: 'core' } | { kind: 'room'; index: number };

export function zoneAt(x: number, z: number): OfficeZone {
  if (Math.abs(z) <= HALL_HALF) return { kind: 'hallway' };
  if (x < ROOMS_X0) return { kind: 'core' };
  const pair = Math.floor((x - ROOMS_X0) / (ROOM_W + ROOM_GAP));
  return { kind: 'room', index: pair * 2 + (z < 0 ? 0 : 1) };
}

/** Shared review screen against the core's north wall; agents stand south of it, facing it. */
export const REVIEW_SCREEN: [number, number, number] = [-7, 0, -5.8];

export function reviewSpot(crowdIndex: number, crowdCount: number): [number, number, number] {
  const spread = Math.min(crowdCount, 5);
  const offset = (crowdIndex - (spread - 1) / 2) * 1.5;
  return [REVIEW_SCREEN[0] + offset, 0, REVIEW_SCREEN[2] + 1.8];
}

/** Fixed lounge-side furniture spots (south core). */
const AMBIENT_FIXED: Record<string, [number, number, number][]> = {
  coffee: [[-11.5, 0, 4.8]],
  sofa: [[-8.6, 0, 6.2], [-7.2, 0, 6.2], [-5.8, 0, 6.2]],
  plants: [[-3.4, 0, 6.4], [-12.6, 0, 6.4]],
  chess: [[-10.2, 0, 4.6], [-9.4, 0, 4.6]],
  pingpong: [[-10.2, 0, 4.6], [-9.4, 0, 4.6]],
  chat: [[-6.5, 0, 4.4], [-5.6, 0, 4.4]],
  stretch: [[-4.4, 0, 4.6]],
  model: [[-12.4, 0, 5.6]],
  plaza: [[-7, 0, 4.6]],
};

/**
 * World spot for an ambient activity, or null to stay at the desk. Deterministic in
 * (key, seed) so it is testable and stable within one ambient bucket. 'visit' sends the
 * agent to a guest spot in another project's room -- the cross-room life the lab is for.
 */
export function ambientSpot(
  key: string,
  seed: number,
  homeRoomIndex: number,
  projectCount: number,
): [number, number, number] | null {
  const fixed = AMBIENT_FIXED[key];
  if (fixed) return fixed[seed % fixed.length]!;
  if (key === 'walk') {
    const b = buildingBounds(projectCount);
    const x = ROOMS_X0 + (seed % Math.max(1, Math.floor(b.maxX - ROOMS_X0 - 1)));
    return [x, 0, ((seed % 3) - 1) * 1.1];
  }
  if (key === 'visit') {
    if (projectCount < 2) return null;
    const other = (homeRoomIndex + 1 + (seed % (projectCount - 1))) % projectCount;
    return roomToWorld(other, [3.8, 0, 3.4]); // guest spot just inside the door
  }
  return null; // e.g. 'reading' -- stays at the desk
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** Stable hallway lane per agent so two walkers rarely share a centerline. */
export function laneFor(agentId: string): number {
  return ((hashString(agentId) % 3) - 1) * 1.1;
}
