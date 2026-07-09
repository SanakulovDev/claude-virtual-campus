"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EventsModule = void 0;
const common_1 = require("@nestjs/common");
const events_service_1 = require("./events.service");
const events_controller_1 = require("./events.controller");
const project_resolver_module_1 = require("../project-resolver/project-resolver.module");
const projects_module_1 = require("../projects/projects.module");
const sessions_module_1 = require("../sessions/sessions.module");
const agents_module_1 = require("../agents/agents.module");
const tasks_module_1 = require("../tasks/tasks.module");
const event_normalization_module_1 = require("../event-normalization/event-normalization.module");
const realtime_module_1 = require("../realtime/realtime.module");
let EventsModule = class EventsModule {
};
exports.EventsModule = EventsModule;
exports.EventsModule = EventsModule = __decorate([
    (0, common_1.Module)({
        imports: [
            project_resolver_module_1.ProjectResolverModule,
            projects_module_1.ProjectsModule,
            sessions_module_1.SessionsModule,
            agents_module_1.AgentsModule,
            tasks_module_1.TasksModule,
            event_normalization_module_1.EventNormalizationModule,
            realtime_module_1.RealtimeModule,
        ],
        providers: [events_service_1.EventsService],
        controllers: [events_controller_1.EventsController],
    })
], EventsModule);
