"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const promises_1 = require("node:fs/promises");
const node_os_1 = require("node:os");
const node_path_1 = __importDefault(require("node:path"));
const modules_1 = require("./modules");
const dirsToClean = [];
(0, vitest_1.afterEach)(async () => {
    await Promise.all(dirsToClean.splice(0).map((d) => (0, promises_1.rm)(d, { recursive: true, force: true })));
});
(0, vitest_1.describe)('detectProjectModules', () => {
    (0, vitest_1.it)('finds nested modules in a polyglot monorepo without creating duplicate rooms', async () => {
        const dir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), 'campus-modules-'));
        dirsToClean.push(dir);
        await (0, promises_1.mkdir)(node_path_1.default.join(dir, 'backend-php'), { recursive: true });
        await (0, promises_1.writeFile)(node_path_1.default.join(dir, 'backend-php', 'composer.json'), '{}');
        await (0, promises_1.mkdir)(node_path_1.default.join(dir, 'worker-python'), { recursive: true });
        await (0, promises_1.writeFile)(node_path_1.default.join(dir, 'worker-python', 'pyproject.toml'), '[tool.poetry]');
        await (0, promises_1.mkdir)(node_path_1.default.join(dir, 'gateway-go'), { recursive: true });
        await (0, promises_1.writeFile)(node_path_1.default.join(dir, 'gateway-go', 'go.mod'), 'module x');
        await (0, promises_1.mkdir)(node_path_1.default.join(dir, 'no-manifest-dir'), { recursive: true });
        const modules = await (0, modules_1.detectProjectModules)('proj1', dir);
        const names = modules.map((m) => m.name).sort();
        (0, vitest_1.expect)(names).toEqual(['backend-php', 'gateway-go', 'worker-python']);
        (0, vitest_1.expect)(modules.every((m) => m.projectId === 'proj1')).toBe(true);
    });
    (0, vitest_1.it)('returns an empty list for a directory with no nested manifests', async () => {
        const dir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), 'campus-modules-empty-'));
        dirsToClean.push(dir);
        const modules = await (0, modules_1.detectProjectModules)('proj1', dir);
        (0, vitest_1.expect)(modules).toEqual([]);
    });
});
