import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { campusTeamConfigSchema } from '@campus/contracts';
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
 * Reads a project's optional `.claude/campus.json`. Always fail-open: a missing, oversized,
 * unreadable or invalid file yields an empty config -- it must never block event handling.
 */
export function readTeamConfig(rootPath: string): TeamConfig {
  const file = path.join(rootPath, '.claude', 'campus.json');
  let stat;
  try {
    if (!existsSync(file)) return EMPTY;
    stat = statSync(file);
    if (!stat.isFile() || stat.size > MAX_BYTES) return EMPTY;
  } catch {
    return EMPTY;
  }

  const cached = cache.get(file);
  if (cached && cached.mtimeMs === stat.mtimeMs) return cached.value;

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
  return value;
}
