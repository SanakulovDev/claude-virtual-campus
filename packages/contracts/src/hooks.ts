import { z } from 'zod';

/** Hook events accepted from Claude Code and Codex. Runtime-specific routes identify
 * the producer; the payload remains passthrough because event fields vary by hook. */
export const RAW_HOOK_EVENT_NAMES = [
  'SessionStart',
  'UserPromptSubmit',
  'PreToolUse',
  'PermissionRequest',
  'PostToolUse',
  'Notification',
  'PreCompact',
  'PostCompact',
  'SubagentStart',
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

/** Body for either runtime's approval endpoint. */
export const approvalRequestBodySchema = rawHookPayloadSchema.extend({
  tool_name: z.string().min(1).max(200),
  tool_input: z.record(z.unknown()).optional(),
});
export type ApprovalRequestBody = z.infer<typeof approvalRequestBodySchema>;

/** Claude Code PreToolUse decision response. */
export const claudeHookDecisionResponseSchema = z.object({
  hookSpecificOutput: z.object({
    hookEventName: z.literal('PreToolUse'),
    permissionDecision: z.enum(['allow', 'deny', 'ask']),
    permissionDecisionReason: z.string().optional(),
  }),
});
export type ClaudeHookDecisionResponse = z.infer<typeof claudeHookDecisionResponseSchema>;

/** Codex PermissionRequest decision response. */
export const codexHookDecisionResponseSchema = z.object({
  hookSpecificOutput: z.object({
    hookEventName: z.literal('PermissionRequest'),
    decision: z.object({
      behavior: z.enum(['allow', 'deny']),
      message: z.string().optional(),
    }),
  }),
});
export type CodexHookDecisionResponse = z.infer<typeof codexHookDecisionResponseSchema>;

export const hookDecisionResponseSchema = z.union([
  claudeHookDecisionResponseSchema,
  codexHookDecisionResponseSchema,
]);
export type HookDecisionResponse = z.infer<typeof hookDecisionResponseSchema>;
