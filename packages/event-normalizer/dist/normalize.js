"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toProjectRelativePath = void 0;
exports.normalizeHookEvent = normalizeHookEvent;
const contracts_1 = require("@campus/contracts");
const commandClassifier_1 = require("./commandClassifier");
const fileClassifier_1 = require("./fileClassifier");
Object.defineProperty(exports, "toProjectRelativePath", { enumerable: true, get: function () { return fileClassifier_1.toProjectRelativePath; } });
const redact_1 = require("./redact");
const READ_TOOLS = new Set(['Read', 'Grep', 'Glob', 'NotebookRead', 'WebFetch', 'WebSearch']);
const WRITE_TOOLS = new Set(['Edit', 'Write', 'NotebookEdit', 'MultiEdit']);
const COMMAND_CATEGORY_ACTIVITY = {
    test: 'testing',
    build: 'building',
    lint: 'reviewing',
    format: 'formatting',
    typecheck: 'reviewing',
    run: 'coding',
    serve: 'coding',
    install: 'running_command',
    database: 'managing_database',
    migration: 'managing_database',
    container: 'managing_infrastructure',
    git: 'running_command',
    deploy: 'waiting_approval',
    filesystem: 'running_command',
    network: 'running_command',
    inspection: 'researching',
    destructive: 'waiting_approval',
    unknown: 'running_command',
};
function truncate(value, max = 160) {
    return value.length > max ? `${value.slice(0, max)}...` : value;
}
function extractFilePath(toolInput) {
    if (!toolInput)
        return null;
    const candidate = toolInput.file_path ?? toolInput.path ?? toolInput.notebook_path;
    return typeof candidate === 'string' ? candidate : null;
}
/**
 * Converts one raw Claude Code hook payload into an observable, language-agnostic
 * normalized event core. Never exposes hidden reasoning -- only tool names, file
 * paths, and commands the tool call itself already made observable (spec section 16).
 */
function normalizeHookEvent(raw, rootPath) {
    const hookEventName = raw.hook_event_name;
    const toolName = typeof raw.tool_name === 'string' ? raw.tool_name : null;
    const toolInput = raw.tool_input ?? undefined;
    const safeMetadata = (0, redact_1.redactSensitiveData)({ tool_input: toolInput });
    const base = {
        normalizedType: 'unknown',
        activity: 'idle',
        targetZoneKey: 'entrance',
        workSummary: hookEventName,
        toolName,
        filePath: null,
        fileCategory: null,
        commandSummary: null,
        commandCategory: null,
        safeMetadata,
        isSubagentStart: false,
        isTaskCompletionSignal: false,
        isFailure: false,
    };
    switch (hookEventName) {
        case 'SessionStart':
            return { ...base, normalizedType: 'session_start', activity: 'idle', targetZoneKey: 'entrance', workSummary: 'Session started' };
        case 'UserPromptSubmit': {
            const prompt = typeof raw.prompt === 'string' ? raw.prompt : '';
            return {
                ...base,
                normalizedType: 'user_prompt_submit',
                activity: 'planning',
                targetZoneKey: 'planning-table',
                workSummary: prompt ? `New task: ${truncate(prompt)}` : 'New task requested',
            };
        }
        case 'PreToolUse': {
            if (toolName === 'Task') {
                return { ...base, normalizedType: 'subagent_start', activity: 'walking', targetZoneKey: 'assigned-desk', workSummary: 'Subagent starting', isSubagentStart: true };
            }
            if (toolName && READ_TOOLS.has(toolName)) {
                const filePath = extractFilePath(toolInput);
                const fileClassification = filePath ? (0, fileClassifier_1.classifyFile)(filePath, rootPath) : null;
                return {
                    ...base,
                    normalizedType: 'file_read',
                    activity: 'researching',
                    targetZoneKey: 'research-station',
                    workSummary: filePath ? `Reading ${fileClassification?.projectRelativePath}` : `Using ${toolName}`,
                    filePath: fileClassification?.projectRelativePath ?? null,
                    fileCategory: fileClassification?.category ?? null,
                };
            }
            if (toolName && WRITE_TOOLS.has(toolName)) {
                const filePath = extractFilePath(toolInput);
                const fileClassification = filePath ? (0, fileClassifier_1.classifyFile)(filePath, rootPath) : null;
                return {
                    ...base,
                    normalizedType: 'file_edit',
                    activity: 'coding',
                    targetZoneKey: 'development-desk',
                    workSummary: filePath ? `Editing ${fileClassification?.projectRelativePath}` : `Using ${toolName}`,
                    filePath: fileClassification?.projectRelativePath ?? null,
                    fileCategory: fileClassification?.category ?? null,
                };
            }
            if (toolName === 'Bash') {
                const command = typeof toolInput?.command === 'string' ? toolInput.command : '';
                const classification = (0, commandClassifier_1.classifyCommand)(command);
                return {
                    ...base,
                    normalizedType: 'command_run',
                    activity: COMMAND_CATEGORY_ACTIVITY[classification.category],
                    targetZoneKey: contracts_1.COMMAND_CATEGORY_ZONE[classification.category],
                    workSummary: `Running: ${truncate(command)}`,
                    commandSummary: truncate(command),
                    commandCategory: classification.category,
                };
            }
            return { ...base, normalizedType: 'tool_use', activity: 'running_command', targetZoneKey: 'terminal-station', workSummary: `Using ${toolName ?? 'a tool'}` };
        }
        case 'PostToolUse': {
            const isError = Boolean(raw.tool_response &&
                typeof raw.tool_response === 'object' &&
                (raw.tool_response.is_error ||
                    raw.tool_response.error));
            const pre = normalizeHookEvent({ ...raw, hook_event_name: 'PreToolUse' }, rootPath);
            if (isError) {
                return { ...pre, normalizedType: 'tool_failed', activity: 'failed', isFailure: true, workSummary: `Failed: ${pre.workSummary}` };
            }
            return { ...pre, normalizedType: 'tool_completed', workSummary: `Completed: ${pre.workSummary}` };
        }
        case 'Notification':
            return { ...base, normalizedType: 'notification', activity: 'waiting_approval', targetZoneKey: 'approval-desk', workSummary: typeof raw.message === 'string' ? truncate(raw.message) : 'Waiting for input' };
        case 'PreCompact':
            return { ...base, normalizedType: 'pre_compact', activity: 'idle', targetZoneKey: 'entrance', workSummary: 'Compacting context' };
        case 'Stop':
            return { ...base, normalizedType: 'stop', activity: 'completed', targetZoneKey: 'task-board', workSummary: 'Turn completed', isTaskCompletionSignal: true };
        case 'SubagentStop':
            return { ...base, normalizedType: 'subagent_stop', activity: 'idle', targetZoneKey: 'assigned-desk', workSummary: 'Subagent finished' };
        case 'SessionEnd':
            return { ...base, normalizedType: 'session_end', activity: 'idle', targetZoneKey: 'entrance', workSummary: 'Session ended' };
        default:
            return base;
    }
}
