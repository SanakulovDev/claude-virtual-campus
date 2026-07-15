import { existsSync, mkdirSync, copyFileSync, chmodSync, readFileSync, writeFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mergeSettings, type ClaudeSettings } from './merge-settings';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const HOOKS_SOURCE_DIR = path.join(HERE, '..', 'hooks');
const TEMPLATE_PATH = path.join(HERE, '..', 'templates', 'settings.template.json');
const CODEX_TEMPLATE_PATH = path.join(HERE, '..', 'templates', 'codex-hooks.template.json');
const HOOK_FILENAMES = ['send-event.sh', 'request-approval.sh'];

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'"'"'`)}'`;
}

function writeHook(sourceName: string, destination: string, changedFiles: string[]): void {
  const src = path.join(HOOKS_SOURCE_DIR, sourceName);
  const alreadyIdentical = existsSync(destination) && readFileSync(destination, 'utf8') === readFileSync(src, 'utf8');
  copyFileSync(src, destination);
  chmodSync(destination, 0o755);
  if (!alreadyIdentical) changedFiles.push(destination);
}

function fail(message: string): never {
  // eslint-disable-next-line no-console
  console.error(`campus:install: ${message}`);
  process.exit(1);
}

export function install(targetDirArg: string): void {
  const targetDir = path.resolve(targetDirArg);
  if (!existsSync(targetDir) || !statSync(targetDir).isDirectory()) {
    fail(`Target directory does not exist: ${targetDir}`);
  }

  const claudeDir = path.join(targetDir, '.claude');
  const hooksDir = path.join(claudeDir, 'hooks');
  const settingsPath = path.join(claudeDir, 'settings.json');
  const codexDir = path.join(targetDir, '.codex');
  const codexHooksDir = path.join(codexDir, 'hooks');
  const codexSettingsPath = path.join(codexDir, 'hooks.json');

  const changedFiles: string[] = [];

  mkdirSync(hooksDir, { recursive: true });
  mkdirSync(codexHooksDir, { recursive: true });

  for (const filename of HOOK_FILENAMES) {
    const dest = path.join(hooksDir, filename);
    writeHook(filename, dest, changedFiles);
  }
  writeHook('send-codex-event.sh', path.join(codexHooksDir, 'send-event.sh'), changedFiles);
  writeHook('request-codex-approval.sh', path.join(codexHooksDir, 'request-approval.sh'), changedFiles);

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

  const codexTemplate = JSON.parse(readFileSync(CODEX_TEMPLATE_PATH, 'utf8')) as ClaudeSettings;
  for (const groups of Object.values(codexTemplate.hooks ?? {})) {
    for (const group of groups) {
      for (const hook of group.hooks) {
        if (hook.command === '__CAMPUS_CODEX_SEND_EVENT__') {
          hook.command = shellQuote(path.join(codexHooksDir, 'send-event.sh'));
        } else if (hook.command === '__CAMPUS_CODEX_REQUEST_APPROVAL__') {
          hook.command = shellQuote(path.join(codexHooksDir, 'request-approval.sh'));
        }
      }
    }
  }
  let existingCodexSettings: ClaudeSettings = {};
  let existingCodexRaw: string | null = null;
  if (existsSync(codexSettingsPath)) {
    existingCodexRaw = readFileSync(codexSettingsPath, 'utf8');
    try {
      existingCodexSettings = JSON.parse(existingCodexRaw) as ClaudeSettings;
    } catch {
      fail(`Existing ${codexSettingsPath} is not valid JSON; refusing to overwrite. Fix or remove it and retry.`);
    }
  }

  const mergedCodexJson = `${JSON.stringify(mergeSettings(existingCodexSettings, codexTemplate), null, 2)}\n`;
  if (existingCodexRaw !== mergedCodexJson) {
    if (existingCodexRaw !== null) {
      const backupPath = `${codexSettingsPath}.backup-${Date.now()}`;
      writeFileSync(backupPath, existingCodexRaw);
      changedFiles.push(backupPath);
    }
    writeFileSync(codexSettingsPath, mergedCodexJson);
    changedFiles.push(codexSettingsPath);
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
  const target = process.argv[2];
  if (!target) fail('Usage: campus:install <path-to-project>');
  install(target);
}
