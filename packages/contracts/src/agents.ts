import { z } from 'zod';
import type { AgentType } from './enums';

/**
 * Presentation identity for agents. The campus never invents working agents -- it only
 * ever visualizes the real main Claude and the real subagents Claude Code starts. These
 * tables give whatever agent types actually appear a human-readable name, a role label,
 * a short bio and a role accessory so the office reads like a team of teammates instead
 * of `subagent-abc`. Nothing here changes agent behaviour or grants any permission.
 */

/** Whether an agent's currently shown activity is real Claude work or client-side idle life. */
export type AgentActivitySource = 'real-work' | 'ambient-idle';

/** Curated pool of readable first names, assigned deterministically per project. */
export const AGENT_NAME_POOL = [
  'Lucy',
  'Jarvis',
  'Anna',
  'Milo',
  'Sofia',
  'Atlas',
  'Nova',
  'Leo',
  'Maya',
  'Oscar',
  'Iris',
  'Theo',
  'Luna',
  'Nora',
  'Felix',
  'Ava',
  'Kai',
  'Ruby',
  'Enzo',
  'Cleo',
  'Hugo',
  'Vera',
] as const;

/** The main-claude agent is always this fixed identity, never drawn from the pool. */
export const MAIN_CLAUDE_NAME = 'Claude';
export const MAIN_CLAUDE_ROLE = 'Team Lead';

/** Role accessories the low-poly avatar can add without a whole separate model. */
export const AGENT_ACCESSORIES = ['none', 'crown', 'notebook', 'headphones', 'clipboard', 'glasses', 'shield', 'tablet'] as const;
export type AgentAccessory = (typeof AGENT_ACCESSORIES)[number];

interface AgentProfile {
  role: string;
  bio: string;
  accessory: AgentAccessory;
}

/** Role label + short bio + avatar accessory for every known agent type. */
export const AGENT_PROFILES: Record<AgentType, AgentProfile> = {
  'main-claude': { role: MAIN_CLAUDE_ROLE, bio: 'Coordinates the team and delivers the final result.', accessory: 'crown' },
  explore: { role: 'Researcher', bio: 'Explores the codebase and gathers the context the team needs.', accessory: 'glasses' },
  plan: { role: 'Planner', bio: 'Breaks large tasks into clear steps and coordinates the team.', accessory: 'notebook' },
  'general-purpose': { role: 'Engineer', bio: 'Takes on whatever the task needs, following the project’s conventions.', accessory: 'headphones' },
  'backend-developer': { role: 'Backend Engineer', bio: 'Builds services and business logic behind the scenes.', accessory: 'headphones' },
  'frontend-developer': { role: 'Frontend Engineer', bio: 'Builds the user-facing interface and interactions.', accessory: 'headphones' },
  'fullstack-developer': { role: 'Full-Stack Engineer', bio: 'Works across the whole stack, front to back.', accessory: 'headphones' },
  'api-developer': { role: 'API Engineer', bio: 'Designs and implements the project’s APIs.', accessory: 'headphones' },
  'database-engineer': { role: 'Database Engineer', bio: 'Shapes the data model and keeps migrations safe.', accessory: 'clipboard' },
  'qa-engineer': { role: 'QA Engineer', bio: 'Runs tests, finds regressions and verifies completed work.', accessory: 'clipboard' },
  'code-reviewer': { role: 'Reviewer', bio: 'Inspects the final implementation for quality and correctness.', accessory: 'glasses' },
  'security-reviewer': { role: 'Security Reviewer', bio: 'Checks changes for security and safety issues.', accessory: 'shield' },
  'devops-engineer': { role: 'DevOps Engineer', bio: 'Handles builds, pipelines and deployment.', accessory: 'tablet' },
  'infrastructure-engineer': { role: 'Infrastructure Engineer', bio: 'Manages infrastructure and environments.', accessory: 'tablet' },
  'documentation-agent': { role: 'Documentation Agent', bio: 'Keeps docs clear and up to date.', accessory: 'notebook' },
  'unknown-agent': { role: 'Teammate', bio: 'A specialist teammate Claude Code started for this task.', accessory: 'none' },
};

/** Safe profile for any agent type, including ones not in the table. */
export function profileForAgentType(agentType: string): AgentProfile {
  return AGENT_PROFILES[agentType as AgentType] ?? AGENT_PROFILES['unknown-agent'];
}

/**
 * Deterministically pick a readable name not already taken in the project. Given the same
 * set of already-used names, this always returns the same next name, so identity is stable
 * across restarts. Falls back to a numbered name only if the whole pool is exhausted.
 */
export function pickAgentName(usedNames: Iterable<string>): string {
  const used = new Set(usedNames);
  for (const name of AGENT_NAME_POOL) {
    if (!used.has(name)) return name;
  }
  for (let n = 2; ; n += 1) {
    for (const name of AGENT_NAME_POOL) {
      const candidate = `${name} ${n}`;
      if (!used.has(candidate)) return candidate;
    }
  }
}

/**
 * Optional `<project>/.claude/campus.json`. Presentation only -- it renames/relabels the
 * teammates that Claude Code actually starts. It never grants permissions and never creates
 * a working agent that Claude did not start.
 */
export const campusTeamConfigSchema = z.object({
  projectName: z.string().optional(),
  team: z
    .array(
      z.object({
        agentType: z.string(),
        name: z.string().optional(),
        role: z.string().optional(),
      }),
    )
    .optional(),
});
export type CampusTeamConfig = z.infer<typeof campusTeamConfigSchema>;

/** Ambient idle activities. Purely visual client-side life -- never real Claude work. */
export const AMBIENT_ACTIVITIES = [
  { key: 'coffee', label: 'taking a coffee break', area: 'Coffee Area' },
  { key: 'stretch', label: 'stretching', area: 'Exercise Area' },
  { key: 'reading', label: 'reading at their desk', area: null },
  { key: 'plants', label: 'watering the plants', area: 'Garden' },
  { key: 'chess', label: 'playing chess', area: 'Game Table' },
  { key: 'pingpong', label: 'playing table tennis', area: 'Game Table' },
  { key: 'model', label: 'building a small model', area: 'Workshop Bench' },
  { key: 'sofa', label: 'resting on the sofa', area: 'Campus Plaza' },
  { key: 'plaza', label: 'visiting the campus plaza', area: 'Campus Plaza' },
  { key: 'chat', label: 'chatting with a teammate', area: 'Campus Plaza' },
  { key: 'walk', label: 'taking a short walk', area: null },
  { key: 'visit', label: 'visiting a neighbor team', area: null },
] as const;
export type AmbientActivity = (typeof AMBIENT_ACTIVITIES)[number];
