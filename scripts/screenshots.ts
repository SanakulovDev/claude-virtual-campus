import { execSync, spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { chromium, type Browser, type Page } from 'playwright';
import { simulatePhp, simulateGo, simulateAttention } from './demo-events';

/**
 * Captures the README screenshots into docs/images from a real browser against a real,
 * freshly-reset campus. Deterministic: a single "prog.bts" studio staffed by a fixed team
 * (Claude/Lucy/Jarvis/Anna) via .claude/campus.json, plus php/go studios for the overview.
 * The DB is reset before AND after, so no screenshot fixture is left in the normal database.
 */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DATABASE_URL = 'postgresql://campus:campus@localhost:5433/campus?schema=public';
const API_URL = 'http://localhost:4000';
const WEB_URL = 'http://localhost:3100';
const SHOTS = path.join(ROOT, 'docs', 'images');

const children: ChildProcess[] = [];
let browser: Browser | null = null;

function log(msg: string) {
  // eslint-disable-next-line no-console
  console.log(`[screenshots] ${msg}`);
}

function settle(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
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
    await settle(500);
  }
  throw new Error(`Timed out waiting for ${label} at ${url}`);
}

function spawnProcess(command: string, args: string[], cwd: string, env: NodeJS.ProcessEnv): ChildProcess {
  const child = spawn(command, args, { cwd, env: { ...process.env, ...env }, stdio: 'pipe' });
  children.push(child);
  return child;
}

function freePort(port: number) {
  try {
    const pids = execSync(`lsof -ti:${port} || true`).toString().trim();
    if (pids) execSync(`kill -9 ${pids.split('\n').join(' ')} || true`);
  } catch {
    /* nothing listening */
  }
}

function resetDb() {
  execSync('pnpm --filter @campus/api exec prisma migrate reset --force --skip-seed', {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL },
  });
}

async function shot(page: Page, name: string) {
  await page.screenshot({ path: path.join(SHOTS, name) });
  log(`captured docs/images/${name}`);
}

