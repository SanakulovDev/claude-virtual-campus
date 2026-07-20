import { describe, expect, it } from 'vitest';
import { selectClaimable } from './scheduler';

const d = (n: number) => new Date(2026, 0, 1, 0, 0, n);

describe('selectClaimable', () => {
  it('claims one run per idle project, oldest first, within free slots', () => {
    const ids = selectClaimable({
      queued: [
        { id: 'a1', projectId: 'A', createdAt: d(1) },
        { id: 'a2', projectId: 'A', createdAt: d(2) },
        { id: 'b1', projectId: 'B', createdAt: d(3) },
      ],
      runningProjectIds: new Set(),
      freeSlots: 5,
    });
    expect(ids).toEqual(['a1', 'b1']); // a2 waits: A now has a claimed run
  });

  it('skips projects that already have a running run', () => {
    const ids = selectClaimable({
      queued: [{ id: 'a1', projectId: 'A', createdAt: d(1) }, { id: 'b1', projectId: 'B', createdAt: d(2) }],
      runningProjectIds: new Set(['A']),
      freeSlots: 5,
    });
    expect(ids).toEqual(['b1']);
  });

  it('never exceeds free slots', () => {
    const ids = selectClaimable({
      queued: [
        { id: 'a1', projectId: 'A', createdAt: d(1) },
        { id: 'b1', projectId: 'B', createdAt: d(2) },
        { id: 'c1', projectId: 'C', createdAt: d(3) },
      ],
      runningProjectIds: new Set(),
      freeSlots: 2,
    });
    expect(ids).toEqual(['a1', 'b1']);
  });

  it('claims nothing when no slots', () => {
    expect(selectClaimable({ queued: [{ id: 'a1', projectId: 'A', createdAt: d(1) }], runningProjectIds: new Set(), freeSlots: 0 })).toEqual([]);
  });
});
