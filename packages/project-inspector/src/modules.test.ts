import { describe, expect, it, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { detectProjectModules } from './modules';

const dirsToClean: string[] = [];
afterEach(async () => {
  await Promise.all(dirsToClean.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});

describe('detectProjectModules', () => {
  it('finds nested modules in a polyglot monorepo without creating duplicate rooms', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'campus-modules-'));
    dirsToClean.push(dir);
    await mkdir(path.join(dir, 'backend-php'), { recursive: true });
    await writeFile(path.join(dir, 'backend-php', 'composer.json'), '{}');
    await mkdir(path.join(dir, 'worker-python'), { recursive: true });
    await writeFile(path.join(dir, 'worker-python', 'pyproject.toml'), '[tool.poetry]');
    await mkdir(path.join(dir, 'gateway-go'), { recursive: true });
    await writeFile(path.join(dir, 'gateway-go', 'go.mod'), 'module x');
    await mkdir(path.join(dir, 'no-manifest-dir'), { recursive: true });

    const modules = await detectProjectModules('proj1', dir);
    const names = modules.map((m) => m.name).sort();
    expect(names).toEqual(['backend-php', 'gateway-go', 'worker-python']);
    expect(modules.every((m) => m.projectId === 'proj1')).toBe(true);
  });

  it('returns an empty list for a directory with no nested manifests', async () => {
    const dir = await mkdtemp(path.join(tmpdir(), 'campus-modules-empty-'));
    dirsToClean.push(dir);
    const modules = await detectProjectModules('proj1', dir);
    expect(modules).toEqual([]);
  });
});
