import path from 'node:path';
import type { FileCategory } from '@campus/contracts';

const SOURCE_EXTENSIONS = new Set([
  '.php', '.py', '.go', '.ts', '.tsx', '.js', '.jsx', '.java', '.kt', '.kts',
  '.rs', '.rb', '.cs', '.cpp', '.cc', '.c', '.h', '.hpp', '.ex', '.exs',
]);

const TEST_PATH_SEGMENTS = ['tests', 'test', '__tests__', 'spec'];
const TEST_FILENAME_PATTERNS = [
  /_test\.go$/, /^test_.*\.py$/, /_test\.py$/, /Test\.php$/, /\.spec\.ts$/, /\.test\.ts$/,
  /\.spec\.tsx?$/, /\.test\.tsx?$/, /_spec\.rb$/,
];

const MIGRATION_PATH_SEGMENTS = ['migrations', 'alembic', 'prisma'];
const DATABASE_FILENAME_PATTERNS = [/\.sql$/, /^schema\./];

const CONFIG_FILENAMES = new Set([
  'package.json', 'composer.json', 'pyproject.toml', 'go.mod', 'Cargo.toml', 'pom.xml',
  'tsconfig.json', '.eslintrc', '.eslintrc.json', '.prettierrc', 'build.gradle', 'Gemfile',
]);
const CONFIG_EXTENSIONS = new Set(['.yaml', '.yml', '.toml', '.ini', '.cfg']);

const DEPENDENCY_FILENAMES = new Set([
  'composer.lock', 'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lockb', 'bun.lock',
  'poetry.lock', 'uv.lock', 'Pipfile.lock', 'Cargo.lock', 'Gemfile.lock', 'go.sum', 'mix.lock',
]);

const INFRASTRUCTURE_FILENAMES = new Set(['Dockerfile', 'docker-compose.yml', 'docker-compose.yaml']);
const INFRASTRUCTURE_EXTENSIONS = new Set(['.tf']);

const DOCUMENTATION_EXTENSIONS = new Set(['.md', '.mdx', '.rst', '.adoc']);

const ASSET_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.ico', '.woff', '.woff2']);

const GENERATED_PATH_SEGMENTS = ['dist', 'build', 'node_modules', '.next', 'target', '__pycache__', 'vendor'];

const SENSITIVE_FILENAME_PATTERNS = [
  /^\.env(\..*)?$/, /\.pem$/, /\.key$/, /^id_rsa$/, /^id_ed25519$/, /^credentials\./, /^secrets\./,
];

export interface FileClassification {
  category: FileCategory;
  isSensitive: boolean;
  /** Path relative to the project root, forward-slash separated, with no leading '../'. */
  projectRelativePath: string;
}

/** Converts an absolute or arbitrary path to a safe, project-relative display path. */
export function toProjectRelativePath(filePath: string, rootPath: string): string {
  const relative = path.isAbsolute(filePath) ? path.relative(rootPath, filePath) : filePath;
  const normalized = relative.split(path.sep).join('/');
  if (normalized.startsWith('..')) {
    // Outside the project root: never leak the real absolute path, show only the basename.
    return `(outside-project)/${path.basename(filePath)}`;
  }
  return normalized;
}

/**
 * Classifies file activity using only the path/extension -- never file contents.
 * Never assumes a `src/` layout (spec section 6).
 */
export function classifyFile(filePath: string, rootPath: string): FileClassification {
  const projectRelativePath = toProjectRelativePath(filePath, rootPath);
  const segments = projectRelativePath.split('/');
  const filename = segments[segments.length - 1] ?? '';
  const ext = path.extname(filename);

  const isSensitive = SENSITIVE_FILENAME_PATTERNS.some((re) => re.test(filename));
  if (isSensitive) {
    return { category: 'secret', isSensitive: true, projectRelativePath };
  }

  if (segments.some((s) => GENERATED_PATH_SEGMENTS.includes(s))) {
    return { category: 'generated', isSensitive: false, projectRelativePath };
  }

  if (
    segments.some((s) => TEST_PATH_SEGMENTS.includes(s)) ||
    TEST_FILENAME_PATTERNS.some((re) => re.test(filename))
  ) {
    return { category: 'test', isSensitive: false, projectRelativePath };
  }

  if (
    segments.some((s) => MIGRATION_PATH_SEGMENTS.includes(s)) ||
    DATABASE_FILENAME_PATTERNS.some((re) => re.test(filename))
  ) {
    return { category: 'migration', isSensitive: false, projectRelativePath };
  }

  if (DEPENDENCY_FILENAMES.has(filename)) {
    return { category: 'dependency', isSensitive: false, projectRelativePath };
  }

  if (INFRASTRUCTURE_FILENAMES.has(filename) || INFRASTRUCTURE_EXTENSIONS.has(ext)) {
    return { category: 'infrastructure', isSensitive: false, projectRelativePath };
  }

  if (CONFIG_FILENAMES.has(filename) || CONFIG_EXTENSIONS.has(ext)) {
    return { category: 'configuration', isSensitive: false, projectRelativePath };
  }

  if (DOCUMENTATION_EXTENSIONS.has(ext)) {
    return { category: 'documentation', isSensitive: false, projectRelativePath };
  }

  if (ASSET_EXTENSIONS.has(ext)) {
    return { category: 'asset', isSensitive: false, projectRelativePath };
  }

  if (SOURCE_EXTENSIONS.has(ext)) {
    return { category: 'source', isSensitive: false, projectRelativePath };
  }

  return { category: 'unknown', isSensitive: false, projectRelativePath };
}
