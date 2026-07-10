import { describe, expect, it } from 'vitest';
import { AGENT_NAME_POOL, pickAgentName, profileForAgentType } from './agents';

describe('pickAgentName', () => {
  it('returns the first pool name when nothing is used', () => {
    expect(pickAgentName([])).toBe(AGENT_NAME_POOL[0]);
  });

  it('never returns a name already taken', () => {
    const used: string[] = [];
    for (let i = 0; i < AGENT_NAME_POOL.length; i += 1) {
      const name = pickAgentName(used);
      expect(used).not.toContain(name);
      used.push(name);
    }
    // all pool names distinct and assigned
    expect(new Set(used).size).toBe(AGENT_NAME_POOL.length);
  });

  it('is deterministic for the same used set', () => {
    expect(pickAgentName(['Lucy'])).toBe(pickAgentName(['Lucy']));
  });

  it('falls back to numbered names once the pool is exhausted', () => {
    const all = [...AGENT_NAME_POOL];
    const next = pickAgentName(all);
    expect(next).toBe(`${AGENT_NAME_POOL[0]} 2`);
  });
});

describe('profileForAgentType', () => {
  it('gives a known type its role and accessory', () => {
    expect(profileForAgentType('plan').role).toBe('Planner');
    expect(profileForAgentType('qa-engineer').role).toBe('QA Engineer');
    expect(profileForAgentType('security-reviewer').accessory).toBe('shield');
  });

  it('gives any unknown type a safe teammate profile', () => {
    const p = profileForAgentType('totally-made-up-agent');
    expect(p.role).toBe('Teammate');
    expect(p.bio.length).toBeGreaterThan(0);
  });
});
