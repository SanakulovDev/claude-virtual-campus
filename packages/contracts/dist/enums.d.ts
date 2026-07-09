export declare const AGENT_ACTIVITIES: readonly ["idle", "planning", "walking", "researching", "coding", "testing", "building", "reviewing", "formatting", "running_command", "managing_database", "managing_infrastructure", "meeting", "waiting_approval", "blocked", "failed", "completed"];
export type AgentActivity = (typeof AGENT_ACTIVITIES)[number];
export declare const AGENT_ANIMATIONS: readonly ["idle", "walk", "sit", "type", "read", "talk", "wait", "error", "celebrate"];
export type AgentAnimation = (typeof AGENT_ANIMATIONS)[number];
export declare const OFFICE_ZONE_KEYS: readonly ["entrance", "planning-table", "assigned-desk", "development-desk", "research-station", "testing-station", "build-station", "review-station", "database-station", "infrastructure-station", "terminal-station", "meeting-table", "approval-desk", "task-board"];
export type OfficeZoneKey = (typeof OFFICE_ZONE_KEYS)[number];
export declare const COMMAND_CATEGORIES: readonly ["test", "build", "lint", "format", "typecheck", "run", "serve", "install", "database", "migration", "container", "git", "deploy", "filesystem", "network", "inspection", "destructive", "unknown"];
export type CommandCategory = (typeof COMMAND_CATEGORIES)[number];
export declare const FILE_CATEGORIES: readonly ["source", "test", "configuration", "database", "migration", "documentation", "dependency", "infrastructure", "asset", "generated", "secret", "unknown"];
export type FileCategory = (typeof FILE_CATEGORIES)[number];
export declare const TECHNOLOGY_CATEGORIES: readonly ["language", "framework", "runtime", "package-manager", "build-tool", "test-tool", "linter", "database", "infrastructure", "unknown"];
export type TechnologyCategory = (typeof TECHNOLOGY_CATEGORIES)[number];
export declare const AGENT_TYPES: readonly ["main-claude", "explore", "plan", "general-purpose", "backend-developer", "frontend-developer", "fullstack-developer", "api-developer", "database-engineer", "qa-engineer", "code-reviewer", "security-reviewer", "devops-engineer", "infrastructure-engineer", "documentation-agent", "unknown-agent"];
export type AgentType = (typeof AGENT_TYPES)[number];
/** Zone assigned per command category, per spec section 5. */
export declare const COMMAND_CATEGORY_ZONE: Record<CommandCategory, OfficeZoneKey>;
