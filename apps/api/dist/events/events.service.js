"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var EventsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventsService = void 0;
const common_1 = require("@nestjs/common");
const contracts_1 = require("@campus/contracts");
const prisma_service_1 = require("../prisma/prisma.service");
const project_resolver_service_1 = require("../project-resolver/project-resolver.service");
const projects_service_1 = require("../projects/projects.service");
const sessions_service_1 = require("../sessions/sessions.service");
const agents_service_1 = require("../agents/agents.service");
const tasks_service_1 = require("../tasks/tasks.service");
const event_normalization_service_1 = require("../event-normalization/event-normalization.service");
const realtime_gateway_1 = require("../realtime/realtime.gateway");
let EventsService = EventsService_1 = class EventsService {
    prisma;
    resolver;
    projects;
    sessions;
    agents;
    tasks;
    normalizer;
    realtime;
    logger = new common_1.Logger(EventsService_1.name);
    constructor(prisma, resolver, projects, sessions, agents, tasks, normalizer, realtime) {
        this.prisma = prisma;
        this.resolver = resolver;
        this.projects = projects;
        this.sessions = sessions;
        this.agents = agents;
        this.tasks = tasks;
        this.normalizer = normalizer;
        this.realtime = realtime;
    }
    async ingest(raw) {
        const resolved = await this.resolver.resolve(raw.cwd);
        const project = await this.projects.upsertFromResolvedProject(resolved);
        const session = await this.sessions.upsert({
            externalSessionId: raw.session_id,
            projectId: project.id,
            projectModuleId: null,
            cwd: raw.cwd,
            branch: resolved.branch,
            worktreePath: resolved.worktreePath,
        });
        const toolInput = raw.tool_input ?? undefined;
        const isSubagentStart = raw.hook_event_name === 'PreToolUse' && raw.tool_name === 'Task';
        const isSubagentStop = raw.hook_event_name === 'SubagentStop';
        const agent = await this.agents.resolveActiveAgent({
            projectId: project.id,
            sessionId: session.id,
            isSubagentStart,
            isSubagentStop,
            subagentType: typeof toolInput?.subagent_type === 'string' ? toolInput.subagent_type : undefined,
            subagentDescription: typeof toolInput?.description === 'string' ? toolInput.description : undefined,
        });
        const core = this.normalizer.normalize(raw, resolved.rootPath);
        const event = await this.prisma.claudeEvent.create({
            data: {
                projectId: project.id,
                sessionId: session.id,
                agentId: agent.id,
                hookEventName: raw.hook_event_name,
                toolName: core.toolName,
                normalizedType: core.normalizedType,
                payload: core.safeMetadata,
                occurredAt: new Date(),
            },
        });
        this.realtime.emitToProject(project.id, contracts_1.SOCKET_EVENTS.eventReceived, event);
        await this.agents.applyStateChange(agent.id, {
            activity: core.activity,
            currentZoneKey: core.targetZoneKey,
            currentTool: core.toolName,
            currentFile: core.filePath,
            currentCommandSummary: core.commandSummary,
            commandCategory: core.commandCategory,
        });
        await this.projects.recomputeRoomTemplate(project.id);
        if (raw.hook_event_name === 'PreToolUse' && core.toolName) {
            const execution = await this.prisma.toolExecution.create({
                data: {
                    projectId: project.id,
                    sessionId: session.id,
                    agentId: agent.id,
                    toolName: core.toolName,
                    commandCategory: core.commandCategory,
                    fileCategory: core.fileCategory,
                    safeSummary: core.workSummary,
                },
            });
            this.realtime.emitToProject(project.id, contracts_1.SOCKET_EVENTS.toolStarted, execution);
        }
        if (raw.hook_event_name === 'PostToolUse') {
            const running = await this.prisma.toolExecution.findFirst({
                where: { sessionId: session.id, agentId: agent.id, status: 'RUNNING' },
                orderBy: { startedAt: 'desc' },
            });
            if (running) {
                const updated = await this.prisma.toolExecution.update({
                    where: { id: running.id },
                    data: { status: core.isFailure ? 'FAILED' : 'COMPLETED', completedAt: new Date(), safeSummary: core.workSummary },
                });
                this.realtime.emitToProject(project.id, core.isFailure ? contracts_1.SOCKET_EVENTS.toolFailed : contracts_1.SOCKET_EVENTS.toolCompleted, updated);
            }
        }
        if (raw.hook_event_name === 'UserPromptSubmit') {
            await this.tasks.createFromPrompt(project.id, session.id, core.workSummary);
        }
        if (core.isTaskCompletionSignal) {
            await this.tasks.completeLatestForSession(project.id, session.id);
        }
        if (raw.hook_event_name === 'SessionEnd') {
            await this.sessions.end(raw.session_id);
        }
        else {
            await this.sessions.touch(session.id);
        }
        return { received: true, eventId: event.id };
    }
};
exports.EventsService = EventsService;
exports.EventsService = EventsService = EventsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        project_resolver_service_1.ProjectResolverService,
        projects_service_1.ProjectsService,
        sessions_service_1.SessionsService,
        agents_service_1.AgentsService,
        tasks_service_1.TasksService,
        event_normalization_service_1.EventNormalizationService,
        realtime_gateway_1.RealtimeGateway])
], EventsService);
