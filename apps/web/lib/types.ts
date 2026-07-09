import type { AgentActivity, AgentAnimation, CommandCategory, OfficeZoneKey } from '@campus/contracts';

export interface TechnologyRow {
  id: string;
  techId: string;
  displayName: string;
  category: string;
  confidence: number;
  evidence: string[];
}

export interface ModuleRow {
  id: string;
  name: string;
  relativePath: string;
  primaryLanguage: string | null;
}

export interface AgentRow {
  id: string;
  projectId: string;
  externalAgentId: string | null;
  agentType: string;
  displayName: string;
  status: string;
  activity: AgentActivity;
  currentZoneKey: OfficeZoneKey;
  currentTaskId: string | null;
  currentSessionId: string | null;
  currentTool?: string | null;
  currentFile?: string | null;
  currentCommandSummary?: string | null;
  commandCategory?: CommandCategory | null;
  lastSeenAt: string;
}

export interface SessionRow {
  id: string;
  externalSessionId: string;
  status: string;
  branch: string | null;
  cwd: string;
  startedAt: string;
}

export interface TaskRow {
  id: string;
  title: string;
  status: string;
  createdAt: string;
}

export interface ProjectRow {
  id: string;
  projectKey: string;
  name: string;
  rootPath: string;
  remoteUrl: string | null;
  isGitRepository: boolean;
  roomTemplate: 'SMALL' | 'MEDIUM' | 'LARGE';
  roomPositionX: number;
  roomPositionZ: number;
  technologies: TechnologyRow[];
  modules: ModuleRow[];
  agents: AgentRow[];
  sessions?: SessionRow[];
  tasks?: TaskRow[];
}

export interface ApprovalRow {
  id: string;
  projectId: string;
  toolName: string;
  safeSummary: string;
  commandCategory: string | null;
  status: 'PENDING' | 'ALLOWED' | 'DENIED' | 'TIMED_OUT';
  requestedAt: string;
}

export interface TimelineEntry {
  id: string;
  projectId: string;
  hookEventName: string;
  normalizedType: string;
  toolName: string | null;
  receivedAt: string;
}

export type { AgentAnimation };
