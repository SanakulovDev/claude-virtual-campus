import { existsSync } from 'node:fs';
import { realpath } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';

/**
 * Stable identity anchor for a non-git working directory: the nearest ancestor containing
 * .claude/ (the campus installer creates one at the project root), after resolving
 * symlinks so /tmp and /private/tmp agree. The walk stops before the user's home
 * directory and the filesystem root -- ~/.claude is Claude Code's own config, never a
 * project root. No ancestor qualifies -> realpath(cwd) itself, so a directory with zero
 * markers still gets a stable identity (universal-project requirement).
 */
export async function resolvePathAnchor(cwd: string): Promise<string> {
  let real: string;
  try {
    real = await realpath(cwd);
  } catch {
    real = path.resolve(cwd);
  }
  let home: string;
  try {
    home = await realpath(homedir());
  } catch {
    home = homedir();
  }
  let dir = real;
  while (dir !== home && path.dirname(dir) !== dir) {
    if (existsSync(path.join(dir, '.claude'))) return dir;
    dir = path.dirname(dir);
  }
  return real;
}
