import { describe, expect, it, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { resolveGitInfo, isTransientGitFailure, GitUnavailableError } from './git';

const dirsToClean: string[] = [];
afterEach(async () => {
  await Promise.all(dirsToClean.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});

async function makeTmpDir(prefix: string): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), prefix));
  dirsToClean.push(dir);
  return dir;
}

describe('isTransientGitFailure', () => {
  it('classifies a timeout kill as transient', () => {
    expect(isTransientGitFailure({ killed: true, signal: 'SIGTERM', code: null })).toBe(true);
  });

  it('classifies "not a git repository" as a real answer, not a transient failure', () => {
    expect(isTransientGitFailure({ code: 128, stderr: 'fatal: not a git repository' })).toBe(false);
  });

  it('classifies a missing git binary as a real answer, not a transient failure', () => {
    // A machine without git always answers the same way, so the path: identity it
    // produces is stable. Treating it as transient would break non-git projects.
    expect(isTransientGitFailure({ code: 'ENOENT', errno: -2 })).toBe(false);
  });
});

describe('resolveGitInfo', () => {
  it('reports a non-git directory as not a repository', async () => {
    const dir = await makeTmpDir('campus-git-plain-');
    const info = await resolveGitInfo(dir);
    expect(info.isGitRepository).toBe(false);
    expect(info.rootPath).toBe(dir);
  });

  it('throws rather than claiming "not a repository" when git times out', async () => {
    // A stub `git` that outlives the timeout stands in for a real slow/hung git.
    const binDir = await makeTmpDir('campus-git-slow-bin-');
    const stub = path.join(binDir, 'git');
    await writeFile(stub, '#!/bin/sh\nsleep 5\n');
    await chmod(stub, 0o755);

    const workDir = await makeTmpDir('campus-git-slow-work-');
    const realPath = process.env.PATH;
    process.env.PATH = binDir;
    try {
      await expect(resolveGitInfo(workDir, { timeoutMs: 250 })).rejects.toBeInstanceOf(
        GitUnavailableError,
      );
    } finally {
      process.env.PATH = realPath;
    }
  });
});
