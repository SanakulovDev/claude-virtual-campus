import type { StudioLocationKey } from './visual-state.selector';
import { roomToWorld, deskLocal, tableLocal, reviewSpot } from './office-layout';

/**
 * World-space destination for an agent's committed location. Single source of truth --
 * OfficeAgent (scene) and the camera's follow mode must agree or the camera centers
 * the wrong spot.
 */
export function agentWorldTarget(
  location: StudioLocationKey,
  projectIndex: number,
  deskIndex: number,
  crowdIndex: number,
  crowdCount: number,
): [number, number, number] {
  if (location === 'review-screen') return reviewSpot(crowdIndex, crowdCount);
  if (location === 'planning-table') {
    const t = tableLocal();
    // ponytail: fan-out clamped to the room interior; >5 planners share edge spots
    const offset = Math.max(-3, Math.min(3, (crowdIndex - (crowdCount - 1) / 2) * 1.2));
    return roomToWorld(projectIndex, [t[0] + offset, 0, t[2] + 1.2]);
  }
  const d = deskLocal(deskIndex);
  return roomToWorld(projectIndex, [d[0], 0, d[2] + 0.95]);
}
