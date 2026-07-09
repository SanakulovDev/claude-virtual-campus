"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.projectTechnologyProfileSchema = exports.detectedTechnologySchema = void 0;
const zod_1 = require("zod");
const enums_1 = require("./enums");
exports.detectedTechnologySchema = zod_1.z.object({
    id: zod_1.z.string(),
    displayName: zod_1.z.string(),
    category: zod_1.z.enum(enums_1.TECHNOLOGY_CATEGORIES),
    confidence: zod_1.z.number().min(0).max(1),
    evidence: zod_1.z.array(zod_1.z.string()),
});
exports.projectTechnologyProfileSchema = zod_1.z.object({
    primaryLanguage: zod_1.z.string().nullable(),
    languages: zod_1.z.array(exports.detectedTechnologySchema),
    frameworks: zod_1.z.array(exports.detectedTechnologySchema),
    packageManagers: zod_1.z.array(exports.detectedTechnologySchema),
    buildTools: zod_1.z.array(exports.detectedTechnologySchema),
    testTools: zod_1.z.array(exports.detectedTechnologySchema),
    infrastructureTools: zod_1.z.array(exports.detectedTechnologySchema),
    detectedAt: zod_1.z.string(),
});
