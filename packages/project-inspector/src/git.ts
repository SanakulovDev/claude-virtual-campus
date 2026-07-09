import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface GitInfo {
  isGitRepository: boolean;
  rootPath: string;
  remoteUrl: string | null;
  branch: string | null;
  worktreePath: string | null;
  commonGitDir: string | null;
}

async function git(cwd: string, args: string[]): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('git', args, { cwd, timeout: 3000 });
    return stdout.trim();
  } catch {
    return null;
  }
}

/**
 * Resolves git identity for a working directory using argv-based execFile calls only
 * (never shell interpolation). Returns isGitRepository: false for any directory that
 * is not inside a git work tree, including permission errors or missing git binary.
 */
export async function resolveGitInfo(cwd: string): Promise<GitInfo> {
  const toplevel = await git(cwd, ['rev-parse', '--show-toplevel']);
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
    git(cwd, ['remote', 'get-url', 'origin']),
    git(cwd, ['rev-parse', '--abbrev-ref', 'HEAD']),
    git(cwd, ['rev-parse', '--git-dir']),
    git(cwd, ['rev-parse', '--git-common-dir']),
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
