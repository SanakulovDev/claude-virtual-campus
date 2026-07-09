"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.projectModuleSchema = exports.resolvedProjectSchema = void 0;
const zod_1 = require("zod");
const technology_1 = require("./technology");
exports.resolvedProjectSchema = zod_1.z.object({
    projectKey: zod_1.z.string(),
    name: zod_1.z.string(),
    rootPath: zod_1.z.string(),
    currentWorkingDirectory: zod_1.z.string(),
    remoteUrl: zod_1.z.string().nullable(),
    branch: zod_1.z.string().nullable(),
    worktreePath: zod_1.z.string().nullable(),
    isGitRepository: zod_1.z.boolean(),
    technologyProfile: technology_1.projectTechnologyProfileSchema.nullable(),
});
exports.projectModuleSchema = zod_1.z.object({
    id: zod_1.z.string(),
    projectId: zod_1.z.string(),
    name: zod_1.z.string(),
    relativePath: zod_1.z.string(),
    technologyProfile: technology_1.projectTechnologyProfileSchema,
});
