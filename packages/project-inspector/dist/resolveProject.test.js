"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const node_child_process_1 = require("node:child_process");
const node_util_1 = require("node:util");
const promises_1 = require("node:fs/promises");
const node_os_1 = require("node:os");
const node_path_1 = __importDefault(require("node:path"));
const resolveProject_1 = require("./resolveProject");
const execFileAsync = (0, node_util_1.promisify)(node_child_process_1.execFile);
const dirsToClean = [];
(0, vitest_1.afterEach)(async () => {
    await Promise.all(dirsToClean.splice(0).map((d) => (0, promises_1.rm)(d, { recursive: true, force: true })));
});
async function makeTmpDir() {
    const dir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), 'campus-resolve-'));
    dirsToClean.push(dir);
    return dir;
}
(0, vitest_1.describe)('resolveProject', () => {
    (0, vitest_1.it)('resolves a non-git directory safely', async () => {
        const dir = await makeTmpDir();
        const project = await (0, resolveProject_1.resolveProject)(dir);
        (0, vitest_1.expect)(project.isGitRepository).toBe(false);
        (0, vitest_1.expect)(project.projectKey.startsWith('path:')).toBe(true);
        (0, vitest_1.expect)(project.technologyProfile).not.toBeNull();
    });
    (0, vitest_1.it)('resolves a git repository root and branch', async () => {
        const dir = await makeTmpDir();
        await execFileAsync('git', ['init', '-b', 'main'], { cwd: dir });
        await execFileAsync('git', ['config', 'user.email', 'test@example.com'], { cwd: dir });
        await execFileAsync('git', ['config', 'user.name', 'Test'], { cwd: dir });
        await (0, promises_1.writeFile)(node_path_1.default.join(dir, 'go.mod'), 'module example.com/x\n\ngo 1.22');
        await execFileAsync('git', ['add', '.'], { cwd: dir });
        await execFileAsync('git', ['commit', '-m', 'init'], { cwd: dir });
        const project = await (0, resolveProject_1.resolveProject)(dir);
        (0, vitest_1.expect)(project.isGitRepository).toBe(true);
        (0, vitest_1.expect)(project.branch).toBe('main');
        (0, vitest_1.expect)(project.remoteUrl).toBeNull();
        (0, vitest_1.expect)(project.technologyProfile?.primaryLanguage).toBe('Go');
    });
});
