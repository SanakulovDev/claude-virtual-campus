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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectsController = void 0;
const common_1 = require("@nestjs/common");
const projects_service_1 = require("./projects.service");
const prisma_service_1 = require("../prisma/prisma.service");
const bootstrap_1 = require("../realtime/bootstrap");
let ProjectsController = class ProjectsController {
    projects;
    prisma;
    constructor(projects, prisma) {
        this.projects = projects;
        this.prisma = prisma;
    }
    bootstrap() {
        return (0, bootstrap_1.buildBootstrapSnapshot)(this.prisma);
    }
    list() {
        return this.projects.list();
    }
    getOne(projectId) {
        return this.projects.getById(projectId);
    }
    getEvents(projectId, limit) {
        return this.projects.getEvents(projectId, limit ? Number(limit) : undefined);
    }
    getTechnologies(projectId) {
        return this.projects.getTechnologies(projectId);
    }
    getModules(projectId) {
        return this.projects.getModules(projectId);
    }
    refreshTechnologies(projectId) {
        return this.projects.refreshTechnologies(projectId);
    }
};
exports.ProjectsController = ProjectsController;
__decorate([
    (0, common_1.Get)('api/campus/bootstrap'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ProjectsController.prototype, "bootstrap", null);
__decorate([
    (0, common_1.Get)('api/projects'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", void 0)
], ProjectsController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('api/projects/:projectId'),
    __param(0, (0, common_1.Param)('projectId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ProjectsController.prototype, "getOne", null);
__decorate([
    (0, common_1.Get)('api/projects/:projectId/events'),
    __param(0, (0, common_1.Param)('projectId')),
    __param(1, (0, common_1.Query)('limit')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", void 0)
], ProjectsController.prototype, "getEvents", null);
__decorate([
    (0, common_1.Get)('api/projects/:projectId/technologies'),
    __param(0, (0, common_1.Param)('projectId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ProjectsController.prototype, "getTechnologies", null);
__decorate([
    (0, common_1.Get)('api/projects/:projectId/modules'),
    __param(0, (0, common_1.Param)('projectId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ProjectsController.prototype, "getModules", null);
__decorate([
    (0, common_1.Post)('api/projects/:projectId/technologies/refresh'),
    __param(0, (0, common_1.Param)('projectId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], ProjectsController.prototype, "refreshTechnologies", null);
exports.ProjectsController = ProjectsController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [projects_service_1.ProjectsService,
        prisma_service_1.PrismaService])
], ProjectsController);
