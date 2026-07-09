"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hookDecisionResponseSchema = exports.approvalRequestBodySchema = exports.rawHookPayloadSchema = exports.RAW_HOOK_EVENT_NAMES = void 0;
const zod_1 = require("zod");
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
exports.RAW_HOOK_EVENT_NAMES = [
    'SessionStart',
    'UserPromptSubmit',
    'PreToolUse',
    'PostToolUse',
    'Notification',
    'PreCompact',
    'Stop',
    'SubagentStop',
    'SessionEnd',
];
exports.rawHookPayloadSchema = zod_1.z
    .object({
    session_id: zod_1.z.string().min(1).max(200),
    transcript_path: zod_1.z.string().max(4096).optional(),
    cwd: zod_1.z.string().min(1).max(4096),
    hook_event_name: zod_1.z.string().min(1).max(100),
})
    .passthrough();
/** Body for POST /api/claude/approval -- a PreToolUse hook asking whether to proceed. */
exports.approvalRequestBodySchema = exports.rawHookPayloadSchema.extend({
    tool_name: zod_1.z.string().min(1).max(200),
    tool_input: zod_1.z.record(zod_1.z.unknown()).optional(),
});
/** Official PreToolUse hook JSON output schema for permission decisions. */
exports.hookDecisionResponseSchema = zod_1.z.object({
    hookSpecificOutput: zod_1.z.object({
        hookEventName: zod_1.z.literal('PreToolUse'),
        permissionDecision: zod_1.z.enum(['allow', 'deny', 'ask']),
        permissionDecisionReason: zod_1.z.string().optional(),
    }),
});
