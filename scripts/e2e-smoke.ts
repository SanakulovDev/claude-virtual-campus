import { execSync, spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { simulatePhp, simulatePython, simulateGo } from './demo-events';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Own schema, never `public`: this script migrates and fills a campus with demo rooms, and
// must not touch the campus you actually use. `migrate deploy` below creates it if absent.
const DATABASE_URL = 'postgresql://campus:campus@localhost:5433/campus?schema=campus_smoke';
const API_URL = 'http://localhost:4000';
const WEB_URL = 'http://localhost:3100';

const children: ChildProcess[] = [];

function log(msg: string) {
  // eslint-disable-next-line no-console
  console.log(`[smoke] ${msg}`);
}

async function waitFor(url: string, label: string, timeoutMs = 30000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 404) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Timed out waiting for ${label} at ${url}`);
}

function spawnProcess(command: string, args: string[], cwd: string, env: NodeJS.ProcessEnv): ChildProcess {
  const child = spawn(command, args, { cwd, env: { ...process.env, ...env }, stdio: 'pipe' });
  children.push(child);
  return child;
}

function stopAll() {
  for (const child of children) {
    child.kill('SIGTERM');
  }
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
}

interface ProjectSummary {
  id: string;
  rootPath: string;
  technologies: Array<{ techId: string }>;
  agents: Array<{ externalAgentId: string | null; currentZoneKey: string; activity: string }>;
}

async function findProjectByRoot(rootPath: string): Promise<ProjectSummary> {
  const res = await fetch(`${API_URL}/api/projects`);
  const projects = (await res.json()) as ProjectSummary[];
  const found = projects.find((p) => p.rootPath === rootPath);
  if (!found) throw new Error(`Project not found for root path ${rootPath}`);
  return found;
}

async function assertTaskCompleted(projectId: string, language: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/projects/${projectId}/events`);
  const events = (await res.json()) as Array<{ normalizedType: string }>;
  assert(events.some((e) => e.normalizedType === 'stop'), `${language} project should have processed a Stop (task completion) event`);
}

async function assertRanThroughTestingZone(projectId: string, language: string): Promise<void> {
  const res = await fetch(`${API_URL}/api/projects/${projectId}/events`);
  const events = (await res.json()) as Array<{ normalizedType: string; payload: Record<string, unknown> }>;
  const ranTest = events.some((e) => e.normalizedType === 'command_run');
  assert(ranTest, `${language} project should have a command_run event (the classified test command)`);
}

async function main() {
  log('starting postgres via docker compose ...');
  execSync('docker compose up -d postgres', { cwd: ROOT, stdio: 'inherit' });
  execSync('docker compose exec -T postgres sh -c "until pg_isready -U campus; do sleep 1; done"', { cwd: ROOT, stdio: 'inherit' });

  log('applying prisma migrations ...');
  execSync('pnpm --filter @campus/api exec prisma migrate deploy', { cwd: ROOT, stdio: 'inherit', env: { ...process.env, DATABASE_URL } });

  log('building all packages ...');
  execSync('pnpm build', { cwd: ROOT, stdio: 'inherit' });

  log('starting api ...');
  spawnProcess('node', ['apps/api/dist/main.js'], ROOT, {
    DATABASE_URL,
    API_PORT: '4000',
    CORS_ORIGIN: WEB_URL,
  });
  await waitFor(`${API_URL}/api/health`, 'api health');
  log('api is up');

  log('starting web ...');
  spawnProcess('node_modules/.bin/next', ['start', '-p', '3100'], path.join(ROOT, 'apps/web'), {
    NEXT_PUBLIC_API_URL: API_URL,
  });
  await waitFor(WEB_URL, 'web');
  log('web is up');

  log('running PHP demo ...');
  const php = await simulatePhp();
  const phpProject = await findProjectByRoot(php.dir);
  assert(phpProject.technologies.some((t) => t.techId === 'php'), 'PHP project should detect php technology');
  assert(phpProject.technologies.some((t) => t.techId === 'laravel'), 'PHP project should detect laravel framework');
  await assertTaskCompleted(phpProject.id, 'PHP');
  await assertRanThroughTestingZone(phpProject.id, 'PHP');

  log('running Python demo ...');
  const python = await simulatePython();
  const pythonProject = await findProjectByRoot(python.dir);
  assert(pythonProject.technologies.some((t) => t.techId === 'python'), 'Python project should detect python technology');
  await assertRanThroughTestingZone(pythonProject.id, 'Python');

  log('running Go demo ...');
  const go = await simulateGo();
  const goProject = await findProjectByRoot(go.dir);
  assert(goProject.technologies.some((t) => t.techId === 'go'), 'Go project should detect go technology');
  await assertRanThroughTestingZone(goProject.id, 'Go');

  log('checking health endpoints ...');
  const health = await (await fetch(`${API_URL}/api/health`)).json();
  assert(health.status === 'ok', 'health endpoint should report ok');

  log('checking bootstrap snapshot includes all three demo rooms ...');
  const bootstrap = await (await fetch(`${API_URL}/api/campus/bootstrap`)).json();
  const rootPaths = new Set(bootstrap.projects.map((p: ProjectSummary) => p.rootPath));
  assert(rootPaths.has(php.dir), 'bootstrap should include PHP room');
  assert(rootPaths.has(python.dir), 'bootstrap should include Python room');
  assert(rootPaths.has(go.dir), 'bootstrap should include Go room');

  log('ALL SMOKE CHECKS PASSED');
}

main()
  .then(() => {
    stopAll();
    process.exit(0);
  })
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    stopAll();
    process.exit(1);
  });
