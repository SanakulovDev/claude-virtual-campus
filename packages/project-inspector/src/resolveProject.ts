import type { ResolvedProject } from '@campus/contracts';
import { resolveGitInfo } from './git';
import { computeProjectKey, deriveProjectName, resolveStableRootPath } from './projectKey';
import { detectTechnologyProfile } from './technology/detect';

/**
 * Resolves stable project identity + technology profile for an arbitrary working
 * directory. Works for git repos, non-git directories, and worktrees alike -- never
 * requires a project manifest to exist (spec section 12).
 */
export async function resolveProject(cwd: string): Promise<ResolvedProject> {
  const gitInfo = await resolveGitInfo(cwd);
  const projectKey = computeProjectKey(gitInfo);
  const rootPath = gitInfo.isGitRepository ? resolveStableRootPath(gitInfo) : cwd;
  const technologyProfile = await detectTechnologyProfile(rootPath).catch(() => null);

  return {
    projectKey,
    name: deriveProjectName(rootPath),
    rootPath,
    currentWorkingDirectory: cwd,
    remoteUrl: gitInfo.remoteUrl,
    branch: gitInfo.branch,
    worktreePath: gitInfo.worktreePath,
    isGitRepository: gitInfo.isGitRepository,
    technologyProfile,
  };
}
