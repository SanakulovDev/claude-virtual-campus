import { describe, expect, it } from 'vitest';
import { computeProjectKey, normalizeRemoteUrl, resolveStableRootPath } from './projectKey';
import type { GitInfo } from './git';

describe('normalizeRemoteUrl', () => {
  it('normalizes ssh and https forms to the same value', () => {
    const ssh = normalizeRemoteUrl('git@github.com:acme/widgets.git');
    const https = normalizeRemoteUrl('https://github.com/acme/widgets.git');
    expect(ssh).toBe(https);
  });
});

describe('computeProjectKey', () => {
  const base: GitInfo = {
    isGitRepository: true,
    rootPath: '/repo',
    remoteUrl: null,
    branch: 'main',
    worktreePath: null,
    commonGitDir: '/repo/.git',
  };

  it('prefers remote url when present', () => {
    const withRemote = computeProjectKey({ ...base, remoteUrl: 'git@github.com:acme/widgets.git' });
    expect(withRemote.startsWith('remote:')).toBe(true);
  });

  it('falls back to root path when no remote', () => {
    const key = computeProjectKey(base);
    expect(key.startsWith('path:')).toBe(true);
  });

  it('falls back to path for non-git directories', () => {
    const key = computeProjectKey({ ...base, isGitRepository: false, remoteUrl: null, commonGitDir: null });
    expect(key.startsWith('path:')).toBe(true);
  });

  it('resolves worktree stable root to the main checkout', () => {
    const worktreeInfo: GitInfo = {
      isGitRepository: true,
      rootPath: '/repo-worktree',
      remoteUrl: null,
      branch: 'feature',
      worktreePath: '/repo-worktree',
      commonGitDir: '/repo/.git',
    };
    expect(resolveStableRootPath(worktreeInfo)).toBe('/repo');
  });
});
