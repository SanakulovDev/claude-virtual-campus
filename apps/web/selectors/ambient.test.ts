import { describe, expect, it } from 'vitest';
import type { AgentRow } from '../lib/types';
import { agentIsAmbientEligible, ambientActivityForAgent, pickAmbientActivity, type AmbientContext } from './ambient';
import { selectAgentActivityLine } from './activity-source.selector';

const OK: AmbientContext = { enabled: true, reducedMotion: false, roomBlocked: false };

function agent(over: Partial<AgentRow> = {}): AgentRow {
  return {
    id: 'a1',
    projectId: 'p1',
    externalAgentId: 'p1:plan',
    agentType: 'plan',
    displayName: 'Lucy',
    role: 'Planner',
    status: 'idle',
    activity: 'idle',
    currentZoneKey: 'assigned-desk',
    currentTaskId: null,
    currentSessionId: null,
    lastSeenAt: new Date().toISOString(),
    ...over,
  } as AgentRow;
}

describe('ambient eligibility', () => {
  it('is eligible only when idle and nothing blocks it', () => {
    expect(agentIsAmbientEligible(agent(), OK)).toBe(true);
  });

  it('stops the instant real work arrives', () => {
    expect(agentIsAmbientEligible(agent({ activity: 'coding' }), OK)).toBe(false);
    expect(ambientActivityForAgent(agent({ activity: 'coding' }), OK, 3)).toBeNull();
  });

  it('is disabled when the user turns ambient life off', () => {
    expect(agentIsAmbientEligible(agent(), { ...OK, enabled: false })).toBe(false);
  });

  it('respects reduced-motion', () => {
    expect(agentIsAmbientEligible(agent(), { ...OK, reducedMotion: true })).toBe(false);
  });

  it('is frozen while the room is blocked (pending approval / failure)', () => {
    expect(agentIsAmbientEligible(agent(), { ...OK, roomBlocked: true })).toBe(false);
    expect(ambientActivityForAgent(agent(), { ...OK, roomBlocked: true }, 2)).toBeNull();
  });
});

describe('pickAmbientActivity', () => {
  it('is deterministic for a seed', () => {
    expect(pickAmbientActivity('a1:2').key).toBe(pickAmbientActivity('a1:2').key);
  });
});

describe('activity line labelling', () => {
  it('labels ambient life as ambient, never real work', () => {
    const line = selectAgentActivityLine(agent(), ambientActivityForAgent(agent(), OK, 1));
    expect(line.source).toBe('ambient-idle');
    expect(line.sourceLabel).toBe('Ambient activity');
    expect(line.text.startsWith('Lucy is ')).toBe(true);
  });

  it('labels real work as real agent activity', () => {
    const line = selectAgentActivityLine(agent({ activity: 'coding', currentFile: '/x/auth.ts', displayName: 'Jarvis' }));
    expect(line.source).toBe('real-work');
    expect(line.sourceLabel).toBe('Real agent activity');
  });

  it('shows no source badge for a plainly idle agent', () => {
    expect(selectAgentActivityLine(agent()).sourceLabel).toBeNull();
  });
});
