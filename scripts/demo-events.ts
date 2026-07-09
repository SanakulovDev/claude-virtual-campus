import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const CAMPUS_URL = process.env.CLAUDE_CAMPUS_URL ?? 'http://localhost:4000';

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

async function runSequence(cwd: string, steps: Array<Record<string, unknown>>): Promise<string> {
  const sessionId = randomUUID();
  for (const step of steps) {
    await send(sessionId, cwd, step);
  }
  return sessionId;
}

export async function simulatePhp(): Promise<{ dir: string; sessionId: string }> {
  const dir = gitFixture('campus-demo-php-', {
    'composer.json': '{"require":{"laravel/framework":"^11.0","php":"^8.2"}}',
    artisan: '#!/usr/bin/env php',
    'app/Services/PaymentService.php': '<?php\n\nclass PaymentService {}\n',
  });
  const sessionId = await runSequence(dir, [
    { hook_event_name: 'SessionStart' },
    { hook_event_name: 'UserPromptSubmit', prompt: 'Implement refresh-token rotation' },
    { hook_event_name: 'PreToolUse', tool_name: 'Read', tool_input: { file_path: `${dir}/composer.json` } },
    { hook_event_name: 'PreToolUse', tool_name: 'Edit', tool_input: { file_path: `${dir}/app/Services/PaymentService.php` } },
    { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'vendor/bin/phpunit' } },
    { hook_event_name: 'PostToolUse', tool_name: 'Bash', tool_input: { command: 'vendor/bin/phpunit' }, tool_response: { is_error: false } },
    { hook_event_name: 'Stop' },
    { hook_event_name: 'SessionEnd' },
  ]);
  return { dir, sessionId };
}

export async function simulatePython(): Promise<{ dir: string; sessionId: string }> {
  const dir = gitFixture('campus-demo-python-', {
    'pyproject.toml': '[tool.poetry]\nname = "ai-service"\n\n[tool.poetry.dependencies]\nfastapi = "^0.115.0"\n',
    'app/services/payment.py': 'def rotate_token():\n    pass\n',
  });
  const sessionId = await runSequence(dir, [
    { hook_event_name: 'SessionStart' },
    { hook_event_name: 'UserPromptSubmit', prompt: 'Create a database migration for subscriptions' },
    { hook_event_name: 'PreToolUse', tool_name: 'Read', tool_input: { file_path: `${dir}/pyproject.toml` } },
    { hook_event_name: 'PreToolUse', tool_name: 'Edit', tool_input: { file_path: `${dir}/app/services/payment.py` } },
    { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'python -m pytest' } },
    { hook_event_name: 'PostToolUse', tool_name: 'Bash', tool_input: { command: 'python -m pytest' }, tool_response: { is_error: false } },
    { hook_event_name: 'Stop' },
    { hook_event_name: 'SessionEnd' },
  ]);
  return { dir, sessionId };
}

export async function simulateGo(): Promise<{ dir: string; sessionId: string }> {
  const dir = gitFixture('campus-demo-go-', {
    'go.mod': 'module example.com/payment-service\n\ngo 1.22\n',
    'internal/payment/service.go': 'package payment\n',
  });
  const sessionId = await runSequence(dir, [
    { hook_event_name: 'SessionStart' },
    { hook_event_name: 'UserPromptSubmit', prompt: 'Fix the failing integration tests' },
    { hook_event_name: 'PreToolUse', tool_name: 'Read', tool_input: { file_path: `${dir}/go.mod` } },
    { hook_event_name: 'PreToolUse', tool_name: 'Edit', tool_input: { file_path: `${dir}/internal/payment/service.go` } },
    { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'go test ./...' } },
    { hook_event_name: 'PostToolUse', tool_name: 'Bash', tool_input: { command: 'go test ./...' }, tool_response: { is_error: false } },
    { hook_event_name: 'Stop' },
    { hook_event_name: 'SessionEnd' },
  ]);
  return { dir, sessionId };
}

const SIMULATIONS: Record<string, () => Promise<{ dir: string; sessionId: string }>> = {
  php: simulatePhp,
  python: simulatePython,
  go: simulateGo,
};

async function main() {
  const which = process.argv[2] ?? 'all';
  const targets = which === 'all' ? Object.keys(SIMULATIONS) : [which];

  for (const name of targets) {
    const run = SIMULATIONS[name];
    if (!run) {
      // eslint-disable-next-line no-console
      console.error(`Unknown demo target "${name}". Expected one of: all, ${Object.keys(SIMULATIONS).join(', ')}`);
      process.exit(1);
    }
    // eslint-disable-next-line no-console
    console.log(`Running ${name} demo against ${CAMPUS_URL} ...`);
    const { dir } = await run();
    // eslint-disable-next-line no-console
    console.log(`  ${name} demo project: ${dir}`);
  }

  // eslint-disable-next-line no-console
  console.log('Done. Open the campus UI to see the rooms react in real time.');
}

const isMain = process.argv[1] && process.argv[1].endsWith('demo-events.ts');
if (isMain) {
  main().catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  });
}
