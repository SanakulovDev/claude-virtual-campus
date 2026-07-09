"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.approvalDecisionSchema = exports.campusAgentStateSchema = exports.normalizedClaudeEventSchema = void 0;
const zod_1 = require("zod");
const enums_1 = require("./enums");
exports.normalizedClaudeEventSchema = zod_1.z.object({
    id: zod_1.z.string(),
    projectId: zod_1.z.string(),
    projectModuleId: zod_1.z.string().nullable(),
    sessionId: zod_1.z.string(),
    agentId: zod_1.z.string(),
    hookEventName: zod_1.z.string(),
    normalizedType: zod_1.z.string(),
    activity: zod_1.z.enum(enums_1.AGENT_ACTIVITIES),
    targetZoneKey: zod_1.z.enum(enums_1.OFFICE_ZONE_KEYS),
    workSummary: zod_1.z.string(),
    toolName: zod_1.z.string().nullable(),
    filePath: zod_1.z.string().nullable(),
    fileCategory: zod_1.z.enum(enums_1.FILE_CATEGORIES).nullable(),
    commandSummary: zod_1.z.string().nullable(),
    commandCategory: zod_1.z.enum(enums_1.COMMAND_CATEGORIES).nullable(),
    occurredAt: zod_1.z.string(),
    safeMetadata: zod_1.z.record(zod_1.z.unknown()),
});
exports.campusAgentStateSchema = zod_1.z.object({
    id: zod_1.z.string(),
    projectId: zod_1.z.string(),
    projectModuleId: zod_1.z.string().nullable(),
    sessionId: zod_1.z.string().nullable(),
    externalAgentId: zod_1.z.string().nullable(),
    agentType: zod_1.z.string(),
    displayName: zod_1.z.string(),
    status: zod_1.z.string(),
    activity: zod_1.z.enum(enums_1.AGENT_ACTIVITIES),
    animation: zod_1.z.enum(enums_1.AGENT_ANIMATIONS),
    currentZoneKey: zod_1.z.enum(enums_1.OFFICE_ZONE_KEYS),
    targetZoneKey: zod_1.z.enum(enums_1.OFFICE_ZONE_KEYS),
    currentTaskTitle: zod_1.z.string().nullable(),
    currentTool: zod_1.z.string().nullable(),
    currentFile: zod_1.z.string().nullable(),
    currentCommandSummary: zod_1.z.string().nullable(),
    commandCategory: zod_1.z.enum(enums_1.COMMAND_CATEGORIES).nullable(),
    lastEventAt: zod_1.z.string(),
});
exports.approvalDecisionSchema = zod_1.z.enum(['allow', 'deny']);
