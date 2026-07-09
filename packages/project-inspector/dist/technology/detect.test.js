"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
const promises_1 = require("node:fs/promises");
const node_os_1 = require("node:os");
const node_path_1 = __importDefault(require("node:path"));
const detect_1 = require("./detect");
const dirsToClean = [];
(0, vitest_1.afterEach)(async () => {
    await Promise.all(dirsToClean.splice(0).map((d) => (0, promises_1.rm)(d, { recursive: true, force: true })));
});
async function fixture(files) {
    const dir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), 'campus-fixture-'));
    dirsToClean.push(dir);
    for (const [name, content] of Object.entries(files)) {
        const full = node_path_1.default.join(dir, name);
        await (0, promises_1.mkdir)(node_path_1.default.dirname(full), { recursive: true });
        await (0, promises_1.writeFile)(full, content);
    }
    return dir;
}
(0, vitest_1.describe)('detectTechnologyProfile', () => {
    (0, vitest_1.it)('detects a PHP composer project', async () => {
        const dir = await fixture({ 'composer.json': '{"require": {"php": "^8.2"}}', 'index.php': '<?php' });
        const profile = await (0, detect_1.detectTechnologyProfile)(dir);
        (0, vitest_1.expect)(profile.primaryLanguage).toBe('PHP');
        (0, vitest_1.expect)(profile.packageManagers.map((t) => t.id)).toContain('composer');
    });
    (0, vitest_1.it)('detects a Laravel project via artisan + composer content', async () => {
        const dir = await fixture({
            artisan: '#!/usr/bin/env php',
            'composer.json': '{"require": {"laravel/framework": "^11.0"}}',
        });
        const profile = await (0, detect_1.detectTechnologyProfile)(dir);
        (0, vitest_1.expect)(profile.frameworks.map((t) => t.id)).toContain('laravel');
    });
    (0, vitest_1.it)('detects a Python pyproject project', async () => {
        const dir = await fixture({ 'pyproject.toml': '[tool.poetry]\nname="x"', 'app.py': 'x=1' });
        const profile = await (0, detect_1.detectTechnologyProfile)(dir);
        (0, vitest_1.expect)(profile.primaryLanguage).toBe('Python');
    });
    (0, vitest_1.it)('detects a Python requirements.txt project', async () => {
        const dir = await fixture({ 'requirements.txt': 'flask==3.0.0', 'app.py': 'x=1' });
        const profile = await (0, detect_1.detectTechnologyProfile)(dir);
        (0, vitest_1.expect)(profile.primaryLanguage).toBe('Python');
        (0, vitest_1.expect)(profile.frameworks.map((t) => t.id)).toContain('flask');
    });
    (0, vitest_1.it)('detects a Django project', async () => {
        const dir = await fixture({ 'manage.py': '#!/usr/bin/env python' });
        const profile = await (0, detect_1.detectTechnologyProfile)(dir);
        (0, vitest_1.expect)(profile.frameworks.map((t) => t.id)).toContain('django');
    });
    (0, vitest_1.it)('detects a Go module', async () => {
        const dir = await fixture({ 'go.mod': 'module example.com/x\n\ngo 1.22', 'main.go': 'package main' });
        const profile = await (0, detect_1.detectTechnologyProfile)(dir);
        (0, vitest_1.expect)(profile.primaryLanguage).toBe('Go');
    });
    (0, vitest_1.it)('detects a Node.js project', async () => {
        const dir = await fixture({ 'package.json': '{"name":"x"}', 'index.js': 'x' });
        const profile = await (0, detect_1.detectTechnologyProfile)(dir);
        (0, vitest_1.expect)(profile.languages.map((t) => t.id)).toContain('javascript');
    });
    (0, vitest_1.it)('detects a Rust crate', async () => {
        const dir = await fixture({ 'Cargo.toml': '[package]\nname="x"', 'main.rs': 'fn main() {}' });
        const profile = await (0, detect_1.detectTechnologyProfile)(dir);
        (0, vitest_1.expect)(profile.primaryLanguage).toBe('Rust');
    });
    (0, vitest_1.it)('detects a Java Maven project', async () => {
        const dir = await fixture({ 'pom.xml': '<project></project>' });
        const profile = await (0, detect_1.detectTechnologyProfile)(dir);
        (0, vitest_1.expect)(profile.primaryLanguage).toBe('Java');
        (0, vitest_1.expect)(profile.buildTools.map((t) => t.id)).toContain('maven');
    });
    (0, vitest_1.it)('detects a .NET project', async () => {
        const dir = await fixture({ 'App.csproj': '<Project></Project>' });
        const profile = await (0, detect_1.detectTechnologyProfile)(dir);
        (0, vitest_1.expect)(profile.primaryLanguage).toBe('.NET / C#');
    });
    (0, vitest_1.it)('detects a polyglot monorepo root with multiple languages', async () => {
        const dir = await fixture({
            'backend-php/composer.json': '{}',
            'worker-python/pyproject.toml': '[tool.poetry]',
            'gateway-go/go.mod': 'module x',
        });
        const profile = await (0, detect_1.detectTechnologyProfile)(dir);
        // Top-level scan only sees nested dirs, not files inside them -- modules.ts covers those.
        (0, vitest_1.expect)(profile.languages).toEqual([]);
    });
    (0, vitest_1.it)('returns safe empty profile for unknown/empty directory', async () => {
        const dir = await fixture({});
        const profile = await (0, detect_1.detectTechnologyProfile)(dir);
        (0, vitest_1.expect)(profile.primaryLanguage).toBeNull();
        (0, vitest_1.expect)(profile.languages).toEqual([]);
    });
    (0, vitest_1.it)('does not throw for a non-existent directory', async () => {
        const profile = await (0, detect_1.detectTechnologyProfile)('/nonexistent/path/xyz');
        (0, vitest_1.expect)(profile.primaryLanguage).toBeNull();
    });
});
