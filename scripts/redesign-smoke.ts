import { execSync, spawn, type ChildProcess } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
import { chromium, type Browser, type Page } from 'playwright';
import { simulatePhp, simulatePython, simulateGo, simulateAttention } from './demo-events';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATABASE_URL = 'postgresql://campus:campus@localhost:5433/campus?schema=public';
const API_URL = 'http://localhost:4000';
const WEB_URL = 'http://localhost:3100';
const SHOTS = path.join(ROOT, 'artifacts', 'redesign');

const children: ChildProcess[] = [];
let browser: Browser | null = null;
const consoleErrors: string[] = [];

function log(msg: string) {
  // eslint-disable-next-line no-console
  console.log(`[redesign] ${msg}`);
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`ASSERTION FAILED: ${message}`);
}

async function waitFor(url: string, label: string, timeoutMs = 40000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 404) return;
    } catch {
      /* not up yet */
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

function cleanup() {
  browser?.close().catch(() => undefined);
  for (const child of children) child.kill('SIGTERM');
}

async function shot(page: Page, name: string) {
  const file = path.join(SHOTS, name);
  await page.screenshot({ path: file });
  log(`captured ${path.relative(ROOT, file)}`);
}

async function settle(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

/** Poll the dock for a project button showing the given state label; returns the locator. */
async function waitForDockState(page: Page, label: string, timeoutMs: number) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const btn = page.locator('aside button').filter({ hasText: new RegExp(`· ${label}`) }).first();
    if (await btn.count()) return btn;
    await settle(300);
  }
  return null;
}

function freePort(port: number) {
  try {
    const pids = execSync(`lsof -ti:${port} || true`).toString().trim();
    if (pids) execSync(`kill -9 ${pids.split('\n').join(' ')} || true`);
  } catch {
    /* nothing listening */
  }
}

async function main() {
  mkdirSync(SHOTS, { recursive: true });

  // never let a leftover server from a previous run answer on our ports
  freePort(4000);
  freePort(3100);

  log('starting postgres ...');
  execSync('docker compose up -d postgres', { cwd: ROOT, stdio: 'inherit' });
  execSync('docker compose exec -T postgres sh -c "until pg_isready -U campus; do sleep 1; done"', { cwd: ROOT, stdio: 'inherit' });
  // start from a clean campus so the screenshots show only the demo studios, not the
  // accumulated fixtures from unit/integration runs. Local dev DB only.
  execSync('pnpm --filter @campus/api exec prisma migrate reset --force --skip-seed', {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL },
  });

  log('building (packages via turbo, then a fresh web build) ...');
  execSync('pnpm build', { cwd: ROOT, stdio: 'inherit' });
  // turbo may restore a cached (stale) .next; force a clean web build so `next start`
  // serves the current source.
  execSync('rm -rf apps/web/.next', { cwd: ROOT, stdio: 'inherit' });
  execSync('pnpm --filter @campus/web build', { cwd: ROOT, stdio: 'inherit' });

  log('starting api + web ...');
  spawnProcess('node', ['apps/api/dist/main.js'], ROOT, { DATABASE_URL, API_PORT: '4000', CORS_ORIGIN: WEB_URL });
  await waitFor(`${API_URL}/api/health`, 'api');
  spawnProcess('node_modules/.bin/next', ['start', '-p', '3100'], path.join(ROOT, 'apps/web'), { NEXT_PUBLIC_API_URL: API_URL });
  await waitFor(WEB_URL, 'web');

  log('seeding studios via demos ...');
  await simulatePhp();
  await simulatePython();
  await simulateGo();

  log('launching browser ...');
  browser = await chromium.launch({
    args: [
      '--enable-unsafe-swiftshader',
      '--use-gl=angle',
      '--use-angle=swiftshader',
      '--ignore-gpu-blocklist',
      '--enable-webgl',
    ],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('console', (m) => {
    if (m.type() === 'error') consoleErrors.push(m.text());
  });
  page.on('pageerror', (e) => consoleErrors.push(`PAGEERROR: ${e.message}`));
  await page.goto(WEB_URL, { waitUntil: 'networkidle' });
  await settle(4000); // let the scene mount + camera settle
  await shot(page, 'campus-overview.png'); // always capture, even if asserts fail below

  // 1. campus fills the viewport
  const canvas = page.locator('[data-testid="campus-canvas"] canvas');
  await canvas.waitFor({ state: 'visible', timeout: 20000 });
  const box = await canvas.boundingBox();
  assert(!!box && box.width > 1000 && box.height > 600, 'campus canvas should fill most of the viewport');

  // 2. project dock renders the seeded studios
  const dockText = await page.locator('aside').first().innerText();
  assert(dockText.length > 0, 'project dock should render');
  assert(/campus-demo-/.test(dockText), 'dock should list demo studios');

  // 3. run a PACED workflow so the browser can watch idle -> working -> checking live,
  // and focus that studio when it starts working.
  log('running a paced workflow for live-state screenshots ...');
  const paced = simulatePython({ paceMs: 1600 }).catch(() => undefined);

  const working = await waitForDockState(page, 'Working', 25000);
  assert(!!working, 'a studio should reach the Working state');
  await working!.click();
  await settle(1600);
  await page.locator('aside:has-text("Inspector")').waitFor({ timeout: 8000 });
  await shot(page, 'project-focused.png');

  // select the agent from the inspector -> agent drawer (Working)
  const agentButton = page.locator('aside button').filter({ hasText: /Claude|Agent/ }).first();
  if (await agentButton.count()) {
    await agentButton.click();
    await settle(800);
  }
  await shot(page, 'agent-working.png');

  // wait for the same workflow to enter Checking (agent walks to the shared review screen)
  const checking = await waitForDockState(page, 'Checking', 25000);
  assert(!!checking, 'the workflow should reach the Checking state');
  await settle(900);
  await shot(page, 'agent-checking.png');
  await paced;

  // 4. attention / approval flow
  log('triggering attention demo ...');
  void simulateAttention().catch(() => undefined);
  const approval = page.locator('text=Approval needed');
  await approval.waitFor({ timeout: 15000 });
  assert((await approval.count()) > 0, 'approval drawer should appear on a destructive command');
  await settle(600);
  await shot(page, 'approval-request.png');

  const realErrors = consoleErrors.filter((e) => !/favicon|Download the React DevTools|Warning:/i.test(e));
  assert(realErrors.length === 0, `no unexpected console errors (saw: ${realErrors.slice(0, 3).join(' | ')})`);

  log('ALL REDESIGN BROWSER CHECKS PASSED');
}

main()
  .then(() => {
    cleanup();
    process.exit(0);
  })
  .catch(async (err) => {
    // capture whatever is on screen to help diagnose
    try {
      const page = browser ? (browser.contexts()[0]?.pages()[0] ?? null) : null;
      if (page) {
        await page.screenshot({ path: path.join(SHOTS, 'failure.png') });
        const html = await page.content();
        // eslint-disable-next-line no-console
        console.error('PAGE SNIPPET:', html.slice(0, 400));
      }
      if (consoleErrors.length) {
        // eslint-disable-next-line no-console
        console.error('CONSOLE ERRORS:', consoleErrors.slice(0, 8).join('\n'));
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line no-console
    console.error(err);
    cleanup();
    process.exit(1);
  });
