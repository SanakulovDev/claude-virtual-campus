import type { ResolvedProject } from '@campus/contracts';
/**
 * Resolves stable project identity + technology profile for an arbitrary working
 * directory. Works for git repos, non-git directories, and worktrees alike -- never
 * requires a project manifest to exist (spec section 12).
 */
export declare function resolveProject(cwd: string): Promise<ResolvedProject>;
