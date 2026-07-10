import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { readTeamConfig } from '../src/agents/campus-team';

describe('readTeamConfig', () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'campus-team-'));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  function writeConfig(content: string) {
    mkdirSync(path.join(dir, '.claude'), { recursive: true });
    writeFileSync(path.join(dir, '.claude', 'campus.json'), content);
  }

  it('returns empty when the file is missing', () => {
    expect(readTeamConfig(dir).overrides.size).toBe(0);
  });

  it('reads name/role overrides keyed by agentType', () => {
    writeConfig(
      JSON.stringify({
        projectName: 'prog.bts',
        team: [{ agentType: 'plan', name: 'Lucy', role: 'Planner' }],
      }),
    );
    const cfg = readTeamConfig(dir);
    expect(cfg.projectName).toBe('prog.bts');
    expect(cfg.overrides.get('plan')).toEqual({ name: 'Lucy', role: 'Planner' });
  });

  it('fails open on invalid JSON without throwing', () => {
    writeConfig('{ not valid json');
    expect(readTeamConfig(dir).overrides.size).toBe(0);
  });

  it('fails open on a schema mismatch', () => {
    writeConfig(JSON.stringify({ team: 'not-an-array' }));
    expect(readTeamConfig(dir).overrides.size).toBe(0);
  });
});
