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
exports.ProjectsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma/prisma.service");
const project_resolver_service_1 = require("../project-resolver/project-resolver.service");
const realtime_gateway_1 = require("../realtime/realtime.gateway");
const contracts_1 = require("@campus/contracts");
const room_layout_1 = require("./room-layout");
let ProjectsService = class ProjectsService {
    prisma;
    resolver;
    realtime;
    constructor(prisma, resolver, realtime) {
        this.prisma = prisma;
        this.resolver = resolver;
        this.realtime = realtime;
    }
    async upsertFromResolvedProject(resolved) {
        const existing = await this.prisma.project.findUnique({ where: { projectKey: resolved.projectKey } });
        let project;
        let isNew = false;
        if (existing) {
            project = await this.prisma.project.update({
                where: { id: existing.id },
                data: { lastActiveAt: new Date(), name: resolved.name, remoteUrl: resolved.remoteUrl, isGitRepository: resolved.isGitRepository },
            });
        }
        else {
            isNew = true;
            const count = await this.prisma.project.count();
            const position = (0, room_layout_1.calculateRoomPosition)(count);
            project = await this.prisma.project.create({
                data: {
                    projectKey: resolved.projectKey,
                    name: resolved.name,
                    rootPath: resolved.rootPath,
                    remoteUrl: resolved.remoteUrl,
                    isGitRepository: resolved.isGitRepository,
                    roomPositionX: position.x,
                    roomPositionZ: position.z,
                },
            });
        }
        if (resolved.technologyProfile) {
            await this.syncTechnologies(project.id, resolved.technologyProfile);
            this.realtime.emitToProject(project.id, contracts_1.SOCKET_EVENTS.projectTechnologyDetected, {
                projectId: project.id,
                technologyProfile: resolved.technologyProfile,
            });
        }
        const modules = await this.resolver.detectModules(project.id, resolved.rootPath);
        for (const mod of modules) {
            await this.prisma.projectModule.upsert({
                where: { projectId_relativePath: { projectId: project.id, relativePath: mod.relativePath } },
                create: {
                    projectId: project.id,
                    name: mod.name,
                    relativePath: mod.relativePath,
                    primaryLanguage: mod.technologyProfile.primaryLanguage,
                    technologyProfile: mod.technologyProfile,
                },
                update: {
                    primaryLanguage: mod.technologyProfile.primaryLanguage,
                    technologyProfile: mod.technologyProfile,
                },
            });
        }
        if (modules.length > 0) {
            this.realtime.emitToProject(project.id, contracts_1.SOCKET_EVENTS.projectModuleDetected, { projectId: project.id, modules });
        }
        this.realtime.emitToCampus(isNew ? contracts_1.SOCKET_EVENTS.projectCreated : contracts_1.SOCKET_EVENTS.projectUpdated, project);
        this.realtime.emitToCampus(contracts_1.SOCKET_EVENTS.eventReceived, { type: isNew ? 'project_created' : 'project_updated', projectId: project.id });
        return project;
    }
    async syncTechnologies(projectId, profile) {
        const all = [
            ...profile.languages,
            ...profile.frameworks,
            ...profile.packageManagers,
            ...profile.buildTools,
            ...profile.testTools,
            ...profile.infrastructureTools,
        ];
        for (const tech of all) {
            await this.prisma.projectTechnology.upsert({
                where: { projectId_techId: { projectId, techId: tech.id } },
                create: { projectId, techId: tech.id, displayName: tech.displayName, category: tech.category, confidence: tech.confidence, evidence: tech.evidence },
                update: { confidence: tech.confidence, evidence: tech.evidence },
            });
        }
    }
    async recomputeRoomTemplate(projectId) {
        const agentCount = await this.prisma.projectAgent.count({ where: { projectId } });
        await this.prisma.project.update({ where: { id: projectId }, data: { roomTemplate: (0, room_layout_1.calculateRoomTemplate)(agentCount) } });
    }
    list() {
        return this.prisma.project.findMany({
            include: { technologies: true, modules: true, agents: true },
            orderBy: { lastActiveAt: 'desc' },
        });
    }
    async getById(id) {
        const project = await this.prisma.project.findUnique({
            where: { id },
            include: { technologies: true, modules: true, agents: true, sessions: true, tasks: true },
        });
        if (!project)
            throw new common_1.NotFoundException(`Project ${id} not found`);
        return project;
    }
    async getEvents(projectId, limit = 100) {
        await this.getById(projectId);
        return this.prisma.claudeEvent.findMany({
            where: { projectId },
            orderBy: { receivedAt: 'desc' },
            take: Math.min(limit, 500),
        });
    }
    async getTechnologies(projectId) {
        await this.getById(projectId);
        return this.prisma.projectTechnology.findMany({ where: { projectId } });
    }
    async getModules(projectId) {
        await this.getById(projectId);
        return this.prisma.projectModule.findMany({ where: { projectId } });
    }
    async refreshTechnologies(projectId) {
        const project = await this.getById(projectId);
        const profile = await this.resolver.resolve(project.rootPath);
        if (profile.technologyProfile) {
            await this.syncTechnologies(projectId, profile.technologyProfile);
        }
        return this.getTechnologies(projectId);
    }
};
exports.ProjectsService = ProjectsService;
exports.ProjectsService = ProjectsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        project_resolver_service_1.ProjectResolverService,
        realtime_gateway_1.RealtimeGateway])
], ProjectsService);
