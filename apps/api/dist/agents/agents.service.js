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
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentsService = void 0;
const common_1 = require("@nestjs/common");
const contracts_1 = require("@campus/contracts");
const prisma_service_1 = require("../prisma/prisma.service");
const realtime_gateway_1 = require("../realtime/realtime.gateway");
const MAIN_AGENT_EXTERNAL_ID = 'main-claude';
function coerceAgentType(candidate) {
    if (candidate && contracts_1.AGENT_TYPES.includes(candidate)) {
        return candidate;
    }
    return candidate ? 'general-purpose' : 'unknown-agent';
}
let AgentsService = class AgentsService {
    prisma;
    realtime;
    constructor(prisma, realtime) {
        this.prisma = prisma;
        this.realtime = realtime;
    }
    async getOrCreateMainAgent(projectId, sessionId) {
        const existing = await this.prisma.projectAgent.findUnique({
            where: { projectId_externalAgentId: { projectId, externalAgentId: MAIN_AGENT_EXTERNAL_ID } },
        });
        if (existing) {
            return this.prisma.projectAgent.update({
                where: { id: existing.id },
                data: { currentSessionId: sessionId, lastSeenAt: new Date() },
            });
        }
        const created = await this.prisma.projectAgent.create({
            data: {
                projectId,
                externalAgentId: MAIN_AGENT_EXTERNAL_ID,
                agentType: 'main-claude',
                displayName: 'Main Claude',
                currentSessionId: sessionId,
            },
        });
        this.realtime.emitToProject(projectId, contracts_1.SOCKET_EVENTS.agentCreated, created);
        return created;
    }
    /**
     * Resolves which agent produced this event. Claude Code hooks fire process-wide, not
     * per-subagent, so there is no dedicated subagent identifier in the payload -- we
     * infer the active agent from a session-scoped stack: a Task tool PreToolUse pushes a
     * synthetic subagent (using the real subagent_type/description from tool_input when
     * present), and SubagentStop pops back to whichever agent was active before it. This
     * is documented as a known limitation in README/CLAUDE.md.
     */
    async resolveActiveAgent(options) {
        const { projectId, sessionId, isSubagentStart, isSubagentStop, subagentType, subagentDescription } = options;
        if (isSubagentStart) {
            const agentType = coerceAgentType(subagentType);
            const created = await this.prisma.projectAgent.create({
                data: {
                    projectId,
                    externalAgentId: `${sessionId}:sub:${Date.now()}`,
                    agentType,
                    displayName: subagentDescription?.slice(0, 80) || subagentType || 'Subagent',
                    currentSessionId: sessionId,
                    status: 'active',
                    currentZoneKey: 'assigned-desk',
                },
            });
            this.realtime.emitToProject(projectId, contracts_1.SOCKET_EVENTS.agentCreated, created);
            return created;
        }
        const activeSubagent = await this.prisma.projectAgent.findFirst({
            where: { projectId, currentSessionId: sessionId, status: 'active', agentType: { not: 'main-claude' } },
            orderBy: { lastSeenAt: 'desc' },
        });
        const agent = activeSubagent ?? (await this.getOrCreateMainAgent(projectId, sessionId));
        if (isSubagentStop && activeSubagent) {
            await this.prisma.projectAgent.update({
                where: { id: activeSubagent.id },
                data: { status: 'idle', activity: 'idle', currentZoneKey: 'assigned-desk' },
            });
        }
        return agent;
    }
    async applyStateChange(agentId, patch) {
        const agent = await this.prisma.projectAgent.update({
            where: { id: agentId },
            data: {
                activity: patch.activity,
                currentZoneKey: patch.currentZoneKey,
                status: patch.activity === 'idle' ? 'idle' : 'active',
                lastSeenAt: new Date(),
            },
        });
        this.realtime.emitToProject(agent.projectId, contracts_1.SOCKET_EVENTS.agentStateChanged, { ...agent, ...patch });
        return agent;
    }
    async getById(id) {
        const agent = await this.prisma.projectAgent.findUnique({ where: { id } });
        if (!agent)
            throw new common_1.NotFoundException(`Agent ${id} not found`);
        return agent;
    }
};
exports.AgentsService = AgentsService;
exports.AgentsService = AgentsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        realtime_gateway_1.RealtimeGateway])
], AgentsService);
