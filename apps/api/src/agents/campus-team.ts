import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { campusTeamConfigSchema } from '@campus/contracts';
import type { AgentRuntime } from '@campus/contracts';
import type { TeamOverride } from './agents.service';

const MAX_BYTES = 64 * 1024;

export interface TeamConfig {
  projectName?: string;
  /** agentType -> presentation override (name/role). */
  overrides: Map<string, TeamOverride>;
}

const EMPTY: TeamConfig = { overrides: new Map() };

// mtime-keyed cache so we don't re-parse the file on every hook event.
const cache = new Map<string, { mtimeMs: number; value: TeamConfig }>();

/**
 * Reads a project's optional runtime-specific campus.json. Codex falls back to the Claude
 * file so one shared roster remains possible. Invalid files never block event handling.
 */
export function readTeamConfig(rootPath: string, runtime: AgentRuntime = 'claude'): TeamConfig {
  const candidates = runtime === 'codex'
    ? [path.join(rootPath, '.codex', 'campus.json'), path.join(rootPath, '.claude', 'campus.json')]
    : [path.join(rootPath, '.claude', 'campus.json')];
  for (const file of candidates) {
    const value = readConfigFile(file);
    if (value) return value;
  }
  return EMPTY;
}

function readConfigFile(file: string): TeamConfig | null {
  let stat;
  try {
    if (!existsSync(file)) return null;
    stat = statSync(file);
    if (!stat.isFile() || stat.size > MAX_BYTES) return null;
  } catch {
    return null;
  }

  const cached = cache.get(file);
  if (cached && cached.mtimeMs === stat.mtimeMs) return cached.value === EMPTY ? null : cached.value;

  let value: TeamConfig = EMPTY;
  try {
    const parsed = campusTeamConfigSchema.safeParse(JSON.parse(readFileSync(file, 'utf8')));
    if (parsed.success) {
      const overrides = new Map<string, TeamOverride>();
      for (const member of parsed.data.team ?? []) {
        overrides.set(member.agentType, { name: member.name, role: member.role });
      }
      value = { projectName: parsed.data.projectName, overrides };
    }
  } catch {
    value = EMPTY;
  }

  cache.set(file, { mtimeMs: stat.mtimeMs, value });
  return value === EMPTY ? null : value;
}
