import { readdir } from 'node:fs/promises';
import path from 'node:path';
import type { ProjectModule } from '@campus/contracts';
import { detectTechnologyProfile } from './technology/detect';

const IGNORED_DIRS = new Set([
  'node_modules', '.git', 'vendor', 'dist', 'build', '.venv', 'venv',
  '__pycache__', 'target', '.turbo', '.next', 'bin', 'obj', '.idea', '.vscode',
]);

const MANIFEST_FILENAMES = new Set([
  'composer.json', 'pyproject.toml', 'requirements.txt', 'manage.py', 'go.mod',
  'package.json', 'Cargo.toml', 'pom.xml', 'build.gradle', 'build.gradle.kts',
  'Gemfile', 'mix.exs', 'CMakeLists.txt',
]);

/**
 * Shallow (depth-1) scan for nested application directories in a monorepo, per spec
 * section 13: the git repo stays the one project room, nested apps become modules.
 */
export async function detectProjectModules(
  projectId: string,
  rootPath: string,
): Promise<ProjectModule[]> {
  let dirents: string[] = [];
  try {
    const entries = await readdir(rootPath, { withFileTypes: true });
    dirents = entries.filter((e) => e.isDirectory() && !IGNORED_DIRS.has(e.name) && !e.name.startsWith('.')).map((e) => e.name);
  } catch {
    return [];
  }

  const modules: ProjectModule[] = [];
  for (const dirName of dirents) {
    const absolutePath = path.join(rootPath, dirName);
    let hasManifest = false;
    try {
      const inner = await readdir(absolutePath, { withFileTypes: true });
      hasManifest = inner.some((e) => e.isFile() && MANIFEST_FILENAMES.has(e.name));
    } catch {
      continue;
    }
    if (!hasManifest) continue;

    const technologyProfile = await detectTechnologyProfile(absolutePath);
    modules.push({
      id: `${projectId}:${dirName}`,
      projectId,
      name: dirName,
      relativePath: dirName,
      technologyProfile,
    });
  }
  return modules;
}
