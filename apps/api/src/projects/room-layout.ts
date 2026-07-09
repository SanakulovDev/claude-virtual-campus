import type { RoomTemplate } from '@prisma/client';

const COLUMNS = 3;
const SPACING_X = 22;
const SPACING_Z = 18;

/** Deterministic grid position for a project room, per spec section 20. */
export function calculateRoomPosition(index: number): { x: number; z: number } {
  return {
    x: (index % COLUMNS) * SPACING_X,
    z: Math.floor(index / COLUMNS) * SPACING_Z,
  };
}

export function calculateRoomTemplate(agentCount: number): RoomTemplate {
  if (agentCount >= 9) return 'LARGE';
  if (agentCount >= 4) return 'MEDIUM';
  return 'SMALL';
}
