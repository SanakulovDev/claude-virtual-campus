import { z } from 'zod';

/**
 * Shape of JSON Claude Code writes to a hook's stdin. Common fields are documented
 * for every hook event; event-specific fields vary by hook_event_name, so we keep
 * those as a passthrough record and let the event-normalizer pick out what it needs.
 *
 * Hook events actually documented by Claude Code (verify against the installed CLI's
 * docs, we could not reach network docs while building this): SessionStart,
 * UserPromptSubmit, PreToolUse, PostToolUse, Notification, PreCompact, Stop,
 * SubagentStop, SessionEnd. Events named in the original spec that are NOT separate
 * documented hooks (PermissionRequest, PostToolUseFailure, SubagentStart, TaskCreated,
 * TaskCompleted, StopFailure, CwdChanged) are derived server-side from the events
 * above -- see packages/event-normalizer for the mapping and CLAUDE.md for the
 * rationale of each.
 */
export const RAW_HOOK_EVENT_NAMES = [
  'SessionStart',
  'UserPromptSubmit',
  'PreToolUse',
  'PostToolUse',
  'Notification',
  'PreCompact',
  'Stop',
  'SubagentStop',
  'SessionEnd',
] as const;
export type RawHookEventName = (typeof RAW_HOOK_EVENT_NAMES)[number];

export const rawHookPayloadSchema = z
  .object({
    session_id: z.string().min(1).max(200),
    transcript_path: z.string().max(4096).optional(),
    cwd: z.string().min(1).max(4096),
    hook_event_name: z.string().min(1).max(100),
  })
  .passthrough();
export type RawHookPayload = z.infer<typeof rawHookPayloadSchema>;

/** Body for POST /api/claude/approval -- a PreToolUse hook asking whether to proceed. */
export const approvalRequestBodySchema = rawHookPayloadSchema.extend({
  tool_name: z.string().min(1).max(200),
  tool_input: z.record(z.unknown()).optional(),
});
export type ApprovalRequestBody = z.infer<typeof approvalRequestBodySchema>;

/** Official PreToolUse hook JSON output schema for permission decisions. */
export const hookDecisionResponseSchema = z.object({
  hookSpecificOutput: z.object({
    hookEventName: z.literal('PreToolUse'),
    permissionDecision: z.enum(['allow', 'deny', 'ask']),
    permissionDecisionReason: z.string().optional(),
  }),
});
export type HookDecisionResponse = z.infer<typeof hookDecisionResponseSchema>;
