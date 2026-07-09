import type { GitInfo } from './git';
/** Normalizes ssh/https/git-protocol remote URLs to one comparable form. */
export declare function normalizeRemoteUrl(remoteUrl: string): string;
/** Main repo root even when cwd is inside a linked worktree, so worktrees share a project. */
export declare function resolveStableRootPath(git: GitInfo): string;
export declare function computeProjectKey(git: GitInfo): string;
export declare function deriveProjectName(rootPath: string): string;
