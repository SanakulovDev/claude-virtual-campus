export const AGENT_ACTIVITIES = [
  'idle',
  'planning',
  'walking',
  'researching',
  'coding',
  'testing',
  'building',
  'reviewing',
  'formatting',
  'running_command',
  'managing_database',
  'managing_infrastructure',
  'meeting',
  'waiting_approval',
  'blocked',
  'failed',
  'completed',
] as const;
export type AgentActivity = (typeof AGENT_ACTIVITIES)[number];

export const AGENT_ANIMATIONS = [
  'idle',
  'walk',
  'sit',
  'type',
  'read',
  'talk',
  'wait',
  'error',
  'celebrate',
] as const;
export type AgentAnimation = (typeof AGENT_ANIMATIONS)[number];

export const OFFICE_ZONE_KEYS = [
  'entrance',
  'planning-table',
  'assigned-desk',
  'development-desk',
  'research-station',
  'testing-station',
  'build-station',
  'review-station',
  'database-station',
  'infrastructure-station',
  'terminal-station',
  'meeting-table',
  'approval-desk',
  'task-board',
] as const;
export type OfficeZoneKey = (typeof OFFICE_ZONE_KEYS)[number];

export const COMMAND_CATEGORIES = [
  'test',
  'build',
  'lint',
  'format',
  'typecheck',
  'run',
  'serve',
  'install',
  'database',
  'migration',
  'container',
  'git',
  'deploy',
  'filesystem',
  'network',
  'inspection',
  'destructive',
  'unknown',
] as const;
export type CommandCategory = (typeof COMMAND_CATEGORIES)[number];

export const FILE_CATEGORIES = [
  'source',
  'test',
  'configuration',
  'database',
  'migration',
  'documentation',
  'dependency',
  'infrastructure',
  'asset',
  'generated',
  'secret',
  'unknown',
] as const;
export type FileCategory = (typeof FILE_CATEGORIES)[number];

export const TECHNOLOGY_CATEGORIES = [
  'language',
  'framework',
  'runtime',
  'package-manager',
  'build-tool',
  'test-tool',
  'linter',
  'database',
  'infrastructure',
  'unknown',
] as const;
export type TechnologyCategory = (typeof TECHNOLOGY_CATEGORIES)[number];

export const AGENT_TYPES = [
  'main-claude',
  'explore',
  'plan',
  'general-purpose',
  'backend-developer',
  'frontend-developer',
  'fullstack-developer',
  'api-developer',
  'database-engineer',
  'qa-engineer',
  'code-reviewer',
  'security-reviewer',
  'devops-engineer',
  'infrastructure-engineer',
  'documentation-agent',
  'unknown-agent',
] as const;
export type AgentType = (typeof AGENT_TYPES)[number];

/** Zone assigned per command category, per spec section 5. */
export const COMMAND_CATEGORY_ZONE: Record<CommandCategory, OfficeZoneKey> = {
  test: 'testing-station',
  build: 'build-station',
  lint: 'review-station',
  format: 'development-desk',
  typecheck: 'review-station',
  run: 'development-desk',
  serve: 'development-desk',
  install: 'terminal-station',
  database: 'database-station',
  migration: 'database-station',
  container: 'infrastructure-station',
  git: 'review-station',
  deploy: 'approval-desk',
  filesystem: 'development-desk',
  network: 'terminal-station',
  inspection: 'research-station',
  destructive: 'approval-desk',
  unknown: 'terminal-station',
};
