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
export declare const RAW_HOOK_EVENT_NAMES: readonly ["SessionStart", "UserPromptSubmit", "PreToolUse", "PostToolUse", "Notification", "PreCompact", "Stop", "SubagentStop", "SessionEnd"];
export type RawHookEventName = (typeof RAW_HOOK_EVENT_NAMES)[number];
export declare const rawHookPayloadSchema: z.ZodObject<{
    session_id: z.ZodString;
    transcript_path: z.ZodOptional<z.ZodString>;
    cwd: z.ZodString;
    hook_event_name: z.ZodString;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    session_id: z.ZodString;
    transcript_path: z.ZodOptional<z.ZodString>;
    cwd: z.ZodString;
    hook_event_name: z.ZodString;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    session_id: z.ZodString;
    transcript_path: z.ZodOptional<z.ZodString>;
    cwd: z.ZodString;
    hook_event_name: z.ZodString;
}, z.ZodTypeAny, "passthrough">>;
export type RawHookPayload = z.infer<typeof rawHookPayloadSchema>;
/** Body for POST /api/claude/approval -- a PreToolUse hook asking whether to proceed. */
export declare const approvalRequestBodySchema: z.ZodObject<{
    session_id: z.ZodString;
    transcript_path: z.ZodOptional<z.ZodString>;
    cwd: z.ZodString;
    hook_event_name: z.ZodString;
} & {
    tool_name: z.ZodString;
    tool_input: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    session_id: z.ZodString;
    transcript_path: z.ZodOptional<z.ZodString>;
    cwd: z.ZodString;
    hook_event_name: z.ZodString;
} & {
    tool_name: z.ZodString;
    tool_input: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    session_id: z.ZodString;
    transcript_path: z.ZodOptional<z.ZodString>;
    cwd: z.ZodString;
    hook_event_name: z.ZodString;
} & {
    tool_name: z.ZodString;
    tool_input: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodUnknown>>;
}, z.ZodTypeAny, "passthrough">>;
export type ApprovalRequestBody = z.infer<typeof approvalRequestBodySchema>;
/** Official PreToolUse hook JSON output schema for permission decisions. */
export declare const hookDecisionResponseSchema: z.ZodObject<{
    hookSpecificOutput: z.ZodObject<{
        hookEventName: z.ZodLiteral<"PreToolUse">;
        permissionDecision: z.ZodEnum<["allow", "deny", "ask"]>;
        permissionDecisionReason: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        hookEventName: "PreToolUse";
        permissionDecision: "allow" | "deny" | "ask";
        permissionDecisionReason?: string | undefined;
    }, {
        hookEventName: "PreToolUse";
        permissionDecision: "allow" | "deny" | "ask";
        permissionDecisionReason?: string | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    hookSpecificOutput: {
        hookEventName: "PreToolUse";
        permissionDecision: "allow" | "deny" | "ask";
        permissionDecisionReason?: string | undefined;
    };
}, {
    hookSpecificOutput: {
        hookEventName: "PreToolUse";
        permissionDecision: "allow" | "deny" | "ask";
        permissionDecisionReason?: string | undefined;
    };
}>;
export type HookDecisionResponse = z.infer<typeof hookDecisionResponseSchema>;
