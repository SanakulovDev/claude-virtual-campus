import { describe, expect, it } from 'vitest';
import { agentWorldTarget } from './agent-world-target';
import { roomToWorld, tableLocal, reviewSpot, zoneAt } from './office-layout';

describe('agentWorldTarget', () => {
  it('sends planning agents to their room table, not the desk', () => {
    const t = tableLocal();
    expect(agentWorldTarget('planning-table', 0, 0, 0, 1)).toEqual(roomToWorld(0, [t[0], 0, t[2] + 1.2]));
  });

  it('sends checking agents to the shared review area in the core', () => {
    expect(agentWorldTarget('review-screen', 3, 2, 1, 3)).toEqual(reviewSpot(1, 3));
  });

  it('clamps planning fan-out inside the room', () => {
    const spot = agentWorldTarget('planning-table', 0, 0, 9, 10);
    expect(zoneAt(spot[0], spot[2])).toEqual({ kind: 'room', index: 0 });
  });

  it('desk and attention resolve to the desk approach point', () => {
    expect(agentWorldTarget('desk', 1, 0, 0, 1)).toEqual(agentWorldTarget('attention', 1, 0, 0, 1));
  });
});
