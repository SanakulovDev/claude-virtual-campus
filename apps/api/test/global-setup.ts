import { execFileSync } from 'node:child_process';
import { TEST_DATABASE_URL } from './database-url';

/** Creates/updates the isolated test schema once per run -- `migrate deploy` creates it if absent. */
export default function setup(): void {
  execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: 'inherit',
  });
}
