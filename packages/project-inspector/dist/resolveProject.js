"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveProject = resolveProject;
const git_1 = require("./git");
const projectKey_1 = require("./projectKey");
const detect_1 = require("./technology/detect");
/**
 * Resolves stable project identity + technology profile for an arbitrary working
 * directory. Works for git repos, non-git directories, and worktrees alike -- never
 * requires a project manifest to exist (spec section 12).
 */
async function resolveProject(cwd) {
    const gitInfo = await (0, git_1.resolveGitInfo)(cwd);
    const projectKey = (0, projectKey_1.computeProjectKey)(gitInfo);
    const rootPath = gitInfo.isGitRepository ? (0, projectKey_1.resolveStableRootPath)(gitInfo) : cwd;
    const technologyProfile = await (0, detect_1.detectTechnologyProfile)(rootPath).catch(() => null);
    return {
        projectKey,
        name: (0, projectKey_1.deriveProjectName)(rootPath),
        rootPath,
        currentWorkingDirectory: cwd,
        remoteUrl: gitInfo.remoteUrl,
        branch: gitInfo.branch,
        worktreePath: gitInfo.worktreePath,
        isGitRepository: gitInfo.isGitRepository,
        technologyProfile,
    };
}
