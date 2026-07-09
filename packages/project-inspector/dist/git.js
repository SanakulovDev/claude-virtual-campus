"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveGitInfo = resolveGitInfo;
const node_child_process_1 = require("node:child_process");
const node_util_1 = require("node:util");
const execFileAsync = (0, node_util_1.promisify)(node_child_process_1.execFile);
async function git(cwd, args) {
    try {
        const { stdout } = await execFileAsync('git', args, { cwd, timeout: 3000 });
        return stdout.trim();
    }
    catch {
        return null;
    }
}
/**
 * Resolves git identity for a working directory using argv-based execFile calls only
 * (never shell interpolation). Returns isGitRepository: false for any directory that
 * is not inside a git work tree, including permission errors or missing git binary.
 */
async function resolveGitInfo(cwd) {
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
