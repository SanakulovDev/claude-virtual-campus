import { existsSync, readFileSync, writeFileSync, unlinkSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripOurSettings, type ClaudeSettings } from './merge-settings';
import { resolveTargetArg } from './install';

const HOOK_FILENAMES = ['send-event.sh', 'request-approval.sh'];

function fail(message: string): never {
  // eslint-disable-next-line no-console
  console.error(`campus:uninstall: ${message}`);
  process.exit(1);
}

export function uninstall(targetDirArg?: string): void {
  const targetDir = resolveTargetArg(targetDirArg);
  if (!existsSync(targetDir) || !statSync(targetDir).isDirectory()) {
    fail(`Target directory does not exist: ${targetDir}`);
  }

  const claudeDir = path.join(targetDir, '.claude');
  const hooksDir = path.join(claudeDir, 'hooks');
  const settingsPath = path.join(claudeDir, 'settings.json');
  const changedFiles: string[] = [];

  for (const filename of HOOK_FILENAMES) {
    const file = path.join(hooksDir, filename);
    if (existsSync(file)) {
      unlinkSync(file);
      changedFiles.push(file);
    }
  }

  if (existsSync(settingsPath)) {
    const raw = readFileSync(settingsPath, 'utf8');
    let settings: ClaudeSettings;
    try {
      settings = JSON.parse(raw) as ClaudeSettings;
    } catch {
      fail(`${settingsPath} is not valid JSON; leaving it untouched.`);
    }
    const stripped = stripOurSettings(settings);
    const strippedJson = `${JSON.stringify(stripped, null, 2)}\n`;
    if (strippedJson !== raw) {
      const backupPath = `${settingsPath}.backup-${Date.now()}`;
      writeFileSync(backupPath, raw);
      writeFileSync(settingsPath, strippedJson);
      changedFiles.push(backupPath, settingsPath);
    }
  }

  if (changedFiles.length === 0) {
    // eslint-disable-next-line no-console
    console.log('campus:uninstall: nothing to remove.');
    return;
  }

  // eslint-disable-next-line no-console
  console.log('campus:uninstall: changed files:');
  for (const file of changedFiles) {
    // eslint-disable-next-line no-console
    console.log(`  ${file}`);
  }
}

const invokedDirectly = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (invokedDirectly) {
  uninstall(process.argv[2]);
}
