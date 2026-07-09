import { Injectable } from '@nestjs/common';
import { resolveProject, detectProjectModules } from '@campus/project-inspector';
import type { ProjectModule as DetectedProjectModule, ResolvedProject } from '@campus/contracts';

@Injectable()
export class ProjectResolverService {
  resolve(cwd: string): Promise<ResolvedProject> {
    return resolveProject(cwd);
  }

  detectModules(projectId: string, rootPath: string): Promise<DetectedProjectModule[]> {
    return detectProjectModules(projectId, rootPath);
  }
}
