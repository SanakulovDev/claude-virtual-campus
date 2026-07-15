import { describe, expect, it } from 'vitest';
import type { TimelineEntry } from '../lib/types';
import { selectAgentUtilization } from './utilization.selector';

const now = Date.UTC(2026, 6, 12, 12, 0, 0);
function entry(over: Partial<TimelineEntry>): TimelineEntry {
  return {
    id: Math.random().toString(36),
    runtime: 'claude',
    projectId: 'p1',
    agentId: 'a1',
    sessionId: 's1',
    hookEventName: 'PreToolUse',
    normalizedType: 'file_edit',
    toolName: 'Edit',
    receivedAt: new Date(now - 1000).toISOString(),
    ...over,
  };
}

describe('selectAgentUtilization', () => {
  it('is 0 with no recent events', () => {
    expect(selectAgentUtilization('a1', [], now)).toBe(0);
  });

  it('rises with recent work events and saturates at 1', () => {
    const events = Array.from({ length: 8 }, () => entry({}));
    expect(selectAgentUtilization('a1', events, now)).toBe(1);
  });

  it('is ~0.5 at half saturation', () => {
    const events = Array.from({ length: 4 }, () => entry({}));
    expect(selectAgentUtilization('a1', events, now)).toBeCloseTo(0.5, 5);
  });

  it('ignores other agents and stale events', () => {
    const events = [
      entry({ agentId: 'other' }),
      entry({ receivedAt: new Date(now - 10 * 60 * 1000).toISOString() }),
      entry({ normalizedType: 'session_start' }),
    ];
    expect(selectAgentUtilization('a1', events, now)).toBe(0);
  });
});
