import { z } from 'zod';
export declare const detectedTechnologySchema: z.ZodObject<{
    id: z.ZodString;
    displayName: z.ZodString;
    category: z.ZodEnum<["language", "framework", "runtime", "package-manager", "build-tool", "test-tool", "linter", "database", "infrastructure", "unknown"]>;
    confidence: z.ZodNumber;
    evidence: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    id: string;
    displayName: string;
    category: "database" | "unknown" | "infrastructure" | "language" | "framework" | "runtime" | "package-manager" | "build-tool" | "test-tool" | "linter";
    confidence: number;
    evidence: string[];
}, {
    id: string;
    displayName: string;
    category: "database" | "unknown" | "infrastructure" | "language" | "framework" | "runtime" | "package-manager" | "build-tool" | "test-tool" | "linter";
    confidence: number;
    evidence: string[];
}>;
export type DetectedTechnology = z.infer<typeof detectedTechnologySchema>;
export declare const projectTechnologyProfileSchema: z.ZodObject<{
    primaryLanguage: z.ZodNullable<z.ZodString>;
    languages: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        displayName: z.ZodString;
        category: z.ZodEnum<["language", "framework", "runtime", "package-manager", "build-tool", "test-tool", "linter", "database", "infrastructure", "unknown"]>;
        confidence: z.ZodNumber;
        evidence: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        id: string;
        displayName: string;
        category: "database" | "unknown" | "infrastructure" | "language" | "framework" | "runtime" | "package-manager" | "build-tool" | "test-tool" | "linter";
        confidence: number;
        evidence: string[];
    }, {
        id: string;
        displayName: string;
        category: "database" | "unknown" | "infrastructure" | "language" | "framework" | "runtime" | "package-manager" | "build-tool" | "test-tool" | "linter";
        confidence: number;
        evidence: string[];
    }>, "many">;
    frameworks: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        displayName: z.ZodString;
        category: z.ZodEnum<["language", "framework", "runtime", "package-manager", "build-tool", "test-tool", "linter", "database", "infrastructure", "unknown"]>;
        confidence: z.ZodNumber;
        evidence: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        id: string;
        displayName: string;
        category: "database" | "unknown" | "infrastructure" | "language" | "framework" | "runtime" | "package-manager" | "build-tool" | "test-tool" | "linter";
        confidence: number;
        evidence: string[];
    }, {
        id: string;
        displayName: string;
        category: "database" | "unknown" | "infrastructure" | "language" | "framework" | "runtime" | "package-manager" | "build-tool" | "test-tool" | "linter";
        confidence: number;
        evidence: string[];
    }>, "many">;
    packageManagers: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        displayName: z.ZodString;
        category: z.ZodEnum<["language", "framework", "runtime", "package-manager", "build-tool", "test-tool", "linter", "database", "infrastructure", "unknown"]>;
        confidence: z.ZodNumber;
        evidence: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        id: string;
        displayName: string;
        category: "database" | "unknown" | "infrastructure" | "language" | "framework" | "runtime" | "package-manager" | "build-tool" | "test-tool" | "linter";
        confidence: number;
        evidence: string[];
    }, {
        id: string;
        displayName: string;
        category: "database" | "unknown" | "infrastructure" | "language" | "framework" | "runtime" | "package-manager" | "build-tool" | "test-tool" | "linter";
        confidence: number;
        evidence: string[];
    }>, "many">;
    buildTools: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        displayName: z.ZodString;
        category: z.ZodEnum<["language", "framework", "runtime", "package-manager", "build-tool", "test-tool", "linter", "database", "infrastructure", "unknown"]>;
        confidence: z.ZodNumber;
        evidence: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        id: string;
        displayName: string;
        category: "database" | "unknown" | "infrastructure" | "language" | "framework" | "runtime" | "package-manager" | "build-tool" | "test-tool" | "linter";
        confidence: number;
        evidence: string[];
    }, {
        id: string;
        displayName: string;
        category: "database" | "unknown" | "infrastructure" | "language" | "framework" | "runtime" | "package-manager" | "build-tool" | "test-tool" | "linter";
        confidence: number;
        evidence: string[];
    }>, "many">;
    testTools: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        displayName: z.ZodString;
        category: z.ZodEnum<["language", "framework", "runtime", "package-manager", "build-tool", "test-tool", "linter", "database", "infrastructure", "unknown"]>;
        confidence: z.ZodNumber;
        evidence: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        id: string;
        displayName: string;
        category: "database" | "unknown" | "infrastructure" | "language" | "framework" | "runtime" | "package-manager" | "build-tool" | "test-tool" | "linter";
        confidence: number;
        evidence: string[];
    }, {
        id: string;
        displayName: string;
        category: "database" | "unknown" | "infrastructure" | "language" | "framework" | "runtime" | "package-manager" | "build-tool" | "test-tool" | "linter";
        confidence: number;
        evidence: string[];
    }>, "many">;
    infrastructureTools: z.ZodArray<z.ZodObject<{
        id: z.ZodString;
        displayName: z.ZodString;
        category: z.ZodEnum<["language", "framework", "runtime", "package-manager", "build-tool", "test-tool", "linter", "database", "infrastructure", "unknown"]>;
        confidence: z.ZodNumber;
        evidence: z.ZodArray<z.ZodString, "many">;
    }, "strip", z.ZodTypeAny, {
        id: string;
        displayName: string;
        category: "database" | "unknown" | "infrastructure" | "language" | "framework" | "runtime" | "package-manager" | "build-tool" | "test-tool" | "linter";
        confidence: number;
        evidence: string[];
    }, {
        id: string;
        displayName: string;
        category: "database" | "unknown" | "infrastructure" | "language" | "framework" | "runtime" | "package-manager" | "build-tool" | "test-tool" | "linter";
        confidence: number;
        evidence: string[];
    }>, "many">;
    detectedAt: z.ZodString;
}, "strip", z.ZodTypeAny, {
    primaryLanguage: string | null;
    languages: {
        id: string;
        displayName: string;
        category: "database" | "unknown" | "infrastructure" | "language" | "framework" | "runtime" | "package-manager" | "build-tool" | "test-tool" | "linter";
        confidence: number;
        evidence: string[];
    }[];
    frameworks: {
        id: string;
        displayName: string;
        category: "database" | "unknown" | "infrastructure" | "language" | "framework" | "runtime" | "package-manager" | "build-tool" | "test-tool" | "linter";
        confidence: number;
        evidence: string[];
    }[];
    packageManagers: {
        id: string;
        displayName: string;
        category: "database" | "unknown" | "infrastructure" | "language" | "framework" | "runtime" | "package-manager" | "build-tool" | "test-tool" | "linter";
        confidence: number;
        evidence: string[];
    }[];
    buildTools: {
        id: string;
        displayName: string;
        category: "database" | "unknown" | "infrastructure" | "language" | "framework" | "runtime" | "package-manager" | "build-tool" | "test-tool" | "linter";
        confidence: number;
        evidence: string[];
    }[];
    testTools: {
        id: string;
        displayName: string;
        category: "database" | "unknown" | "infrastructure" | "language" | "framework" | "runtime" | "package-manager" | "build-tool" | "test-tool" | "linter";
        confidence: number;
        evidence: string[];
    }[];
    infrastructureTools: {
        id: string;
        displayName: string;
        category: "database" | "unknown" | "infrastructure" | "language" | "framework" | "runtime" | "package-manager" | "build-tool" | "test-tool" | "linter";
        confidence: number;
        evidence: string[];
    }[];
    detectedAt: string;
}, {
    primaryLanguage: string | null;
    languages: {
        id: string;
        displayName: string;
        category: "database" | "unknown" | "infrastructure" | "language" | "framework" | "runtime" | "package-manager" | "build-tool" | "test-tool" | "linter";
        confidence: number;
        evidence: string[];
    }[];
    frameworks: {
        id: string;
        displayName: string;
        category: "database" | "unknown" | "infrastructure" | "language" | "framework" | "runtime" | "package-manager" | "build-tool" | "test-tool" | "linter";
        confidence: number;
        evidence: string[];
    }[];
    packageManagers: {
        id: string;
        displayName: string;
        category: "database" | "unknown" | "infrastructure" | "language" | "framework" | "runtime" | "package-manager" | "build-tool" | "test-tool" | "linter";
        confidence: number;
        evidence: string[];
    }[];
    buildTools: {
        id: string;
        displayName: string;
        category: "database" | "unknown" | "infrastructure" | "language" | "framework" | "runtime" | "package-manager" | "build-tool" | "test-tool" | "linter";
        confidence: number;
        evidence: string[];
    }[];
    testTools: {
        id: string;
        displayName: string;
        category: "database" | "unknown" | "infrastructure" | "language" | "framework" | "runtime" | "package-manager" | "build-tool" | "test-tool" | "linter";
        confidence: number;
        evidence: string[];
    }[];
    infrastructureTools: {
        id: string;
        displayName: string;
        category: "database" | "unknown" | "infrastructure" | "language" | "framework" | "runtime" | "package-manager" | "build-tool" | "test-tool" | "linter";
        confidence: number;
        evidence: string[];
    }[];
    detectedAt: string;
}>;
export type ProjectTechnologyProfile = z.infer<typeof projectTechnologyProfileSchema>;
