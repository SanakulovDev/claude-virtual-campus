import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { mergeDuplicateProjects } from '../apps/api/src/projects/dedupe';

/**
 * Merges rooms that point at the same project directory -- the leftovers of the identity
 * bugs fixed in project-inspector. Manual command, never automatic. Run with --dry-run
 * to see what would be merged first.
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(ROOT, 'apps/api/package.json'));
require('dotenv').config({ path: path.join(ROOT, '.env') });
const { PrismaClient } = require('@prisma/client');

const dryRun = process.argv.includes('--dry-run');

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    const { groups, merged } = await mergeDuplicateProjects(prisma, { dryRun });
    if (groups === 0) {
      console.log('Nothing to merge: every room has a unique project directory.');
    } else if (dryRun) {
      console.log(`\n--dry-run: nothing merged. ${groups} duplicate group(s) found.`);
    } else {
      console.log(`\nMerged ${merged} duplicate room(s) across ${groups} group(s).`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
