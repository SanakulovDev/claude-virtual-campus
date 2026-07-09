import type { ProjectModule } from '@campus/contracts';
/**
 * Shallow (depth-1) scan for nested application directories in a monorepo, per spec
 * section 13: the git repo stays the one project room, nested apps become modules.
 */
export declare function detectProjectModules(projectId: string, rootPath: string): Promise<ProjectModule[]>;
