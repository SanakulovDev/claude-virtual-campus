"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectTechnologyProfile = detectTechnologyProfile;
const promises_1 = require("node:fs/promises");
const node_path_1 = __importDefault(require("node:path"));
const markers_1 = require("./markers");
const MAX_CONFIG_FILE_BYTES = 64 * 1024;
async function safeReadSmallFile(dir, filename) {
    try {
        const filePath = node_path_1.default.join(dir, filename);
        const handle = await (0, promises_1.readFile)(filePath, { encoding: 'utf8', flag: 'r' });
        return handle.slice(0, MAX_CONFIG_FILE_BYTES);
    }
    catch {
        return null;
    }
}
/**
 * Detects technology from filenames/extensions present at `dir` (non-recursive) plus
 * size-limited reads of a handful of well-known manifest files. Never executes
 * anything, never installs dependencies, never runs builds -- see spec section 4.
 */
async function detectTechnologyProfile(dir) {
    let entries = [];
    const extensionCounts = new Map();
    try {
        const dirents = await (0, promises_1.readdir)(dir, { withFileTypes: true });
        for (const d of dirents) {
            if (d.isFile()) {
                entries.push(d.name);
                const ext = node_path_1.default.extname(d.name);
                if (ext)
                    extensionCounts.set(ext, (extensionCounts.get(ext) ?? 0) + 1);
            }
        }
    }
    catch {
        entries = [];
    }
    const entrySet = new Set(entries);
    const fileContentCache = new Map();
    async function contentOf(filename) {
        if (!fileContentCache.has(filename)) {
            fileContentCache.set(filename, await safeReadSmallFile(dir, filename));
        }
        return fileContentCache.get(filename) ?? null;
    }
    const detected = [];
    for (const rule of markers_1.MARKER_RULES) {
        const evidence = [];
        let matched = false;
        const matchedFilenames = (rule.filenames ?? []).filter((f) => entrySet.has(f));
        if (matchedFilenames.length > 0) {
            matched = true;
            evidence.push(...matchedFilenames.map((f) => `file:${f}`));
        }
        const matchedExtensions = (rule.extensions ?? []).filter((ext) => extensionCounts.has(ext));
        if (matchedExtensions.length > 0) {
            matched = true;
            evidence.push(...matchedExtensions.map((ext) => `extension:${ext}(${extensionCounts.get(ext)})`));
        }
        let confidence = rule.confidence;
        if (rule.contentSniff) {
            const content = await contentOf(rule.contentSniff.filename);
            if (content && content.toLowerCase().includes(rule.contentSniff.needle.toLowerCase())) {
                matched = true;
                confidence = Math.max(confidence, 0.85);
                evidence.push(`content:${rule.contentSniff.filename}~="${rule.contentSniff.needle}"`);
            }
            else if (!matched) {
                continue;
            }
        }
        if (matched) {
            detected.push({
                id: rule.id,
                displayName: rule.displayName,
                category: rule.category,
                confidence,
                evidence,
            });
        }
    }
    const languages = detected.filter((t) => t.category === 'language').sort((a, b) => b.confidence - a.confidence);
    const primaryLanguage = languages[0]?.displayName ?? null;
    return {
        primaryLanguage,
        languages,
        frameworks: detected.filter((t) => t.category === 'framework'),
        packageManagers: detected.filter((t) => t.category === 'package-manager'),
        buildTools: detected.filter((t) => t.category === 'build-tool'),
        testTools: detected.filter((t) => t.category === 'test-tool'),
        infrastructureTools: detected.filter((t) => t.category === 'infrastructure'),
        detectedAt: new Date().toISOString(),
    };
}
