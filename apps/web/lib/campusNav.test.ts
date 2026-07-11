import { describe, expect, it } from 'vitest';
import { nextPathPoint } from './campusNav';

describe('nextPathPoint', () => {
  const path: [number, number, number][] = [
    [0, 0, 0],
    [10, 0, 0],
  ];

  it('advances toward the next corner by step', () => {
    const r = nextPathPoint(path, [0, 0, 0], 1);
    expect(r.point[0]).toBeCloseTo(1, 5);
    expect(r.arrived).toBe(false);
  });

  it('arrives at the final corner', () => {
    const r = nextPathPoint(path, [9.5, 0, 0], 1);
    expect(r.point).toEqual([10, 0, 0]);
    expect(r.arrived).toBe(true);
  });
});
