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
exports.ApprovalsService = void 0;
const common_1 = require("@nestjs/common");
const contracts_1 = require("@campus/contracts");
const prisma_service_1 = require("../prisma/prisma.service");
const project_resolver_service_1 = require("../project-resolver/project-resolver.service");
const projects_service_1 = require("../projects/projects.service");
const command_classification_service_1 = require("../commands/command-classification.service");
const realtime_gateway_1 = require("../realtime/realtime.gateway");
const POLL_INTERVAL_MS = 400;
function readTimeoutMs() {
    return Number(process.env.APPROVAL_TIMEOUT_MS ?? 30_000);
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
let ApprovalsService = class ApprovalsService {
    prisma;
    resolver;
    projects;
    commands;
    realtime;
    constructor(prisma, resolver, projects, commands, realtime) {
        this.prisma = prisma;
        this.resolver = resolver;
        this.projects = projects;
        this.commands = commands;
        this.realtime = realtime;
    }
    /**
     * Handles the blocking PreToolUse approval hook. Non-destructive tool calls are
     * allowed immediately without persistence (nothing was actually gated). Destructive
     * commands are persisted, surfaced to the UI, and block until allow/deny/timeout --
     * timeout always resolves to deny, never to allow (spec section 10).
     */
    async requestApproval(body) {
        const command = typeof body.tool_input?.command === 'string' ? body.tool_input.command : '';
        const classification = body.tool_name === 'Bash' ? this.commands.classify(command) : null;
        const requiresApproval = classification?.isDestructive ?? false;
        if (!requiresApproval) {
            return allowDecision();
        }
        const resolved = await this.resolver.resolve(body.cwd);
        const project = await this.projects.upsertFromResolvedProject(resolved);
        const timeoutAt = new Date(Date.now() + readTimeoutMs());
        const request = await this.prisma.approvalRequest.create({
            data: {
                projectId: project.id,
                sessionExternalId: body.session_id,
                toolName: body.tool_name,
                safeSummary: command ? `Run: ${command.slice(0, 200)}` : `Use ${body.tool_name}`,
                commandCategory: classification?.category ?? null,
                timeoutAt,
            },
        });
        this.realtime.emitToProject(project.id, contracts_1.SOCKET_EVENTS.approvalRequested, request);
        const deadline = timeoutAt.getTime();
        while (Date.now() < deadline) {
            await sleep(POLL_INTERVAL_MS);
            const current = await this.prisma.approvalRequest.findUnique({ where: { id: request.id } });
            if (current && current.status !== 'PENDING') {
                return current.status === 'ALLOWED' ? allowDecision() : denyDecision('Denied by user');
            }
        }
        await this.prisma.approvalRequest.update({ where: { id: request.id }, data: { status: 'TIMED_OUT', resolvedAt: new Date() } });
        this.realtime.emitToProject(project.id, contracts_1.SOCKET_EVENTS.approvalResolved, { id: request.id, status: 'TIMED_OUT' });
        return denyDecision('Approval timed out');
    }
    async resolve(approvalId, decision) {
        const existing = await this.prisma.approvalRequest.findUnique({ where: { id: approvalId } });
        if (!existing)
            throw new common_1.NotFoundException(`Approval request ${approvalId} not found`);
        if (existing.status !== 'PENDING')
            return existing;
        const updated = await this.prisma.approvalRequest.update({
            where: { id: approvalId },
            data: { status: decision, resolvedAt: new Date() },
        });
        this.realtime.emitToProject(updated.projectId, contracts_1.SOCKET_EVENTS.approvalResolved, updated);
        return updated;
    }
};
exports.ApprovalsService = ApprovalsService;
exports.ApprovalsService = ApprovalsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        project_resolver_service_1.ProjectResolverService,
        projects_service_1.ProjectsService,
        command_classification_service_1.CommandClassificationService,
        realtime_gateway_1.RealtimeGateway])
], ApprovalsService);
function allowDecision() {
    return { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'allow' } };
}
function denyDecision(reason) {
    return { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason } };
}
