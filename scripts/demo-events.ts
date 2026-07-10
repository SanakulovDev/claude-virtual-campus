import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const CAMPUS_URL = process.env.CLAUDE_CAMPUS_URL ?? 'http://localhost:4000';

export interface SimOptions {
  /** Delay between hook events so phase transitions are visible in the UI. 0 = as fast as
   * possible (used by the e2e smoke test which asserts final state, not animation). */
  paceMs?: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function gitFixture(prefix: string, files: Record<string, string>): string {
  const dir = realpathSync(mkdtempSync(path.join(tmpdir(), prefix)));
  for (const [name, content] of Object.entries(files)) {
    const full = path.join(dir, name);
    mkdirSync(path.dirname(full), { recursive: true });
    writeFileSync(full, content);
  }
  execFileSync('git', ['init', '-q', '-b', 'main'], { cwd: dir });
  execFileSync('git', ['config', 'user.email', 'demo@example.com'], { cwd: dir });
  execFileSync('git', ['config', 'user.name', 'Campus Demo'], { cwd: dir });
  execFileSync('git', ['add', '.'], { cwd: dir });
  execFileSync('git', ['commit', '-qm', 'init'], { cwd: dir });
  return dir;
}

async function send(sessionId: string, cwd: string, body: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${CAMPUS_URL}/api/claude/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, cwd, ...body }),
  });
  if (!res.ok) {
    throw new Error(`demo event rejected (${res.status}): ${await res.text()}`);
  }
}

async function runSequence(cwd: string, steps: Array<Record<string, unknown>>, paceMs: number): Promise<string> {
  const sessionId = randomUUID();
  for (let i = 0; i < steps.length; i += 1) {
    await send(sessionId, cwd, steps[i]!);
    if (paceMs > 0 && i < steps.length - 1) await sleep(paceMs);
  }
  return sessionId;
}

// idle -> planning -> working (read/edit) -> checking (test) -> completed -> idle
const workflow = (dir: string, prompt: string, files: { read: string; edit: string; test: string }) => [
  { hook_event_name: 'SessionStart' },
  { hook_event_name: 'UserPromptSubmit', prompt },
  { hook_event_name: 'PreToolUse', tool_name: 'Read', tool_input: { file_path: `${dir}/${files.read}` } },
  { hook_event_name: 'PreToolUse', tool_name: 'Edit', tool_input: { file_path: `${dir}/${files.edit}` } },
  { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: files.test } },
  { hook_event_name: 'PostToolUse', tool_name: 'Bash', tool_input: { command: files.test }, tool_response: { is_error: false } },
  { hook_event_name: 'Stop' },
  { hook_event_name: 'SessionEnd' },
];

export async function simulatePhp(opts: SimOptions = {}): Promise<{ dir: string; sessionId: string }> {
  const dir = gitFixture('campus-demo-php-', {
    'composer.json': '{"require":{"laravel/framework":"^11.0","php":"^8.2"}}',
    artisan: '#!/usr/bin/env php',
    'app/Services/PaymentService.php': '<?php\n\nclass PaymentService {}\n',
  });
  const sessionId = await runSequence(
    dir,
    workflow(dir, 'Implement refresh-token rotation', {
      read: 'composer.json',
      edit: 'app/Services/PaymentService.php',
      test: 'vendor/bin/phpunit',
    }),
    opts.paceMs ?? 0,
  );
  return { dir, sessionId };
}

export async function simulatePython(opts: SimOptions = {}): Promise<{ dir: string; sessionId: string }> {
  const dir = gitFixture('campus-demo-python-', {
    'pyproject.toml': '[tool.poetry]\nname = "ai-service"\n\n[tool.poetry.dependencies]\nfastapi = "^0.115.0"\n',
    'app/services/payment.py': 'def rotate_token():\n    pass\n',
  });
  const sessionId = await runSequence(
    dir,
    workflow(dir, 'Create a database migration for subscriptions', {
      read: 'pyproject.toml',
      edit: 'app/services/payment.py',
      test: 'python -m pytest',
    }),
    opts.paceMs ?? 0,
  );
  return { dir, sessionId };
}

export async function simulateGo(opts: SimOptions = {}): Promise<{ dir: string; sessionId: string }> {
  const dir = gitFixture('campus-demo-go-', {
    'go.mod': 'module example.com/payment-service\n\ngo 1.22\n',
    'internal/payment/service.go': 'package payment\n',
  });
  const sessionId = await runSequence(
    dir,
    workflow(dir, 'Fix the failing integration tests', {
      read: 'go.mod',
      edit: 'internal/payment/service.go',
      test: 'go test ./...',
    }),
    opts.paceMs ?? 0,
  );
  return { dir, sessionId };
}

/**
 * Attention demonstration: work -> a destructive command needs permission -> the agent
 * pauses in the attention state and an approval drawer appears -> (human or Playwright
 * resolves it) -> work resumes. The approval request is fired but not awaited so it stays
 * pending for the UI to resolve, exactly like the real flow.
 */
export async function simulateAttention(opts: SimOptions = {}): Promise<{ dir: string; sessionId: string }> {
  const paceMs = opts.paceMs ?? 0;
  const dir = gitFixture('campus-demo-attention-', {
    'package.json': '{"name":"telegram-bot"}',
    'src/index.js': 'console.log("bot")\n',
  });
  const sessionId = randomUUID();
  const destructive = 'rm -rf ./build';

  await send(sessionId, dir, { hook_event_name: 'SessionStart' });
  if (paceMs) await sleep(paceMs);
  await send(sessionId, dir, { hook_event_name: 'UserPromptSubmit', prompt: 'Clean up the build directory' });
  if (paceMs) await sleep(paceMs);
  await send(sessionId, dir, { hook_event_name: 'PreToolUse', tool_name: 'Edit', tool_input: { file_path: `${dir}/src/index.js` } });
  if (paceMs) await sleep(paceMs);

  // fire the blocking approval request (do not await -- it stays pending for the UI)
  void fetch(`${CAMPUS_URL}/api/claude/approval`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id: sessionId, cwd: dir, hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: destructive } }),
  }).catch(() => undefined);

  // and drive the agent into the attention state via the observational pipeline
  await send(sessionId, dir, { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: destructive } });

  return { dir, sessionId };
}

const SIMULATIONS: Record<string, (opts: SimOptions) => Promise<{ dir: string; sessionId: string }>> = {
  php: simulatePhp,
  python: simulatePython,
  go: simulateGo,
  attention: simulateAttention,
};

async function main() {
  const which = process.argv[2] ?? 'all';
  const paceMs = Number(process.env.DEMO_PACE_MS ?? 900);
  const targets = which === 'all' ? ['php', 'python', 'go', 'attention'] : [which];

  for (const name of targets) {
    const run = SIMULATIONS[name];
    if (!run) {
      // eslint-disable-next-line no-console
      console.error(`Unknown demo target "${name}". Expected: all, ${Object.keys(SIMULATIONS).join(', ')}`);
      process.exit(1);
    }
    // eslint-disable-next-line no-console
    console.log(`Running ${name} demo against ${CAMPUS_URL} (pace ${paceMs}ms) ...`);
    const { dir } = await run({ paceMs });
    // eslint-disable-next-line no-console
    console.log(`  ${name} studio: ${dir}`);
  }

  // eslint-disable-next-line no-console
  console.log('Done. Open the campus UI to watch the studios react in real time.');
}

const isMain = process.argv[1] && process.argv[1].endsWith('demo-events.ts');
if (isMain) {
  main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  });
}
