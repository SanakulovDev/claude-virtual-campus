import { describe, expect, it, afterEach } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { resolveProject } from './resolveProject';

const execFileAsync = promisify(execFile);
const dirsToClean: string[] = [];
afterEach(async () => {
  await Promise.all(dirsToClean.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});

async function makeTmpDir(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'campus-resolve-'));
  dirsToClean.push(dir);
  return dir;
}

describe('resolveProject', () => {
  it('resolves a non-git directory safely', async () => {
    const dir = await makeTmpDir();
    const project = await resolveProject(dir);
    expect(project.isGitRepository).toBe(false);
    expect(project.projectKey.startsWith('path:')).toBe(true);
    expect(project.technologyProfile).not.toBeNull();
  });

  it('resolves a git repository root and branch', async () => {
    const dir = await makeTmpDir();
    await execFileAsync('git', ['init', '-b', 'main'], { cwd: dir });
    await execFileAsync('git', ['config', 'user.email', 'test@example.com'], { cwd: dir });
    await execFileAsync('git', ['config', 'user.name', 'Test'], { cwd: dir });
    await writeFile(path.join(dir, 'go.mod'), 'module example.com/x\n\ngo 1.22');
    await execFileAsync('git', ['add', '.'], { cwd: dir });
    await execFileAsync('git', ['commit', '-m', 'init'], { cwd: dir });

    const project = await resolveProject(dir);
    expect(project.isGitRepository).toBe(true);
    expect(project.branch).toBe('main');
    expect(project.remoteUrl).toBeNull();
    expect(project.technologyProfile?.primaryLanguage).toBe('Go');
  });

  it('gives the same non-git identity from the project root and a subdirectory', async () => {
    const dir = await makeTmpDir();
    const { mkdir } = await import('node:fs/promises');
    await mkdir(path.join(dir, '.claude'), { recursive: true });
    await mkdir(path.join(dir, 'src'), { recursive: true });

    const fromRoot = await resolveProject(dir);
    const fromSub = await resolveProject(path.join(dir, 'src'));
    expect(fromSub.projectKey).toBe(fromRoot.projectKey);
    expect(fromSub.rootPath).toBe(fromRoot.rootPath);
  });
});
