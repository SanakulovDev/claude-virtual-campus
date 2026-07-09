"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeRemoteUrl = normalizeRemoteUrl;
exports.resolveStableRootPath = resolveStableRootPath;
exports.computeProjectKey = computeProjectKey;
exports.deriveProjectName = deriveProjectName;
const node_crypto_1 = require("node:crypto");
const node_path_1 = __importDefault(require("node:path"));
/** Normalizes ssh/https/git-protocol remote URLs to one comparable form. */
function normalizeRemoteUrl(remoteUrl) {
    let value = remoteUrl.trim().toLowerCase();
    value = value.replace(/\.git$/, '');
    value = value.replace(/^git@([^:]+):/, 'https://$1/');
    value = value.replace(/^ssh:\/\/git@/, 'https://');
    value = value.replace(/^git:\/\//, 'https://');
    value = value.replace(/\/+$/, '');
    return value;
}
/** Main repo root even when cwd is inside a linked worktree, so worktrees share a project. */
function resolveStableRootPath(git) {
    if (git.worktreePath && git.commonGitDir) {
        const gitDirName = node_path_1.default.basename(git.commonGitDir);
        if (gitDirName === '.git') {
            return node_path_1.default.dirname(git.commonGitDir);
        }
    }
    return git.rootPath;
}
function sha256(value) {
    return (0, node_crypto_1.createHash)('sha256').update(value).digest('hex').slice(0, 32);
}
function computeProjectKey(git) {
    if (git.isGitRepository && git.remoteUrl) {
        return `remote:${sha256(normalizeRemoteUrl(git.remoteUrl))}`;
    }
    const stableRoot = git.isGitRepository ? resolveStableRootPath(git) : git.rootPath;
    return `path:${sha256(node_path_1.default.resolve(stableRoot))}`;
}
function deriveProjectName(rootPath) {
    return node_path_1.default.basename(rootPath) || rootPath;
}
