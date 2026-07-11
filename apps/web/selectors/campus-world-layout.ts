import { calculateStudioPlacement } from './campus-layout';
import { deskPosition } from './studio-layout';
import { STUDIO_ANCHORS } from './studio-layout';

export type Vec3 = [number, number, number];

/** Rotate a studio-local point by the studio's Y rotation and translate to its world origin. */
function toWorld(studioIndex: number, local: Vec3): Vec3 {
  const { position, rotationY } = calculateStudioPlacement(studioIndex);
  const cos = Math.cos(rotationY);
  const sin = Math.sin(rotationY);
  const x = local[0] * cos + local[2] * sin;
  const z = -local[0] * sin + local[2] * cos;
  return [position[0] + x, position[1] + local[1], position[2] + z];
}

export function worldDeskPosition(studioIndex: number, deskIndex: number): Vec3 {
  return toWorld(studioIndex, deskPosition(deskIndex));
}

export function worldRoomTable(studioIndex: number): Vec3 {
  return toWorld(studioIndex, STUDIO_ANCHORS.planningTable);
}

/** World-space courtyard activity spots (the central hub area, radius < studio ring). */
export const COURTYARD_ANCHORS: Record<'dining' | 'sport' | 'lounge' | 'garden', Vec3> = {
  dining: [6, 0, 4],
  sport: [6, 0, -5],
  lounge: [0, 0, -7],
  garden: [0, 0, 8],
};
