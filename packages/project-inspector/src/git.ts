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
 * has one. The same holds for any signal-terminated git and for resource-exhaustion errnos
 * (EAGAIN/EMFILE/ENOMEM/ETIMEDOUT) under load. Every other failure is a stable answer -- a
 * non-zero exit means git ran and said no, and a missing git binary (ENOENT) answers the
 * same way on every call -- so those keep their null result and non-git projects keep working.
 */
const TRANSIENT_ERRNO_CODES = new Set(['EAGAIN', 'EMFILE', 'ENOMEM', 'ETIMEDOUT']);

export function isTransientGitFailure(error: unknown): boolean {
  const failure = error as { killed?: boolean; signal?: string | null; code?: unknown } | null;
  if (!failure) return false;
  if (failure.killed === true) return true;
  if (typeof failure.signal === 'string' && failure.signal.length > 0) return true;
  return typeof failure.code === 'string' && TRANSIENT_ERRNO_CODES.has(failure.code);
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

/** origin first; otherwise the first remote git lists. Zero remotes -> null (path: identity). */
async function resolveRemoteUrl(cwd: string, timeoutMs: number): Promise<string | null> {
  const originUrl = await git(cwd, ['remote', 'get-url', 'origin'], timeoutMs);
  if (originUrl) return originUrl;
  const remotes = await git(cwd, ['remote'], timeoutMs);
  const first = remotes
    ?.split('\n')
    .map((name) => name.trim())
    .filter(Boolean)[0];
  if (!first) return null;
  return git(cwd, ['remote', 'get-url', first], timeoutMs);
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
    resolveRemoteUrl(cwd, timeoutMs),
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
