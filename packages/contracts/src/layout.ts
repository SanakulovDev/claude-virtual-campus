import type { OfficeZoneKey } from './enums';

const COLUMNS = 3;
const SPACING_X = 22;
const SPACING_Z = 18;

/** Deterministic grid position for a project room, shared by API (persistence) and web (3D scene). */
export function calculateRoomPosition(index: number): { x: number; z: number } {
  return {
    x: (index % COLUMNS) * SPACING_X,
    z: Math.floor(index / COLUMNS) * SPACING_Z,
  };
}

/** Zone-local offsets within a medium room, per spec section 20. Small/large scale from this. */
export const MEDIUM_ROOM_ZONES: Record<OfficeZoneKey, [number, number, number]> = {
  entrance: [0, 0, 7],
  'planning-table': [-4, 0, 3],
  'research-station': [-7, 0, -3],
  'development-desk': [1, 0, -4],
  'assigned-desk': [4, 0, -4],
  'testing-station': [7, 0, 3],
  'build-station': [7, 0, 0],
  'review-station': [7, 0, -3],
  'database-station': [-5, 0, -5],
  'infrastructure-station': [5, 0, 5],
  'terminal-station': [2, 0, 5],
  'approval-desk': [0, 0, 6],
  'task-board': [0, 0, -7],
  'meeting-table': [-2, 0, 6],
};
