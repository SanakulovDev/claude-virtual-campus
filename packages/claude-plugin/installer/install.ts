import { existsSync, mkdirSync, copyFileSync, chmodSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mergeSettings, type ClaudeSettings } from './merge-settings';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const HOOKS_SOURCE_DIR = path.join(HERE, '..', 'hooks');
const TEMPLATE_PATH = path.join(HERE, '..', 'templates', 'settings.template.json');
const HOOK_FILENAMES = ['send-event.sh', 'request-approval.sh'];

function fail(message: string): never {
  // eslint-disable-next-line no-console
  console.error(`campus:install: ${message}`);
  process.exit(1);
}

/** No path given means "this project" -- the launcher runs from inside the target dir. */
export function resolveTargetArg(arg: string | undefined): string {
  return path.resolve(arg ?? process.cwd());
}

export function install(targetDirArg?: string): void {
  const targetDir = resolveTargetArg(targetDirArg);
  if (!existsSync(targetDir) || !statSync(targetDir).isDirectory()) {
    fail(`Target directory does not exist: ${targetDir}`);
  }

  const claudeDir = path.join(targetDir, '.claude');
  const hooksDir = path.join(claudeDir, 'hooks');
  const settingsPath = path.join(claudeDir, 'settings.json');

  const changedFiles: string[] = [];

  mkdirSync(hooksDir, { recursive: true });

  for (const filename of HOOK_FILENAMES) {
    const src = path.join(HOOKS_SOURCE_DIR, filename);
    const dest = path.join(hooksDir, filename);
    const alreadyIdentical = existsSync(dest) && readFileSync(dest, 'utf8') === readFileSync(src, 'utf8');
    copyFileSync(src, dest);
    chmodSync(dest, 0o755);
    if (!alreadyIdentical) changedFiles.push(dest);
  }

  const template = JSON.parse(readFileSync(TEMPLATE_PATH, 'utf8')) as ClaudeSettings;
  let existingSettings: ClaudeSettings = {};
  let existingRaw: string | null = null;
  if (existsSync(settingsPath)) {
    existingRaw = readFileSync(settingsPath, 'utf8');
    try {
      existingSettings = JSON.parse(existingRaw) as ClaudeSettings;
    } catch {
      fail(`Existing ${settingsPath} is not valid JSON; refusing to overwrite. Fix or remove it and retry.`);
    }
  }

  const merged = mergeSettings(existingSettings, template);
  const mergedJson = `${JSON.stringify(merged, null, 2)}\n`;

  if (existingRaw !== mergedJson) {
    if (existingRaw !== null) {
      const backupPath = `${settingsPath}.backup-${Date.now()}`;
      writeFileSync(backupPath, existingRaw);
      changedFiles.push(backupPath);
    }
    mkdirSync(claudeDir, { recursive: true });
    writeFileSync(settingsPath, mergedJson);
    changedFiles.push(settingsPath);
  }

  if (changedFiles.length === 0) {
    // eslint-disable-next-line no-console
    console.log('campus:install: already up to date, no changes.');
    return;
  }

  // eslint-disable-next-line no-console
  console.log('campus:install: changed files:');
  for (const file of changedFiles) {
    // eslint-disable-next-line no-console
    console.log(`  ${file}`);
  }
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (invokedDirectly) {
  install(process.argv[2]);
}
