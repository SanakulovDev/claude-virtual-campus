import { z } from 'zod';
export declare const resolvedProjectSchema: z.ZodObject<{
    projectKey: z.ZodString;
    name: z.ZodString;
    rootPath: z.ZodString;
    currentWorkingDirectory: z.ZodString;
    remoteUrl: z.ZodNullable<z.ZodString>;
    branch: z.ZodNullable<z.ZodString>;
    worktreePath: z.ZodNullable<z.ZodString>;
    isGitRepository: z.ZodBoolean;
    technologyProfile: z.ZodNullable<z.ZodObject<{
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
    }>>;
}, "strip", z.ZodTypeAny, {
    projectKey: string;
    name: string;
    rootPath: string;
    currentWorkingDirectory: string;
    remoteUrl: string | null;
    branch: string | null;
    worktreePath: string | null;
    isGitRepository: boolean;
    technologyProfile: {
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
    } | null;
}, {
    projectKey: string;
    name: string;
    rootPath: string;
    currentWorkingDirectory: string;
    remoteUrl: string | null;
    branch: string | null;
    worktreePath: string | null;
    isGitRepository: boolean;
    technologyProfile: {
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
    } | null;
}>;
export type ResolvedProject = z.infer<typeof resolvedProjectSchema>;
export declare const projectModuleSchema: z.ZodObject<{
    id: z.ZodString;
    projectId: z.ZodString;
    name: z.ZodString;
    relativePath: z.ZodString;
    technologyProfile: z.ZodObject<{
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
}, "strip", z.ZodTypeAny, {
    id: string;
    projectId: string;
    name: string;
    technologyProfile: {
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
    };
    relativePath: string;
}, {
    id: string;
    projectId: string;
    name: string;
    technologyProfile: {
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
    };
    relativePath: string;
}>;
export type ProjectModule = z.infer<typeof projectModuleSchema>;
