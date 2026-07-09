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
exports.SessionsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const realtime_gateway_1 = require("../realtime/realtime.gateway");
const contracts_1 = require("@campus/contracts");
let SessionsService = class SessionsService {
    prisma;
    realtime;
    constructor(prisma, realtime) {
        this.prisma = prisma;
        this.realtime = realtime;
    }
    async upsert(input) {
        const existing = await this.prisma.claudeSession.findUnique({ where: { externalSessionId: input.externalSessionId } });
        const session = existing
            ? await this.prisma.claudeSession.update({
                where: { id: existing.id },
                data: { status: 'ACTIVE', lastEventAt: new Date(), cwd: input.cwd, branch: input.branch },
            })
            : await this.prisma.claudeSession.create({
                data: {
                    externalSessionId: input.externalSessionId,
                    projectId: input.projectId,
                    projectModuleId: input.projectModuleId,
                    cwd: input.cwd,
                    branch: input.branch,
                    worktreePath: input.worktreePath,
                },
            });
        this.realtime.emitToProject(input.projectId, existing ? contracts_1.SOCKET_EVENTS.sessionUpdated : contracts_1.SOCKET_EVENTS.sessionStarted, session);
        return session;
    }
    async touch(sessionId) {
        return this.prisma.claudeSession.update({ where: { id: sessionId }, data: { lastEventAt: new Date() } });
    }
    async end(externalSessionId) {
        const session = await this.prisma.claudeSession.findUnique({ where: { externalSessionId } });
        if (!session)
            return null;
        const updated = await this.prisma.claudeSession.update({
            where: { id: session.id },
            data: { status: 'ENDED', endedAt: new Date() },
        });
        await this.prisma.projectAgent.updateMany({
            where: { currentSessionId: session.id },
            data: { status: 'idle', activity: 'idle', currentZoneKey: 'entrance' },
        });
        this.realtime.emitToProject(session.projectId, contracts_1.SOCKET_EVENTS.sessionEnded, updated);
        return updated;
    }
    /** Marks sessions with no recent event as disconnected -- called on API startup (spec section 28). */
    async markStaleSessionsDisconnected(staleAfterMs = 5 * 60 * 1000) {
        const threshold = new Date(Date.now() - staleAfterMs);
        await this.prisma.claudeSession.updateMany({
            where: { status: 'ACTIVE', lastEventAt: { lt: threshold } },
            data: { status: 'DISCONNECTED' },
        });
    }
    async getById(id) {
        const session = await this.prisma.claudeSession.findUnique({ where: { id } });
        if (!session)
            throw new common_1.NotFoundException(`Session ${id} not found`);
        return session;
    }
};
exports.SessionsService = SessionsService;
exports.SessionsService = SessionsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        realtime_gateway_1.RealtimeGateway])
], SessionsService);
