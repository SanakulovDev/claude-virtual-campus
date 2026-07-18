import { describe, expect, it } from 'vitest';
import { routeBetween } from './routing';
import { roomPlacement, roomToWorld, zoneAt, HALL_HALF } from './office-layout';

describe('routeBetween', () => {
  it('goes direct within the same room', () => {
    const a = roomToWorld(0, [0, 0, -2]);
    const b = roomToWorld(0, [2, 0, 1]);
    expect(routeBetween(a, b, 0)).toEqual([b]);
  });

  it('routes room->room through both doors and the hallway', () => {
    const from = roomToWorld(0, [0, 0, -2]);   // north room 0
    const to = roomToWorld(3, [1, 0, -1]);     // south room 3, another pair
    const path = routeBetween(from, to, 1.1);

    expect(path[path.length - 1]).toEqual(to);
    // first waypoint: own door
    expect(path[0]![0]).toBeCloseTo(roomPlacement(0).door[0]);
    expect(path[0]![2]).toBeCloseTo(roomPlacement(0).door[2]);
    // middle waypoints ride the hallway lane
    const lanePoints = path.slice(1, -2);
    for (const p of lanePoints) expect(Math.abs(p[2])).toBeLessThanOrEqual(HALL_HALF);
    // penultimate waypoint: destination door
    expect(path[path.length - 2]![0]).toBeCloseTo(roomPlacement(3).door[0]);
  });

  it('routes desk->shared review through the home door only', () => {
    const from = roomToWorld(2, [0, 0, -2]);
    const to: [number, number, number] = [-7, 0, -4];   // review area (core)
    const path = routeBetween(from, to, 0);
    expect(path[0]![0]).toBeCloseTo(roomPlacement(2).door[0]);
    expect(path[path.length - 1]).toEqual(to);
  });

  it('goes direct along the hallway when both ends are in it', () => {
    const path = routeBetween([4, 0, 0], [30, 0, 1], -1.1);
    expect(path[path.length - 1]).toEqual([30, 0, 1]);
    expect(path.length).toBeLessThanOrEqual(3);
  });
});
