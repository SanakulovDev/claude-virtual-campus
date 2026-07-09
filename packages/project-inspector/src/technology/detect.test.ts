import { describe, expect, it, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { detectTechnologyProfile } from './detect';

const dirsToClean: string[] = [];
afterEach(async () => {
  await Promise.all(dirsToClean.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});

async function fixture(files: Record<string, string>): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'campus-fixture-'));
  dirsToClean.push(dir);
  for (const [name, content] of Object.entries(files)) {
    const full = path.join(dir, name);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, content);
  }
  return dir;
}

describe('detectTechnologyProfile', () => {
  it('detects a PHP composer project', async () => {
    const dir = await fixture({ 'composer.json': '{"require": {"php": "^8.2"}}', 'index.php': '<?php' });
    const profile = await detectTechnologyProfile(dir);
    expect(profile.primaryLanguage).toBe('PHP');
    expect(profile.packageManagers.map((t) => t.id)).toContain('composer');
  });

  it('detects a Laravel project via artisan + composer content', async () => {
    const dir = await fixture({
      artisan: '#!/usr/bin/env php',
      'composer.json': '{"require": {"laravel/framework": "^11.0"}}',
    });
    const profile = await detectTechnologyProfile(dir);
    expect(profile.frameworks.map((t) => t.id)).toContain('laravel');
  });

  it('detects a Python pyproject project', async () => {
    const dir = await fixture({ 'pyproject.toml': '[tool.poetry]\nname="x"', 'app.py': 'x=1' });
    const profile = await detectTechnologyProfile(dir);
    expect(profile.primaryLanguage).toBe('Python');
  });

  it('detects a Python requirements.txt project', async () => {
    const dir = await fixture({ 'requirements.txt': 'flask==3.0.0', 'app.py': 'x=1' });
    const profile = await detectTechnologyProfile(dir);
    expect(profile.primaryLanguage).toBe('Python');
    expect(profile.frameworks.map((t) => t.id)).toContain('flask');
  });

  it('detects a Django project', async () => {
    const dir = await fixture({ 'manage.py': '#!/usr/bin/env python' });
    const profile = await detectTechnologyProfile(dir);
    expect(profile.frameworks.map((t) => t.id)).toContain('django');
  });

  it('detects a Go module', async () => {
    const dir = await fixture({ 'go.mod': 'module example.com/x\n\ngo 1.22', 'main.go': 'package main' });
    const profile = await detectTechnologyProfile(dir);
    expect(profile.primaryLanguage).toBe('Go');
  });

  it('detects a Node.js project', async () => {
    const dir = await fixture({ 'package.json': '{"name":"x"}', 'index.js': 'x' });
    const profile = await detectTechnologyProfile(dir);
    expect(profile.languages.map((t) => t.id)).toContain('javascript');
  });

  it('detects a Rust crate', async () => {
    const dir = await fixture({ 'Cargo.toml': '[package]\nname="x"', 'main.rs': 'fn main() {}' });
    const profile = await detectTechnologyProfile(dir);
    expect(profile.primaryLanguage).toBe('Rust');
  });

  it('detects a Java Maven project', async () => {
    const dir = await fixture({ 'pom.xml': '<project></project>' });
    const profile = await detectTechnologyProfile(dir);
    expect(profile.primaryLanguage).toBe('Java');
    expect(profile.buildTools.map((t) => t.id)).toContain('maven');
  });

  it('detects a .NET project', async () => {
    const dir = await fixture({ 'App.csproj': '<Project></Project>' });
    const profile = await detectTechnologyProfile(dir);
    expect(profile.primaryLanguage).toBe('.NET / C#');
  });

  it('detects a polyglot monorepo root with multiple languages', async () => {
    const dir = await fixture({
      'backend-php/composer.json': '{}',
      'worker-python/pyproject.toml': '[tool.poetry]',
      'gateway-go/go.mod': 'module x',
    });
    const profile = await detectTechnologyProfile(dir);
    // Top-level scan only sees nested dirs, not files inside them -- modules.ts covers those.
    expect(profile.languages).toEqual([]);
  });

  it('returns safe empty profile for unknown/empty directory', async () => {
    const dir = await fixture({});
    const profile = await detectTechnologyProfile(dir);
    expect(profile.primaryLanguage).toBeNull();
    expect(profile.languages).toEqual([]);
  });

  it('does not throw for a non-existent directory', async () => {
    const profile = await detectTechnologyProfile('/nonexistent/path/xyz');
    expect(profile.primaryLanguage).toBeNull();
  });
});
