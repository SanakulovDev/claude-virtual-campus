import { describe, expect, it } from 'vitest';
import { computeProjectKey, normalizeRemoteUrl, resolveStableRootPath } from './projectKey';
import type { GitInfo } from './git';

describe('normalizeRemoteUrl', () => {
  it('normalizes ssh and https forms to the same value', () => {
    const ssh = normalizeRemoteUrl('git@github.com:acme/widgets.git');
    const https = normalizeRemoteUrl('https://github.com/acme/widgets.git');
    expect(ssh).toBe(https);
  });

  it('strips embedded userinfo (https token clones)', () => {
    expect(normalizeRemoteUrl('https://x-access-token:SECRET@github.com/acme/widgets.git')).toBe(
      normalizeRemoteUrl('https://github.com/acme/widgets.git'),
    );
    expect(normalizeRemoteUrl('https://user@github.com/acme/widgets')).toBe(
      normalizeRemoteUrl('https://github.com/acme/widgets'),
    );
  });

  it('strips userinfo even when the password contains an unencoded @', () => {
    expect(normalizeRemoteUrl('https://user:p@ssword@github.com/acme/widgets')).toBe(
      normalizeRemoteUrl('https://github.com/acme/widgets'),
    );
  });

  it('strips default ports so ssh:// and scp forms match', () => {
    expect(normalizeRemoteUrl('ssh://git@github.com:22/acme/widgets.git')).toBe(
      normalizeRemoteUrl('git@github.com:acme/widgets.git'),
    );
    expect(normalizeRemoteUrl('https://github.com:443/acme/widgets')).toBe(
      normalizeRemoteUrl('https://github.com/acme/widgets'),
    );
  });

  it('keeps non-default ports distinct', () => {
    expect(normalizeRemoteUrl('ssh://git@git.corp:2222/acme/widgets')).not.toBe(
      normalizeRemoteUrl('ssh://git@git.corp/acme/widgets'),
    );
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
