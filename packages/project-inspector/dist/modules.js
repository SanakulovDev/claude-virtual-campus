"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectProjectModules = detectProjectModules;
const promises_1 = require("node:fs/promises");
const node_path_1 = __importDefault(require("node:path"));
const detect_1 = require("./technology/detect");
const IGNORED_DIRS = new Set([
    'node_modules', '.git', 'vendor', 'dist', 'build', '.venv', 'venv',
    '__pycache__', 'target', '.turbo', '.next', 'bin', 'obj', '.idea', '.vscode',
]);
const MANIFEST_FILENAMES = new Set([
    'composer.json', 'pyproject.toml', 'requirements.txt', 'manage.py', 'go.mod',
    'package.json', 'Cargo.toml', 'pom.xml', 'build.gradle', 'build.gradle.kts',
    'Gemfile', 'mix.exs', 'CMakeLists.txt',
]);
/**
 * Shallow (depth-1) scan for nested application directories in a monorepo, per spec
 * section 13: the git repo stays the one project room, nested apps become modules.
 */
async function detectProjectModules(projectId, rootPath) {
    let dirents = [];
    try {
        const entries = await (0, promises_1.readdir)(rootPath, { withFileTypes: true });
        dirents = entries.filter((e) => e.isDirectory() && !IGNORED_DIRS.has(e.name) && !e.name.startsWith('.')).map((e) => e.name);
    }
    catch {
        return [];
    }
    const modules = [];
    for (const dirName of dirents) {
        const absolutePath = node_path_1.default.join(rootPath, dirName);
        let hasManifest = false;
        try {
            const inner = await (0, promises_1.readdir)(absolutePath, { withFileTypes: true });
            hasManifest = inner.some((e) => e.isFile() && MANIFEST_FILENAMES.has(e.name));
        }
        catch {
            continue;
        }
        if (!hasManifest)
            continue;
        const technologyProfile = await (0, detect_1.detectTechnologyProfile)(absolutePath);
        modules.push({
            id: `${projectId}:${dirName}`,
            projectId,
            name: dirName,
            relativePath: dirName,
            technologyProfile,
        });
    }
    return modules;
}
