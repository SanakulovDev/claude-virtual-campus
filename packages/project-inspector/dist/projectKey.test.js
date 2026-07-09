"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const projectKey_1 = require("./projectKey");
(0, vitest_1.describe)('normalizeRemoteUrl', () => {
    (0, vitest_1.it)('normalizes ssh and https forms to the same value', () => {
        const ssh = (0, projectKey_1.normalizeRemoteUrl)('git@github.com:acme/widgets.git');
        const https = (0, projectKey_1.normalizeRemoteUrl)('https://github.com/acme/widgets.git');
        (0, vitest_1.expect)(ssh).toBe(https);
    });
});
(0, vitest_1.describe)('computeProjectKey', () => {
    const base = {
        isGitRepository: true,
        rootPath: '/repo',
        remoteUrl: null,
        branch: 'main',
        worktreePath: null,
        commonGitDir: '/repo/.git',
    };
    (0, vitest_1.it)('prefers remote url when present', () => {
        const withRemote = (0, projectKey_1.computeProjectKey)({ ...base, remoteUrl: 'git@github.com:acme/widgets.git' });
        (0, vitest_1.expect)(withRemote.startsWith('remote:')).toBe(true);
    });
    (0, vitest_1.it)('falls back to root path when no remote', () => {
        const key = (0, projectKey_1.computeProjectKey)(base);
        (0, vitest_1.expect)(key.startsWith('path:')).toBe(true);
    });
    (0, vitest_1.it)('falls back to path for non-git directories', () => {
        const key = (0, projectKey_1.computeProjectKey)({ ...base, isGitRepository: false, remoteUrl: null, commonGitDir: null });
        (0, vitest_1.expect)(key.startsWith('path:')).toBe(true);
    });
    (0, vitest_1.it)('resolves worktree stable root to the main checkout', () => {
        const worktreeInfo = {
            isGitRepository: true,
            rootPath: '/repo-worktree',
            remoteUrl: null,
            branch: 'feature',
            worktreePath: '/repo-worktree',
            commonGitDir: '/repo/.git',
        };
        (0, vitest_1.expect)((0, projectKey_1.resolveStableRootPath)(worktreeInfo)).toBe('/repo');
    });
});
