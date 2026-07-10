import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..', '..', '..');

const readme = readFileSync(path.join(ROOT, 'README.md'), 'utf8');
const pkg = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8')) as { scripts: Record<string, string> };

function matches(re: RegExp): string[] {
  return [...new Set([...readme.matchAll(re)].map((m) => m[1]!))];
}

describe('README stays in sync with the repo', () => {
  it('references only pnpm scripts that actually exist', () => {
    // any `pnpm <name>` or `pnpm <name>:<sub>` token, minus the built-in `install`
    const referenced = matches(/pnpm ([a-z][a-z0-9]*(?::[a-z0-9]+)?)/g).filter((s) => s !== 'install');
    const missing = referenced.filter((s) => !(s in pkg.scripts));
    expect(missing, `README names scripts that do not exist: ${missing.join(', ')}`).toEqual([]);
    // sanity: it really is exercising the custom scripts
    expect(referenced).toContain('campus:install');
    expect(referenced).toContain('screenshots');
  });

  it('links only screenshots that exist on disk', () => {
    const images = matches(/(docs\/images\/[\w-]+\.png)/g);
    expect(images.length).toBeGreaterThanOrEqual(4);
    const missing = images.filter((p) => !existsSync(path.join(ROOT, p)));
    expect(missing, `README links missing images: ${missing.join(', ')}`).toEqual([]);
  });

  it('links only docs pages that exist on disk', () => {
    const docs = matches(/(docs\/[\w-]+\.md)/g);
    const missing = docs.filter((p) => !existsSync(path.join(ROOT, p)));
    expect(missing, `README links missing docs: ${missing.join(', ')}`).toEqual([]);
  });
});
