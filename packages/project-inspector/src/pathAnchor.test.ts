import { describe, expect, it, afterEach, vi } from 'vitest';
import { mkdtemp, mkdir, rm, symlink, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { resolvePathAnchor } from './pathAnchor';

var mockedHome: string | null = null;
vi.mock('node:os', async (importOriginal) => {
  const os = await importOriginal<typeof import('node:os')>();
  return { ...os, homedir: () => mockedHome ?? os.homedir() };
});

const dirsToClean: string[] = [];
afterEach(async () => {
  mockedHome = null;
  await Promise.all(dirsToClean.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});

async function makeTmpDir(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'campus-anchor-'));
  dirsToClean.push(dir);
  return dir;
}

describe('resolvePathAnchor', () => {
  it('walks up to the nearest ancestor containing .claude', async () => {
    const root = await makeTmpDir();
    await mkdir(path.join(root, '.claude'), { recursive: true });
    await mkdir(path.join(root, 'src', 'deep'), { recursive: true });

    const anchor = await resolvePathAnchor(path.join(root, 'src', 'deep'));
    expect(anchor).toBe(await realpath(root));
  });

  it('resolves symlinks so /tmp and /private/tmp agree', async () => {
    const root = await makeTmpDir();
    await mkdir(path.join(root, '.claude'), { recursive: true });
    const link = path.join(await makeTmpDir(), 'link');
    await symlink(root, link);

    expect(await resolvePathAnchor(link)).toBe(await resolvePathAnchor(root));
  });

  it('falls back to realpath(cwd) when no .claude ancestor exists', async () => {
    const dir = await makeTmpDir();
    expect(await resolvePathAnchor(dir)).toBe(await realpath(dir));
  });

  it('never anchors at or above the home directory', async () => {
    const fakeHome = await makeTmpDir();
    await mkdir(path.join(fakeHome, '.claude'), { recursive: true });   // ~/.claude is config, not a project
    await mkdir(path.join(fakeHome, 'sub'), { recursive: true });
    mockedHome = fakeHome;

    const anchor = await resolvePathAnchor(path.join(fakeHome, 'sub'));
    expect(anchor).toBe(await realpath(path.join(fakeHome, 'sub')));
  });
});
