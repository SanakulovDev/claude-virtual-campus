import { createHash } from 'node:crypto';
import path from 'node:path';
import type { GitInfo } from './git';

/** Normalizes ssh/https/git-protocol remote URLs to one comparable form. */
export function normalizeRemoteUrl(remoteUrl: string): string {
  let value = remoteUrl.trim().toLowerCase();
  value = value.replace(/\.git$/, '');
  value = value.replace(/^git@([^:]+):/, 'https://$1/');
  value = value.replace(/^ssh:\/\/git@/, 'https://');
  value = value.replace(/^git:\/\//, 'https://');
  value = value.replace(/\/+$/, '');
  return value;
}

/** Main repo root even when cwd is inside a linked worktree, so worktrees share a project. */
export function resolveStableRootPath(git: GitInfo): string {
  if (git.worktreePath && git.commonGitDir) {
    const gitDirName = path.basename(git.commonGitDir);
    if (gitDirName === '.git') {
      return path.dirname(git.commonGitDir);
    }
  }
  return git.rootPath;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 32);
}

export function computeProjectKey(git: GitInfo): string {
  if (git.isGitRepository && git.remoteUrl) {
    return `remote:${sha256(normalizeRemoteUrl(git.remoteUrl))}`;
  }
  const stableRoot = git.isGitRepository ? resolveStableRootPath(git) : git.rootPath;
  return `path:${sha256(path.resolve(stableRoot))}`;
}

export function deriveProjectName(rootPath: string): string {
  return path.basename(rootPath) || rootPath;
}
