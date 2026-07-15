import { z } from 'zod';
import {
  AGENT_ACTIVITIES,
  AGENT_ANIMATIONS,
  COMMAND_CATEGORIES,
  FILE_CATEGORIES,
  OFFICE_ZONE_KEYS,
  AGENT_RUNTIMES,
} from './enums';

export const normalizedAgentEventSchema = z.object({
  id: z.string(),
  runtime: z.enum(AGENT_RUNTIMES),
  projectId: z.string(),
  projectModuleId: z.string().nullable(),
  sessionId: z.string(),
  agentId: z.string(),
  hookEventName: z.string(),
  normalizedType: z.string(),
  activity: z.enum(AGENT_ACTIVITIES),
  targetZoneKey: z.enum(OFFICE_ZONE_KEYS),
  workSummary: z.string(),
  toolName: z.string().nullable(),
  filePath: z.string().nullable(),
  fileCategory: z.enum(FILE_CATEGORIES).nullable(),
  commandSummary: z.string().nullable(),
  commandCategory: z.enum(COMMAND_CATEGORIES).nullable(),
  occurredAt: z.string(),
  safeMetadata: z.record(z.unknown()),
});
export type NormalizedAgentEvent = z.infer<typeof normalizedAgentEventSchema>;

/** Backward-compatible aliases for the original Claude-only contract name. */
export const normalizedClaudeEventSchema = normalizedAgentEventSchema;
export type NormalizedClaudeEvent = NormalizedAgentEvent;

export const campusAgentStateSchema = z.object({
  id: z.string(),
  runtime: z.enum(AGENT_RUNTIMES),
  projectId: z.string(),
  projectModuleId: z.string().nullable(),
  sessionId: z.string().nullable(),
  externalAgentId: z.string().nullable(),
  agentType: z.string(),
  displayName: z.string(),
  status: z.string(),
  activity: z.enum(AGENT_ACTIVITIES),
  animation: z.enum(AGENT_ANIMATIONS),
  currentZoneKey: z.enum(OFFICE_ZONE_KEYS),
  targetZoneKey: z.enum(OFFICE_ZONE_KEYS),
  currentTaskTitle: z.string().nullable(),
  currentTool: z.string().nullable(),
  currentFile: z.string().nullable(),
  currentCommandSummary: z.string().nullable(),
  commandCategory: z.enum(COMMAND_CATEGORIES).nullable(),
  lastEventAt: z.string(),
});
export type CampusAgentState = z.infer<typeof campusAgentStateSchema>;

export const approvalDecisionSchema = z.enum(['allow', 'deny']);
export type ApprovalDecision = z.infer<typeof approvalDecisionSchema>;
