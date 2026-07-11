import { describe, expect, it } from 'vitest';
import { worldDeskPosition, worldRoomTable, COURTYARD_ANCHORS } from './campus-world-layout';
import { calculateStudioPlacement } from './campus-layout';

describe('campus world layout', () => {
  it('places a desk near its studio origin in world space', () => {
    const p = calculateStudioPlacement(0);
    const desk = worldDeskPosition(0, 0);
    // desk should be within a studio-radius of the studio placement
    const dx = desk[0] - p.position[0];
    const dz = desk[2] - p.position[2];
    expect(Math.hypot(dx, dz)).toBeLessThan(12);
  });

  it('is deterministic', () => {
    expect(worldDeskPosition(1, 2)).toEqual(worldDeskPosition(1, 2));
    expect(worldRoomTable(1)).toEqual(worldRoomTable(1));
  });

  it('exposes courtyard anchors distinct from each other', () => {
    const vals = Object.values(COURTYARD_ANCHORS).map((v) => v.join(','));
    expect(new Set(vals).size).toBe(vals.length);
  });
});