async function send(sessionId: string, cwd: string, body: Record<string, unknown>) {
  const res = await fetch(`${API_URL}/api/claude/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, cwd, ...body }),
  });
  if (!res.ok) throw new Error(`event rejected (${res.status}): ${await res.text()}`);
}

/** Build a git repo literally named "prog.bts" with a campus.json team roster. */
function teamFixture(): string {
  const parent = realpathSync(mkdtempSync(path.join(tmpdir(), 'campus-shot-')));
  const dir = path.join(parent, 'prog.bts');
  mkdirSync(path.join(dir, 'app'), { recursive: true });
  writeFileSync(path.join(dir, 'composer.json'), '{"require":{"laravel/framework":"^11.0","php":"^8.2"}}');
  writeFileSync(path.join(dir, 'app', 'BillingService.php'), '<?php\nclass BillingService {}\n');
  mkdirSync(path.join(dir, '.claude'), { recursive: true });
  writeFileSync(
    path.join(dir, '.claude', 'campus.json'),
    JSON.stringify(
      {
        projectName: 'prog.bts',
        team: [
          { agentType: 'plan', name: "Ulug'bek", role: 'Planner' },
          { agentType: 'implementation-engineer', name: 'Shahnozaxon', role: 'Implementation Engineer' },
          { agentType: 'qa-engineer', name: 'Ahmadjon', role: 'QA Engineer' },
        ],
      },
      null,
      2,
    ),
  );
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: dir });
  execFileSync('git', ['config', 'user.email', 'demo@example.com'], { cwd: dir });
  execFileSync('git', ['config', 'user.name', 'Campus Demo'], { cwd: dir });
  execFileSync('git', ['add', '.'], { cwd: dir });
  execFileSync('git', ['commit', '-qm', 'init'], { cwd: dir });
  return dir;
}

/** Seed the full team so all four teammates are present in the room, then leave them idle. */
async function seedTeam(dir: string) {
  const session = randomUUID();
  await send(session, dir, { hook_event_name: 'SessionStart' });
  await send(session, dir, { hook_event_name: 'UserPromptSubmit', prompt: 'Add subscription billing to the checkout flow' });

  const startSub = (type: string) => send(session, dir, { hook_event_name: 'PreToolUse', tool_name: 'Task', tool_input: { subagent_type: type } });
  const stopSub = () => send(session, dir, { hook_event_name: 'SubagentStop' });

  await startSub('plan');
  await send(session, dir, { hook_event_name: 'PreToolUse', tool_name: 'Read', tool_input: { file_path: `${dir}/composer.json` } });
  await stopSub();

  await startSub('implementation-engineer');
  await send(session, dir, { hook_event_name: 'PreToolUse', tool_name: 'Edit', tool_input: { file_path: `${dir}/app/BillingService.php` } });
  await stopSub();

  await startSub('qa-engineer');
  await send(session, dir, { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'vendor/bin/phpunit' } });
  await send(session, dir, { hook_event_name: 'PostToolUse', tool_name: 'Bash', tool_input: { command: 'vendor/bin/phpunit' }, tool_response: { is_error: false } });
  await stopSub();

  await send(session, dir, { hook_event_name: 'Stop' });
  return session;
}

async function focusProject(page: Page, name: string) {
  const btn = page.locator('aside button').filter({ hasText: name }).first();
  await btn.waitFor({ timeout: 15000 });
  await btn.click();
  await page.locator('aside:has-text("Inspector")').waitFor({ timeout: 8000 });
}

async function setAmbient(page: Page, on: boolean) {
  const btn = page.getByRole('button', { name: /Ambient life/ });
  const label = (await btn.innerText()).toLowerCase();
  const isOn = label.includes('on');
  if (isOn !== on) await btn.click();
}

async function main() {
  mkdirSync(SHOTS, { recursive: true });
  freePort(4000);
  freePort(3100);

  log('starting postgres + clean campus ...');
  execSync('docker compose up -d postgres', { cwd: ROOT, stdio: 'inherit' });
  execSync('docker compose exec -T postgres sh -c "until pg_isready -U campus; do sleep 1; done"', { cwd: ROOT, stdio: 'inherit' });
  resetDb();

  log('building + starting api/web ...');
  execSync('pnpm build', { cwd: ROOT, stdio: 'inherit' });
  execSync('rm -rf apps/web/.next', { cwd: ROOT, stdio: 'inherit' });
  execSync('pnpm --filter @campus/web build', { cwd: ROOT, stdio: 'inherit' });
  spawnProcess('node', ['apps/api/dist/main.js'], ROOT, { DATABASE_URL, API_PORT: '4000', CORS_ORIGIN: WEB_URL });
  await waitFor(`${API_URL}/api/health`, 'api');
  spawnProcess('node_modules/.bin/next', ['start', '-p', '3100'], path.join(ROOT, 'apps/web'), { NEXT_PUBLIC_API_URL: API_URL });
  await waitFor(WEB_URL, 'web');

  log('seeding studios ...');
  const teamDir = teamFixture();
  await seedTeam(teamDir);
  await simulatePhp();
  await simulateGo();

  log('launching browser ...');
  browser = await chromium.launch({
    args: ['--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'],
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(WEB_URL, { waitUntil: 'networkidle' });
  await settle(4500);

  // 1. campus overview (multiple studios + shared campus areas)
  await setAmbient(page, false);
  await shot(page, 'campus-overview.png');

  // 2. the team studio, focused
  await focusProject(page, 'prog.bts');
  await settle(2500);
  await shot(page, 'project-room.png');

  // 3. multi-agent room (ambient off -> name · role labels, Idle)
  await settle(1500);
  await shot(page, 'multi-agent-room.png');

  // 4. agent inspector: select Jarvis to show role + profile + rename
  const jarvis = page.locator('aside button').filter({ hasText: 'Jarvis' }).first();
  if (await jarvis.count()) {
    await jarvis.click();
    await settle(1200);
  }
  await shot(page, 'agent-inspector.png');

  // 5. idle campus life (ambient on -> agents show ambient activity, clearly labelled)
  await setAmbient(page, true);
  await settle(11000); // let the ambient bucket advance past the settle delay
  await shot(page, 'idle-campus-life.png');

  // 6. approval request (attention flow)
  await setAmbient(page, false);
  void simulateAttention().catch(() => undefined);
  const approval = page.locator('text=Approval needed');
  await approval.waitFor({ timeout: 15000 });
  await settle(800);
  await shot(page, 'approval-request.png');

  log('ALL SCREENSHOTS CAPTURED');
}

main()
  .then(async () => {
    browser?.close().catch(() => undefined);
    for (const c of children) c.kill('SIGTERM');
    await settle(500);
    log('resetting DB so no screenshot fixture is left behind ...');
    try {
      resetDb();
    } catch {
      /* best effort */
    }
    process.exit(0);
  })
  .catch(async (err) => {
    try {
      if (browser) {
        const page = browser.contexts()[0]?.pages()[0];
        if (page) await page.screenshot({ path: path.join(SHOTS, 'failure.png') });
      }
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line no-console
    console.error(err);
    browser?.close().catch(() => undefined);
    for (const c of children) c.kill('SIGTERM');
    process.exit(1);
  });
