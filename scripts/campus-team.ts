import { existsSync, mkdirSync, writeFileSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * Scaffolds a starter <project>/.claude/campus.json. This file is presentation-only -- it
 * renames/relabels the real subagents Claude Code starts. It grants no permissions and
 * creates no working agents. Refuses to overwrite an existing file unless --force is given.
 */
function fail(message: string): never {
  // eslint-disable-next-line no-console
  console.error(`campus:team: ${message}`);
  process.exit(1);
}

const STARTER = {
  projectName: '',
  team: [
    { agentType: 'plan', name: 'Lucy', role: 'Planner' },
    { agentType: 'implementation-engineer', name: 'Jarvis', role: 'Implementation Engineer' },
    { agentType: 'qa-engineer', name: 'Anna', role: 'QA Engineer' },
  ],
};

export function scaffoldTeam(targetDirArg: string, force: boolean): void {
  const targetDir = path.resolve(targetDirArg);
  if (!existsSync(targetDir) || !statSync(targetDir).isDirectory()) {
    fail(`Target directory does not exist: ${targetDir}`);
  }

  const claudeDir = path.join(targetDir, '.claude');
  const configPath = path.join(claudeDir, 'campus.json');

  if (existsSync(configPath) && !force) {
    fail(`${configPath} already exists. Re-run with --force to overwrite it.`);
  }

  mkdirSync(claudeDir, { recursive: true });
  const config = { ...STARTER, projectName: path.basename(targetDir) };
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);

  // eslint-disable-next-line no-console
  console.log(`campus:team: wrote ${configPath}`);
}

const invokedDirectly = process.argv[1] && import.meta.url === `file://${path.resolve(process.argv[1])}`;
if (invokedDirectly) {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const target = args.find((a) => !a.startsWith('--'));
  if (!target) fail('Usage: campus:team <path-to-project> [--force]');
  scaffoldTeam(target, force);
}
