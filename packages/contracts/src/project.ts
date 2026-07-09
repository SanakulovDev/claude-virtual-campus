import { z } from 'zod';
import { projectTechnologyProfileSchema } from './technology';

export const resolvedProjectSchema = z.object({
  projectKey: z.string(),
  name: z.string(),
  rootPath: z.string(),
  currentWorkingDirectory: z.string(),
  remoteUrl: z.string().nullable(),
  branch: z.string().nullable(),
  worktreePath: z.string().nullable(),
  isGitRepository: z.boolean(),
  technologyProfile: projectTechnologyProfileSchema.nullable(),
});
export type ResolvedProject = z.infer<typeof resolvedProjectSchema>;

export const projectModuleSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  name: z.string(),
  relativePath: z.string(),
  technologyProfile: projectTechnologyProfileSchema,
});
export type ProjectModule = z.infer<typeof projectModuleSchema>;
