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
exports.TasksService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const realtime_gateway_1 = require("../realtime/realtime.gateway");
const contracts_1 = require("@campus/contracts");
let TasksService = class TasksService {
    prisma;
    realtime;
    constructor(prisma, realtime) {
        this.prisma = prisma;
        this.realtime = realtime;
    }
    async createFromPrompt(projectId, sessionId, title) {
        const task = await this.prisma.task.create({
            data: { projectId, sessionId, title: title.slice(0, 200), status: 'IN_PROGRESS' },
        });
        this.realtime.emitToProject(projectId, contracts_1.SOCKET_EVENTS.taskCreated, task);
        return task;
    }
    async completeLatestForSession(projectId, sessionId) {
        const task = await this.prisma.task.findFirst({
            where: { sessionId, status: { in: ['PENDING', 'IN_PROGRESS'] } },
            orderBy: { createdAt: 'desc' },
        });
        if (!task)
            return null;
        const updated = await this.prisma.task.update({
            where: { id: task.id },
            data: { status: 'COMPLETED', completedAt: new Date() },
        });
        this.realtime.emitToProject(projectId, contracts_1.SOCKET_EVENTS.taskUpdated, updated);
        return updated;
    }
};
exports.TasksService = TasksService;
exports.TasksService = TasksService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        realtime_gateway_1.RealtimeGateway])
], TasksService);
