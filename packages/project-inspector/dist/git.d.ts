export interface GitInfo {
    isGitRepository: boolean;
    rootPath: string;
    remoteUrl: string | null;
    branch: string | null;
    worktreePath: string | null;
    commonGitDir: string | null;
}
/**
 * Resolves git identity for a working directory using argv-based execFile calls only
 * (never shell interpolation). Returns isGitRepository: false for any directory that
 * is not inside a git work tree, including permission errors or missing git binary.
 */
export declare function resolveGitInfo(cwd: string): Promise<GitInfo>;
