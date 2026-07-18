import { describe, expect, it } from 'vitest';
import {
  HALL_HALF, ROOM_W, ROOM_D, ROOM_GAP, ROOMS_X0,
  roomPlacement, roomToWorld, deskLocal, buildingBounds, zoneAt,
  reviewSpot, ambientSpot, laneFor,
} from './office-layout';

describe('roomPlacement', () => {
  it('places even indices north and odd indices south of the hallway', () => {
    expect(roomPlacement(0).north).toBe(true);
    expect(roomPlacement(0).center[2]).toBeLessThan(0);
    expect(roomPlacement(1).north).toBe(false);
    expect(roomPlacement(1).center[2]).toBeGreaterThan(0);
    expect(roomPlacement(0).center[0]).toBe(roomPlacement(1).center[0]); // same pair
  });

  it('grows lengthwise: pair n+1 sits one room further along x', () => {
    expect(roomPlacement(2).center[0] - roomPlacement(0).center[0]).toBeCloseTo(ROOM_W + ROOM_GAP);
  });

  it('puts the door on the hallway wall', () => {
    const north = roomPlacement(0);
    expect(north.door[2]).toBeCloseTo(-HALL_HALF);
    const south = roomPlacement(1);
    expect(south.door[2]).toBeCloseTo(HALL_HALF);
    expect(north.door[0]).toBeCloseTo(north.center[0]);
  });
});

describe('roomToWorld', () => {
  it('maps local +Z toward the hallway on both sides', () => {
    const northFront = roomToWorld(0, [0, 0, ROOM_D / 2]);
    expect(northFront[2]).toBeCloseTo(-HALL_HALF);          // north front wall touches hallway
    const southFront = roomToWorld(1, [0, 0, ROOM_D / 2]);
    expect(southFront[2]).toBeCloseTo(HALL_HALF);
  });

  it('mirrors x for south rooms so layouts stay symmetric', () => {
    const north = roomToWorld(0, [2, 0, -3]);
    const south = roomToWorld(1, [2, 0, -3]);
    expect(south[0] - roomPlacement(1).center[0]).toBeCloseTo(-(north[0] - roomPlacement(0).center[0]));
  });
});

describe('zoneAt', () => {
  it('classifies hallway, core and rooms', () => {
    expect(zoneAt(10, 0)).toEqual({ kind: 'hallway' });
    expect(zoneAt(-7, -6)).toEqual({ kind: 'core' });
    const r0 = roomPlacement(0);
    expect(zoneAt(r0.center[0], r0.center[2])).toEqual({ kind: 'room', index: 0 });
    const r3 = roomPlacement(3);
    expect(zoneAt(r3.center[0], r3.center[2])).toEqual({ kind: 'room', index: 3 });
  });
});

describe('buildingBounds', () => {
  it('covers the core plus every room pair', () => {
    const b = buildingBounds(4); // 2 pairs
    expect(b.minX).toBeLessThan(-13);
    expect(b.maxX).toBeGreaterThan(ROOMS_X0 + 2 * (ROOM_W + ROOM_GAP) - ROOM_GAP);
    expect(b.maxZ).toBeGreaterThan(HALL_HALF + ROOM_D);
  });
  it('still has a footprint with zero projects', () => {
    const b = buildingBounds(0);
    expect(b.maxX).toBeGreaterThan(b.minX);
  });
});

describe('crowd + ambient spots', () => {
  it('fans review spots out without overlap', () => {
    const a = reviewSpot(0, 3);
    const b = reviewSpot(1, 3);
    expect(a).not.toEqual(b);
    expect(Math.abs(a[2] - b[2])).toBeLessThan(0.01); // same row, spread on x
  });

  it('gives every ambient key a world spot or null, deterministically', () => {
    for (const key of ['coffee', 'sofa', 'plants', 'walk', 'visit', 'chat', 'stretch']) {
      const s1 = ambientSpot(key, 7, 0, 4);
      const s2 = ambientSpot(key, 7, 0, 4);
      expect(s1).toEqual(s2);
    }
    expect(ambientSpot('reading', 7, 0, 4)).toBeNull(); // desk-bound activity: stay put
  });

  it('visit targets a different room than home', () => {
    const spot = ambientSpot('visit', 3, 0, 4);
    expect(spot).not.toBeNull();
    const zone = zoneAt(spot![0], spot![2]);
    expect(zone.kind).toBe('room');
    expect((zone as { kind: 'room'; index: number }).index).not.toBe(0);
  });

  it('visit with a single project returns null (nowhere to go)', () => {
    expect(ambientSpot('visit', 3, 0, 1)).toBeNull();
  });

  it('lane assignment is stable and one of three lanes', () => {
    expect(laneFor('agent-a')).toBe(laneFor('agent-a'));
    expect([-1.1, 0, 1.1]).toContain(laneFor('agent-xyz'));
  });
});
