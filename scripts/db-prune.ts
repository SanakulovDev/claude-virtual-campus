import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

/**
 * Removes campus rooms whose project directory no longer exists on disk -- typically the
 * throwaway repos left behind by demo runs, but the check is deliberately generic: a room
 * is pruned on missing rootPath alone, never on a name or /tmp pattern.
 *
 * A project on an unplugged drive or an unmounted network share reads as missing too, so
 * this is a manual command, never automatic. Run with --dry-run to see the list first;
 * a pruned project reappears on its next hook event anyway.
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'apps/api/package.json'));
require('dotenv').config({ path: path.join(ROOT, '.env') });
const { PrismaClient } = require('@prisma/client');

const dryRun = process.argv.includes('--dry-run');

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    const projects = await prisma.project.findMany({
      select: { id: true, name: true, rootPath: true, _count: { select: { events: true } } },
      orderBy: { lastActiveAt: 'desc' },
    });

    const dead = projects.filter(
      (p: { rootPath: string }) => p.rootPath.trim() !== '' && !existsSync(p.rootPath),
    );
    const kept = projects.length - dead.length;

    if (dead.length === 0) {
      console.log(`Nothing to prune: all ${projects.length} rooms still exist on disk.`);
      return;
    }

    console.log(`${dead.length} room(s) point at a directory that no longer exists:\n`);
    for (const p of dead) {
      console.log(`  ${p.name}  (${p._count.events} events)\n    ${p.rootPath}`);
    }

    if (dryRun) {
      console.log(`\n--dry-run: nothing deleted. ${kept} live room(s) would be kept.`);
      return;
    }

    // Sessions, agents, events and tool executions cascade from Project.
    const { count } = await prisma.project.deleteMany({
      where: { id: { in: dead.map((p: { id: string }) => p.id) } },
    });
    console.log(`\nPruned ${count} room(s). ${kept} live room(s) kept.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
