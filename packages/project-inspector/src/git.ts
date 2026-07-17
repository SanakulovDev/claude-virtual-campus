import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const DEFAULT_GIT_TIMEOUT_MS = 3000;

export interface GitInfo {
  isGitRepository: boolean;
  rootPath: string;
  remoteUrl: string | null;
  branch: string | null;
  worktreePath: string | null;
  commonGitDir: string | null;
}

export interface ResolveGitOptions {
  /** Raise this on machines where git is slow (huge repos, network filesystems). */
  timeoutMs?: number;
}

/** Thrown when git could not answer at all, so project identity is unknown rather than absent. */
export class GitUnavailableError extends Error {
  constructor(args: string[], options?: { cause?: unknown }) {
    super(`git ${args.join(' ')} did not complete`, options);
    this.name = 'GitUnavailableError';
  }
}

/**
 * A timeout kill is transient: the same directory answers differently on the next call, so
 * treating it as "not a repository" would mint a second identity for a project that already
 * has one. Every other failure is a stable answer -- a non-zero exit means git ran and said
 * no, and a missing git binary answers the same way on every call -- so those keep their
 * null result and non-git projects continue to work.
 */
export function isTransientGitFailure(error: unknown): boolean {
  return (error as { killed?: boolean } | null)?.killed === true;
}

async function git(cwd: string, args: string[], timeoutMs: number): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('git', args, { cwd, timeout: timeoutMs });
    return stdout.trim();
  } catch (error) {
    if (isTransientGitFailure(error)) throw new GitUnavailableError(args, { cause: error });
    return null;
  }
}

/**
 * Resolves git identity for a working directory using argv-based execFile calls only
 * (never shell interpolation). Returns isGitRepository: false for any directory that git
 * reports is not inside a work tree, including permission errors or a missing git binary.
 * Throws GitUnavailableError if git could not answer, so a transient failure never
 * downgrades a known repository to a fresh path-based identity.
 */
export async function resolveGitInfo(cwd: string, options: ResolveGitOptions = {}): Promise<GitInfo> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_GIT_TIMEOUT_MS;
  const toplevel = await git(cwd, ['rev-parse', '--show-toplevel'], timeoutMs);
  if (!toplevel) {
    return {
      isGitRepository: false,
      rootPath: cwd,
      remoteUrl: null,
      branch: null,
      worktreePath: null,
      commonGitDir: null,
    };
  }

  const [remoteUrl, branch, gitDir, commonGitDir] = await Promise.all([
    git(cwd, ['remote', 'get-url', 'origin'], timeoutMs),
    git(cwd, ['rev-parse', '--abbrev-ref', 'HEAD'], timeoutMs),
    git(cwd, ['rev-parse', '--git-dir'], timeoutMs),
    git(cwd, ['rev-parse', '--git-common-dir'], timeoutMs),
  ]);

  // A worktree's --git-dir differs from --git-common-dir; the main checkout's don't.
  const isWorktree = Boolean(gitDir && commonGitDir && gitDir !== commonGitDir);

  return {
    isGitRepository: true,
    rootPath: toplevel,
    remoteUrl: remoteUrl ?? null,
    branch: branch && branch !== 'HEAD' ? branch : null,
    worktreePath: isWorktree ? toplevel : null,
    commonGitDir: commonGitDir ?? null,
  };
}
