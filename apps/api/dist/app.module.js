"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const prisma_module_1 = require("./prisma/prisma.module");
const health_module_1 = require("./health/health.module");
const project_resolver_module_1 = require("./project-resolver/project-resolver.module");
const projects_module_1 = require("./projects/projects.module");
const sessions_module_1 = require("./sessions/sessions.module");
const agents_module_1 = require("./agents/agents.module");
const tasks_module_1 = require("./tasks/tasks.module");
const events_module_1 = require("./events/events.module");
const event_normalization_module_1 = require("./event-normalization/event-normalization.module");
const command_classification_module_1 = require("./commands/command-classification.module");
const file_classification_module_1 = require("./files/file-classification.module");
const approvals_module_1 = require("./approvals/approvals.module");
const realtime_module_1 = require("./realtime/realtime.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            prisma_module_1.PrismaModule,
            health_module_1.HealthModule,
            project_resolver_module_1.ProjectResolverModule,
            projects_module_1.ProjectsModule,
            sessions_module_1.SessionsModule,
            agents_module_1.AgentsModule,
            tasks_module_1.TasksModule,
            event_normalization_module_1.EventNormalizationModule,
            command_classification_module_1.CommandClassificationModule,
            file_classification_module_1.FileClassificationModule,
            events_module_1.EventsModule,
            approvals_module_1.ApprovalsModule,
            realtime_module_1.RealtimeModule,
        ],
    })
], AppModule);
