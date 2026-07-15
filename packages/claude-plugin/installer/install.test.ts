import { describe, expect, it, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, writeFile, mkdir, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { install } from './install';
import { uninstall } from './uninstall';

const dirsToClean: string[] = [];
afterEach(async () => {
  await Promise.all(dirsToClean.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});

async function makeProjectDir(prefix: string): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), prefix));
  dirsToClean.push(dir);
  return dir;
}

describe('campus:install / campus:uninstall', () => {
  it('installs hooks into a non-git PHP-like project without touching its manifest', async () => {
    const dir = await makeProjectDir('campus-plugin-php-');
    const manifestPath = path.join(dir, 'composer.json');
    const manifestContent = '{"require":{"php":"^8.2"}}';
    await writeFile(manifestPath, manifestContent);

    install(dir);

    const sendEventStat = await stat(path.join(dir, '.claude/hooks/send-event.sh'));
    expect(sendEventStat.mode & 0o111).not.toBe(0); // executable
    const codexEventStat = await stat(path.join(dir, '.codex/hooks/send-event.sh'));
    expect(codexEventStat.mode & 0o111).not.toBe(0);

    const settings = JSON.parse(await readFile(path.join(dir, '.claude/settings.json'), 'utf8'));
    expect(settings.hooks.SessionStart).toBeDefined();
    expect(settings.hooks.PreToolUse[0].hooks).toHaveLength(2);

    const codexHooks = JSON.parse(await readFile(path.join(dir, '.codex/hooks.json'), 'utf8'));
    expect(codexHooks.hooks.SubagentStart).toBeDefined();
    expect(codexHooks.hooks.PermissionRequest[0].hooks).toHaveLength(2);

    expect(await readFile(manifestPath, 'utf8')).toBe(manifestContent);
  });

  it('is idempotent -- installing twice does not duplicate hook entries', async () => {
    const dir = await makeProjectDir('campus-plugin-idempotent-');
    install(dir);
    install(dir);
    const settings = JSON.parse(await readFile(path.join(dir, '.claude/settings.json'), 'utf8'));
    expect(settings.hooks.Stop).toHaveLength(1);
    const codexHooks = JSON.parse(await readFile(path.join(dir, '.codex/hooks.json'), 'utf8'));
    expect(codexHooks.hooks.Stop).toHaveLength(1);
  });

  it('preserves existing unrelated settings.json content', async () => {
    const dir = await makeProjectDir('campus-plugin-preserve-');
    await mkdir(path.join(dir, '.claude'), { recursive: true });
    await writeFile(path.join(dir, '.claude/settings.json'), JSON.stringify({ permissions: { allow: ['Bash(ls:*)'] } }, null, 2));

    install(dir);

    const settings = JSON.parse(await readFile(path.join(dir, '.claude/settings.json'), 'utf8'));
    expect(settings.permissions).toEqual({ allow: ['Bash(ls:*)'] });
    expect(settings.hooks.SessionStart).toBeDefined();
  });

  it('handles a path containing spaces', async () => {
    const parent = await makeProjectDir('campus-plugin-spaces-');
    const dir = path.join(parent, 'my project');
    await mkdir(dir);
    install(dir);
    const stat1 = await stat(path.join(dir, '.claude/hooks/send-event.sh'));
    expect(stat1.isFile()).toBe(true);
  });

  it('uninstall removes our hooks and strips our settings entries only', async () => {
    const dir = await makeProjectDir('campus-plugin-uninstall-');
    await mkdir(path.join(dir, '.claude'), { recursive: true });
    await writeFile(
      path.join(dir, '.claude/settings.json'),
      JSON.stringify({ hooks: { Stop: [{ hooks: [{ type: 'command', command: 'my-other-hook.sh' }] }] } }, null, 2),
    );
    await mkdir(path.join(dir, '.codex'), { recursive: true });
    await writeFile(
      path.join(dir, '.codex/hooks.json'),
      JSON.stringify({ hooks: { Stop: [{ hooks: [{ type: 'command', command: 'my-codex-hook.sh' }] }] } }, null, 2),
    );
    install(dir);
    uninstall(dir);

    const sendEventExists = await stat(path.join(dir, '.claude/hooks/send-event.sh')).then(() => true, () => false);
    expect(sendEventExists).toBe(false);
    const codexEventExists = await stat(path.join(dir, '.codex/hooks/send-event.sh')).then(() => true, () => false);
    expect(codexEventExists).toBe(false);

    const settings = JSON.parse(await readFile(path.join(dir, '.claude/settings.json'), 'utf8'));
    expect(settings.hooks.Stop).toEqual([{ hooks: [{ type: 'command', command: 'my-other-hook.sh' }] }]);
    const codexSettings = JSON.parse(await readFile(path.join(dir, '.codex/hooks.json'), 'utf8'));
    expect(codexSettings.hooks.Stop).toEqual([{ hooks: [{ type: 'command', command: 'my-codex-hook.sh' }] }]);
  });
});
