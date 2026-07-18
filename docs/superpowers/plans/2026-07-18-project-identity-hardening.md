# Project Identity Hardening Implementation Plan (Part A)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One real project always maps to exactly one campus room, regardless of when a git remote appears, how the remote URL is written, which subdirectory an event comes from, or transient git failures.

**Architecture:** All identity computation stays in `packages/project-inspector` (pure-ish, execFile only). `apps/api/src/projects/projects.service.ts` gets an atomic upsert plus an in-place `path:` → `remote:` key upgrade. A manual `pnpm db:dedupe` script merges pre-existing duplicate rows.

**Tech Stack:** TypeScript, vitest, Prisma + Postgres (integration tests need `pnpm db:up` first), tsx for scripts.

## Global Constraints

- Never assume a monitored project uses Node.js or any manifest; identity must work for empty directories (CLAUDE.md universal-project requirement).
- `project-inspector` uses `execFile` with args arrays only — never shell strings.
- Project identity must never depend on a transient condition; transient git failure → `GitUnavailableError` (drop event), never a downgraded `path:` identity.
- Integration tests run against the `campus_test` schema via `apps/api/test/setup.ts` — do not touch that wiring.
- Gates before done: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.
- Run a single test file: `pnpm --filter @campus/project-inspector exec vitest run src/projectKey.test.ts` / `pnpm --filter @campus/api exec vitest run test/projects.integration.test.ts`.

---

### Task 1: normalizeRemoteUrl — strip userinfo and default ports

**Files:**
- Modify: `packages/project-inspector/src/projectKey.ts:6-14`
- Test: `packages/project-inspector/src/projectKey.test.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: `normalizeRemoteUrl(remoteUrl: string): string` (same signature, stronger normalization). Task 5's integration test relies on `https://token@host/o/r` and `git@host:o/r` hashing identically.

- [ ] **Step 1: Write the failing tests**

Add to the `normalizeRemoteUrl` describe block in `packages/project-inspector/src/projectKey.test.ts`:

```ts
  it('strips embedded userinfo (https token clones)', () => {
    expect(normalizeRemoteUrl('https://x-access-token:SECRET@github.com/acme/widgets.git')).toBe(
      normalizeRemoteUrl('https://github.com/acme/widgets.git'),
    );
    expect(normalizeRemoteUrl('https://user@github.com/acme/widgets')).toBe(
      normalizeRemoteUrl('https://github.com/acme/widgets'),
    );
  });

  it('strips default ports so ssh:// and scp forms match', () => {
    expect(normalizeRemoteUrl('ssh://git@github.com:22/acme/widgets.git')).toBe(
      normalizeRemoteUrl('git@github.com:acme/widgets.git'),
    );
    expect(normalizeRemoteUrl('https://github.com:443/acme/widgets')).toBe(
      normalizeRemoteUrl('https://github.com/acme/widgets'),
    );
  });

  it('keeps non-default ports distinct', () => {
    expect(normalizeRemoteUrl('ssh://git@git.corp:2222/acme/widgets')).not.toBe(
      normalizeRemoteUrl('ssh://git@git.corp/acme/widgets'),
    );
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @campus/project-inspector exec vitest run src/projectKey.test.ts`
Expected: FAIL — userinfo/port strings differ.

- [ ] **Step 3: Implement**

Replace `normalizeRemoteUrl` in `packages/project-inspector/src/projectKey.ts`:

```ts
/** Normalizes ssh/https/git-protocol remote URLs to one comparable form. */
export function normalizeRemoteUrl(remoteUrl: string): string {
  let value = remoteUrl.trim().toLowerCase();
  value = value.replace(/\.git$/, '');
  // scp form (git@host:org/repo) -> ssh URL so one pipeline handles everything below
  value = value.replace(/^git@([^:]+):/, 'ssh://$1/');
  // userinfo (user:token@) never identifies the repo
  value = value.replace(/^(\w+):\/\/[^/@]*@/, '$1://');
  // default ports
  value = value.replace(/^ssh:\/\/([^/:]+):22\//, 'ssh://$1/');
  value = value.replace(/^https:\/\/([^/:]+):443\//, 'https://$1/');
  value = value.replace(/^http:\/\/([^/:]+):80\//, 'http://$1/');
  // one canonical scheme
  value = value.replace(/^(?:ssh|git|http):\/\//, 'https://');
  value = value.replace(/\/+$/, '');
  return value;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @campus/project-inspector exec vitest run src/projectKey.test.ts`
Expected: PASS, including the pre-existing "ssh and https forms" test.

- [ ] **Step 5: Commit**

```bash
git add packages/project-inspector/src/projectKey.ts packages/project-inspector/src/projectKey.test.ts
git commit -m "fix(inspector): normalize userinfo and default ports in remote URLs"
```

---

### Task 2: widen transient git-failure detection

**Files:**
- Modify: `packages/project-inspector/src/git.ts:37-39`
- Test: `packages/project-inspector/src/git.test.ts`

**Interfaces:**
- Produces: `isTransientGitFailure(error: unknown): boolean` — same signature, now also true for signal-terminated processes and errno `EAGAIN`/`EMFILE`/`ENOMEM`/`ETIMEDOUT`.

- [ ] **Step 1: Write the failing tests**

Add to the `isTransientGitFailure` describe block in `packages/project-inspector/src/git.test.ts`:

```ts
  it('classifies resource-exhaustion errnos as transient', () => {
    expect(isTransientGitFailure({ code: 'EAGAIN', errno: -35 })).toBe(true);
    expect(isTransientGitFailure({ code: 'EMFILE', errno: -24 })).toBe(true);
    expect(isTransientGitFailure({ code: 'ENOMEM', errno: -12 })).toBe(true);
    expect(isTransientGitFailure({ code: 'ETIMEDOUT', errno: -60 })).toBe(true);
  });

  it('classifies an externally-killed git as transient', () => {
    expect(isTransientGitFailure({ killed: false, signal: 'SIGKILL', code: null })).toBe(true);
  });

  it('still classifies a clean non-zero exit as a real answer', () => {
    expect(isTransientGitFailure({ code: 128, signal: null, stderr: 'fatal: not a git repository' })).toBe(false);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @campus/project-inspector exec vitest run src/git.test.ts`
Expected: FAIL — errno/signal cases return false.

- [ ] **Step 3: Implement**

Replace `isTransientGitFailure` in `packages/project-inspector/src/git.ts` (keep the existing doc comment, extend its last sentence):

```ts
/**
 * A timeout kill is transient: the same directory answers differently on the next call, so
 * treating it as "not a repository" would mint a second identity for a project that already
 * has one. The same holds for any signal-terminated git and for resource-exhaustion errnos
 * (EAGAIN/EMFILE/ENOMEM/ETIMEDOUT) under load. Every other failure is a stable answer -- a
 * non-zero exit means git ran and said no, and a missing git binary (ENOENT) answers the
 * same way on every call -- so those keep their null result and non-git projects keep working.
 */
const TRANSIENT_ERRNO_CODES = new Set(['EAGAIN', 'EMFILE', 'ENOMEM', 'ETIMEDOUT']);

export function isTransientGitFailure(error: unknown): boolean {
  const failure = error as { killed?: boolean; signal?: string | null; code?: unknown } | null;
  if (!failure) return false;
  if (failure.killed === true) return true;
  if (typeof failure.signal === 'string' && failure.signal.length > 0) return true;
  return typeof failure.code === 'string' && TRANSIENT_ERRNO_CODES.has(failure.code);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @campus/project-inspector exec vitest run src/git.test.ts`
Expected: PASS (including existing ENOENT-is-stable test — `ENOENT` is not in the set).

- [ ] **Step 5: Commit**

```bash
git add packages/project-inspector/src/git.ts packages/project-inspector/src/git.test.ts
git commit -m "fix(inspector): treat signal kills and resource-exhaustion errnos as transient"
```

---

### Task 3: remote fallback when `origin` is absent

**Files:**
- Modify: `packages/project-inspector/src/git.ts:58-90`
- Test: `packages/project-inspector/src/git.test.ts`

**Interfaces:**
- Consumes: private `git(cwd, args, timeoutMs)` helper (existing).
- Produces: `resolveGitInfo` unchanged signature; `remoteUrl` now falls back to the first listed remote when `origin` is missing.

- [ ] **Step 1: Write the failing test**

Add to `packages/project-inspector/src/git.test.ts` (inside the `resolveGitInfo` describe; the file already has `makeTmpDir` and `execFileAsync` is NOT imported there — add `import { execFile } from 'node:child_process'; import { promisify } from 'node:util'; const execFileAsync = promisify(execFile);` near the top imports):

```ts
  it('falls back to the first remote when origin is absent', async () => {
    const dir = await makeTmpDir('campus-git-upstream-');
    await execFileAsync('git', ['init', '-q', '-b', 'main'], { cwd: dir });
    await execFileAsync('git', ['remote', 'add', 'upstream', 'https://github.com/acme/widgets.git'], { cwd: dir });

    const info = await resolveGitInfo(dir);
    expect(info.remoteUrl).toBe('https://github.com/acme/widgets.git');
  });

  it('prefers origin when several remotes exist', async () => {
    const dir = await makeTmpDir('campus-git-multi-');
    await execFileAsync('git', ['init', '-q', '-b', 'main'], { cwd: dir });
    await execFileAsync('git', ['remote', 'add', 'upstream', 'https://github.com/acme/fork.git'], { cwd: dir });
    await execFileAsync('git', ['remote', 'add', 'origin', 'https://github.com/acme/widgets.git'], { cwd: dir });

    const info = await resolveGitInfo(dir);
    expect(info.remoteUrl).toBe('https://github.com/acme/widgets.git');
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @campus/project-inspector exec vitest run src/git.test.ts`
Expected: first new test FAILS (`remoteUrl` is null), second passes already.

- [ ] **Step 3: Implement**

In `packages/project-inspector/src/git.ts`, add above `resolveGitInfo`:

```ts
/** origin first; otherwise the first remote git lists. Zero remotes -> null (path: identity). */
async function resolveRemoteUrl(cwd: string, timeoutMs: number): Promise<string | null> {
  const originUrl = await git(cwd, ['remote', 'get-url', 'origin'], timeoutMs);
  if (originUrl) return originUrl;
  const remotes = await git(cwd, ['remote'], timeoutMs);
  const first = remotes
    ?.split('\n')
    .map((name) => name.trim())
    .filter(Boolean)[0];
  if (!first) return null;
  return git(cwd, ['remote', 'get-url', first], timeoutMs);
}
```

and in `resolveGitInfo` replace the first element of the `Promise.all` array:

```ts
  const [remoteUrl, branch, gitDir, commonGitDir] = await Promise.all([
    resolveRemoteUrl(cwd, timeoutMs),
    git(cwd, ['rev-parse', '--abbrev-ref', 'HEAD'], timeoutMs),
    git(cwd, ['rev-parse', '--git-dir'], timeoutMs),
    git(cwd, ['rev-parse', '--git-common-dir'], timeoutMs),
  ]);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @campus/project-inspector exec vitest run src/git.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/project-inspector/src/git.ts packages/project-inspector/src/git.test.ts
git commit -m "fix(inspector): fall back to first git remote when origin is absent"
```

---

### Task 4: stable anchor for non-git projects

**Files:**
- Create: `packages/project-inspector/src/pathAnchor.ts`
- Create: `packages/project-inspector/src/pathAnchor.test.ts`
- Modify: `packages/project-inspector/src/resolveProject.ts:11-15`

**Interfaces:**
- Produces: `resolvePathAnchor(cwd: string): Promise<string>` — realpath'd nearest ancestor containing `.claude/`, else realpath(cwd). Used only for the non-git branch of `resolveProject`; Task 5's key-upgrade matching assumes `rootPath` for non-git rows is this anchor.

- [ ] **Step 1: Write the failing tests**

Create `packages/project-inspector/src/pathAnchor.test.ts`:

```ts
import { describe, expect, it, afterEach } from 'vitest';
import { mkdtemp, mkdir, rm, symlink, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { resolvePathAnchor } from './pathAnchor';

const dirsToClean: string[] = [];
afterEach(async () => {
  await Promise.all(dirsToClean.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});

async function makeTmpDir(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'campus-anchor-'));
  dirsToClean.push(dir);
  return dir;
}

describe('resolvePathAnchor', () => {
  it('walks up to the nearest ancestor containing .claude', async () => {
    const root = await makeTmpDir();
    await mkdir(path.join(root, '.claude'), { recursive: true });
    await mkdir(path.join(root, 'src', 'deep'), { recursive: true });

    const anchor = await resolvePathAnchor(path.join(root, 'src', 'deep'));
    expect(anchor).toBe(await realpath(root));
  });

  it('resolves symlinks so /tmp and /private/tmp agree', async () => {
    const root = await makeTmpDir();
    await mkdir(path.join(root, '.claude'), { recursive: true });
    const link = path.join(await makeTmpDir(), 'link');
    await symlink(root, link);

    expect(await resolvePathAnchor(link)).toBe(await resolvePathAnchor(root));
  });

  it('falls back to realpath(cwd) when no .claude ancestor exists', async () => {
    const dir = await makeTmpDir();
    expect(await resolvePathAnchor(dir)).toBe(await realpath(dir));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @campus/project-inspector exec vitest run src/pathAnchor.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement**

Create `packages/project-inspector/src/pathAnchor.ts`:

```ts
import { existsSync } from 'node:fs';
import { realpath } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';

/**
 * Stable identity anchor for a non-git working directory: the nearest ancestor containing
 * .claude/ (the campus installer creates one at the project root), after resolving
 * symlinks so /tmp and /private/tmp agree. The walk stops before the user's home
 * directory and the filesystem root -- ~/.claude is Claude Code's own config, never a
 * project root. No ancestor qualifies -> realpath(cwd) itself, so a directory with zero
 * markers still gets a stable identity (universal-project requirement).
 */
export async function resolvePathAnchor(cwd: string): Promise<string> {
  let real: string;
  try {
    real = await realpath(cwd);
  } catch {
    real = path.resolve(cwd);
  }
  const home = homedir();
  let dir = real;
  while (dir !== home && path.dirname(dir) !== dir) {
    if (existsSync(path.join(dir, '.claude'))) return dir;
    dir = path.dirname(dir);
  }
  return real;
}
```

Modify `packages/project-inspector/src/resolveProject.ts` — replace the body of `resolveProject`:

```ts
import type { ResolvedProject } from '@campus/contracts';
import { resolveGitInfo } from './git';
import { computeProjectKey, deriveProjectName, resolveStableRootPath } from './projectKey';
import { resolvePathAnchor } from './pathAnchor';
import { detectTechnologyProfile } from './technology/detect';

/**
 * Resolves stable project identity + technology profile for an arbitrary working
 * directory. Works for git repos, non-git directories, and worktrees alike -- never
 * requires a project manifest to exist (spec section 12).
 */
export async function resolveProject(cwd: string): Promise<ResolvedProject> {
  const gitInfo = await resolveGitInfo(cwd);
  const anchored = gitInfo.isGitRepository
    ? gitInfo
    : { ...gitInfo, rootPath: await resolvePathAnchor(cwd) };
  const projectKey = computeProjectKey(anchored);
  const rootPath = anchored.isGitRepository ? resolveStableRootPath(anchored) : anchored.rootPath;
  const technologyProfile = await detectTechnologyProfile(rootPath).catch(() => null);

  return {
    projectKey,
    name: deriveProjectName(rootPath),
    rootPath,
    currentWorkingDirectory: cwd,
    remoteUrl: gitInfo.remoteUrl,
    branch: gitInfo.branch,
    worktreePath: gitInfo.worktreePath,
    isGitRepository: gitInfo.isGitRepository,
    technologyProfile,
  };
}
```

- [ ] **Step 4: Add a resolveProject-level regression test**

Add to `packages/project-inspector/src/resolveProject.test.ts`:

```ts
  it('gives the same non-git identity from the project root and a subdirectory', async () => {
    const dir = await makeTmpDir();
    const { mkdir } = await import('node:fs/promises');
    await mkdir(path.join(dir, '.claude'), { recursive: true });
    await mkdir(path.join(dir, 'src'), { recursive: true });

    const fromRoot = await resolveProject(dir);
    const fromSub = await resolveProject(path.join(dir, 'src'));
    expect(fromSub.projectKey).toBe(fromRoot.projectKey);
    expect(fromSub.rootPath).toBe(fromRoot.rootPath);
  });
```

- [ ] **Step 5: Run all inspector tests**

Run: `pnpm --filter @campus/project-inspector exec vitest run`
Expected: PASS. Note: the pre-existing test `resolves a non-git directory safely` asserts on a `mkdtemp` dir — on macOS `tmpdir()` is a symlink, and `resolveProject` now realpaths, so if that test compares paths it keeps passing because it only checks `projectKey` prefix and profile; do not "fix" it to compare raw paths.

- [ ] **Step 6: Commit**

```bash
git add packages/project-inspector/src/pathAnchor.ts packages/project-inspector/src/pathAnchor.test.ts packages/project-inspector/src/resolveProject.ts packages/project-inspector/src/resolveProject.test.ts
git commit -m "fix(inspector): anchor non-git identity at nearest .claude root via realpath"
```

---

### Task 5: atomic upsert + in-place path:→remote: key upgrade

**Files:**
- Modify: `apps/api/src/projects/projects.service.ts:36-61`
- Test: `apps/api/test/projects.integration.test.ts`

**Interfaces:**
- Consumes: `ResolvedProject` from `@campus/contracts`; Prisma `Project.projectKey @unique`.
- Produces: `upsertFromResolvedProject(resolved: ResolvedProject)` — same signature/return. New behavior: (1) race-safe native upsert on `projectKey`; (2) when the key is `remote:*` and unknown, an existing row with the same `rootPath` and a `path:*` key is upgraded in place (same row id, room preserved).

- [ ] **Step 1: Write the failing integration test**

Requires Postgres: `pnpm db:up` once. Add to `apps/api/test/projects.integration.test.ts` (it already boots the Nest app the same way as `events.integration.test.ts`; reuse its helpers — if it has no `gitFixture`/`send` helpers, copy them from `apps/api/test/events.integration.test.ts` shown below):

```ts
  it('upgrades a path-keyed room in place when the repo gains a remote', async () => {
    const dir = await gitFixture({ 'README.md': '# x' }); // git repo, no remote
    const sessionId = randomUUID();

    await send(dir, sessionId, { hook_event_name: 'SessionStart' });
    const before = await request(app.getHttpServer()).get('/api/projects').expect(200);
    const room = before.body.find((p: { rootPath: string }) => p.rootPath === dir);
    expect(room).toBeDefined();
    expect(room.projectKey.startsWith('path:')).toBe(true);

    await execFileAsync('git', ['remote', 'add', 'origin', `https://github.com/acme/${path.basename(dir)}.git`], { cwd: dir });
    await send(dir, sessionId, { hook_event_name: 'UserPromptSubmit', prompt: 'hi' });

    const after = await request(app.getHttpServer()).get('/api/projects').expect(200);
    const rooms = after.body.filter((p: { rootPath: string }) => p.rootPath === dir);
    expect(rooms).toHaveLength(1);            // no second room
    expect(rooms[0].id).toBe(room.id);        // same row, upgraded
    expect(rooms[0].projectKey.startsWith('remote:')).toBe(true);
  });

  it('survives two concurrent first events without losing either', async () => {
    const dir = await gitFixture({ 'README.md': '# y' });
    await Promise.all([
      send(dir, randomUUID(), { hook_event_name: 'SessionStart' }),
      send(dir, randomUUID(), { hook_event_name: 'SessionStart' }),
    ]);
    const res = await request(app.getHttpServer()).get('/api/projects').expect(200);
    expect(res.body.filter((p: { rootPath: string }) => p.rootPath === dir)).toHaveLength(1);
  });
```

Helper reference (exists in `events.integration.test.ts`, replicate if missing here):

```ts
async function gitFixture(files: Record<string, string>): Promise<string> {
  const dir = await realpath(await mkdtemp(path.join(tmpdir(), 'campus-it-')));
  for (const [name, content] of Object.entries(files)) {
    const full = path.join(dir, name);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, content);
  }
  await execFileAsync('git', ['init', '-q', '-b', 'main'], { cwd: dir });
  await execFileAsync('git', ['config', 'user.email', 't@t.com'], { cwd: dir });
  await execFileAsync('git', ['config', 'user.name', 't'], { cwd: dir });
  await execFileAsync('git', ['add', '.'], { cwd: dir });
  await execFileAsync('git', ['commit', '-qm', 'init'], { cwd: dir });
  return dir;
}

async function send(cwd: string, sessionId: string, body: Record<string, unknown>) {
  return request(app.getHttpServer())
    .post('/api/claude/events')
    .send({ session_id: sessionId, cwd, ...body })
    .expect((res) => {
      if (res.status !== 201 && res.status !== 200) {
        throw new Error(`unexpected status ${res.status}: ${JSON.stringify(res.body)}`);
      }
    });
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @campus/api exec vitest run test/projects.integration.test.ts`
Expected: FAIL — two rooms for `dir` after the remote appears (`rooms` has length 2).

- [ ] **Step 3: Implement**

In `apps/api/src/projects/projects.service.ts`, replace the find/create block at the top of `upsertFromResolvedProject` (lines 37-61) with:

```ts
  async upsertFromResolvedProject(resolved: ResolvedProject) {
    let existing = await this.prisma.project.findUnique({ where: { projectKey: resolved.projectKey } });

    if (!existing && resolved.projectKey.startsWith('remote:')) {
      // The repo gained a remote after its room was created under a path: key.
      // Upgrade that row in place so the project keeps its one room. Rows whose
      // rootPath predates the anchor fix won't match; `pnpm db:dedupe` covers those.
      const pathTwin = await this.prisma.project.findFirst({
        where: { rootPath: resolved.rootPath, projectKey: { startsWith: 'path:' } },
        orderBy: { createdAt: 'asc' },
      });
      if (pathTwin) {
        existing = await this.prisma.project
          .update({ where: { id: pathTwin.id }, data: { projectKey: resolved.projectKey } })
          .catch((error: unknown) => {
            // P2002: a concurrent event upgraded another twin first -- fall through to upsert.
            if ((error as { code?: string }).code === 'P2002') return null;
            throw error;
          });
      }
    }

    const isNew = !existing;
    const position = calculateRoomPosition(isNew ? await this.prisma.project.count() : 0);
    // Native upsert compiles to INSERT ... ON CONFLICT, so two concurrent first events
    // both land on the same row instead of the loser 500ing on the unique index.
    const project = await this.prisma.project.upsert({
      where: { projectKey: resolved.projectKey },
      update: {
        lastActiveAt: new Date(),
        name: resolved.name,
        remoteUrl: resolved.remoteUrl,
        isGitRepository: resolved.isGitRepository,
      },
      create: {
        projectKey: resolved.projectKey,
        name: resolved.name,
        rootPath: resolved.rootPath,
        remoteUrl: resolved.remoteUrl,
        isGitRepository: resolved.isGitRepository,
        roomPositionX: position.x,
        roomPositionZ: position.z,
      },
    });
```

Keep everything from `if (resolved.technologyProfile) {` onward unchanged (it already uses `project` and `isNew`).

Note: `isNew` may read `true` on both sides of a create race — both emit `projectCreated`, the frontend store upserts by id, harmless. Do not add locking for this.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @campus/api exec vitest run test/projects.integration.test.ts`
Expected: PASS.
Then the full API suite: `pnpm --filter @campus/api exec vitest run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/projects/projects.service.ts apps/api/test/projects.integration.test.ts
git commit -m "fix(api): atomic project upsert + in-place path->remote key upgrade"
```

---

### Task 6: `pnpm db:dedupe` — merge pre-existing duplicate rooms

**Files:**
- Create: `apps/api/src/projects/dedupe.ts`
- Create: `apps/api/test/dedupe.integration.test.ts`
- Create: `scripts/db-dedupe.ts`
- Modify: `package.json` (root, scripts block next to `db:prune`)

**Interfaces:**
- Produces: `mergeDuplicateProjects(prisma: PrismaClient, options: { dryRun: boolean }): Promise<{ groups: number; merged: number }>` in `apps/api/src/projects/dedupe.ts`. `scripts/db-dedupe.ts` is a thin CLI around it (mirrors `scripts/db-prune.ts` conventions: dotenv, `--dry-run`, manual-only).

**Merge rules** (duplicate group = >1 Project row with identical `rootPath`):
- Survivor: the row whose key starts `remote:` (newest such if several); else oldest `createdAt`.
- Per duplicate row, inside one transaction: re-point `sessions`, `tasks`, `events`, `toolExecutions`, `approvals`, `snapshots` via `updateMany({ where: { projectId: dup.id }, data: { projectId: survivor.id } })`.
- Agents need care (`@@unique([projectId, externalAgentId])`): move each dup agent unless the survivor already has an agent with the same non-null `externalAgentId`; in that clash case re-point the dup agent's `events`, `toolExecutions`, `taskAssignments` to the survivor's agent, then delete the dup agent.
- `modules`/`technologies`: delete dup rows (re-derived on the project's next event).
- Delete the dup Project row last.

- [ ] **Step 1: Write the failing integration test**

Create `apps/api/test/dedupe.integration.test.ts`:

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { mergeDuplicateProjects } from '../src/projects/dedupe';

describe('mergeDuplicateProjects (integration)', () => {
  const prisma = new PrismaClient();
  afterAll(() => prisma.$disconnect());

  async function makeDupPair() {
    const rootPath = `/fake/dedupe-${Math.random().toString(36).slice(2)}`;
    const survivor = await prisma.project.create({
      data: { projectKey: `remote:${rootPath}`, name: 'a', rootPath },
    });
    const dup = await prisma.project.create({
      data: { projectKey: `path:${rootPath}`, name: 'a', rootPath },
    });
    const session = await prisma.claudeSession.create({
      data: { externalSessionId: `s-${rootPath}`, projectId: dup.id, cwd: rootPath },
    });
    const agent = await prisma.projectAgent.create({
      data: { projectId: dup.id, agentType: 'main-claude', displayName: 'Main' },
    });
    await prisma.claudeEvent.create({
      data: {
        projectId: dup.id, sessionId: session.id, agentId: agent.id,
        hookEventName: 'SessionStart', normalizedType: 'session_start',
        payload: {}, occurredAt: new Date(),
      },
    });
    return { survivor, dup, rootPath };
  }

  it('moves history to the survivor and deletes the duplicate row', async () => {
    const { survivor, dup, rootPath } = await makeDupPair();

    const result = await mergeDuplicateProjects(prisma, { dryRun: false });
    expect(result.merged).toBeGreaterThanOrEqual(1);

    const rows = await prisma.project.findMany({ where: { rootPath } });
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(survivor.id);
    expect(await prisma.claudeEvent.count({ where: { projectId: survivor.id } })).toBe(1);
    expect(await prisma.claudeSession.count({ where: { projectId: survivor.id } })).toBe(1);
    expect(await prisma.projectAgent.count({ where: { projectId: survivor.id } })).toBe(1);
    expect(await prisma.project.findUnique({ where: { id: dup.id } })).toBeNull();
  });

  it('does nothing on --dry-run', async () => {
    const { rootPath } = await makeDupPair();
    await mergeDuplicateProjects(prisma, { dryRun: true });
    expect(await prisma.project.count({ where: { rootPath } })).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @campus/api exec vitest run test/dedupe.integration.test.ts`
Expected: FAIL — module `../src/projects/dedupe` does not exist.

- [ ] **Step 3: Implement the merge function**

Create `apps/api/src/projects/dedupe.ts`:

```ts
import type { PrismaClient, Prisma, Project } from '@prisma/client';

/**
 * Merges Project rows that share a rootPath -- the residue of the identity bugs fixed in
 * project-inspector (remote added later, cwd-keyed non-git rooms). Manual-only: invoked by
 * scripts/db-dedupe.ts, never automatically.
 */
export async function mergeDuplicateProjects(
  prisma: PrismaClient,
  options: { dryRun: boolean },
): Promise<{ groups: number; merged: number }> {
  const all = await prisma.project.findMany({ orderBy: { createdAt: 'asc' } });
  const byRoot = new Map<string, Project[]>();
  for (const project of all) {
    if (project.rootPath.trim() === '') continue;
    const group = byRoot.get(project.rootPath) ?? [];
    group.push(project);
    byRoot.set(project.rootPath, group);
  }

  let groups = 0;
  let merged = 0;
  for (const [rootPath, rows] of byRoot) {
    if (rows.length < 2) continue;
    groups += 1;
    const remoteRows = rows.filter((r) => r.projectKey.startsWith('remote:'));
    const survivor = remoteRows.length > 0 ? remoteRows[remoteRows.length - 1] : rows[0];
    const duplicates = rows.filter((r) => r.id !== survivor.id);
    console.log(`${rootPath}: keeping ${survivor.projectKey}, merging ${duplicates.length} duplicate(s)`);
    if (options.dryRun) continue;

    for (const dup of duplicates) {
      await prisma.$transaction(async (tx) => {
        await mergeAgents(tx, dup.id, survivor.id);
        await tx.claudeSession.updateMany({ where: { projectId: dup.id }, data: { projectId: survivor.id } });
        await tx.task.updateMany({ where: { projectId: dup.id }, data: { projectId: survivor.id } });
        await tx.claudeEvent.updateMany({ where: { projectId: dup.id }, data: { projectId: survivor.id } });
        await tx.toolExecution.updateMany({ where: { projectId: dup.id }, data: { projectId: survivor.id } });
        await tx.approvalRequest.updateMany({ where: { projectId: dup.id }, data: { projectId: survivor.id } });
        await tx.activitySnapshot.updateMany({ where: { projectId: dup.id }, data: { projectId: survivor.id } });
        // modules/technologies are re-derived on the next event; deleting avoids
        // (projectId, relativePath)/(projectId, techId) unique clashes.
        await tx.projectModule.deleteMany({ where: { projectId: dup.id } });
        await tx.projectTechnology.deleteMany({ where: { projectId: dup.id } });
        await tx.project.delete({ where: { id: dup.id } });
      });
      merged += 1;
    }
  }
  return { groups, merged };
}

/** Moves agents to the survivor; on (projectId, externalAgentId) clash, folds the dup
 * agent's history into the survivor's agent and deletes the dup agent. */
async function mergeAgents(tx: Prisma.TransactionClient, dupProjectId: string, survivorProjectId: string) {
  const dupAgents = await tx.projectAgent.findMany({ where: { projectId: dupProjectId } });
  for (const agent of dupAgents) {
    const clash = agent.externalAgentId
      ? await tx.projectAgent.findUnique({
          where: { projectId_externalAgentId: { projectId: survivorProjectId, externalAgentId: agent.externalAgentId } },
        })
      : null;
    if (!clash) {
      await tx.projectAgent.update({ where: { id: agent.id }, data: { projectId: survivorProjectId } });
      continue;
    }
    await tx.claudeEvent.updateMany({ where: { agentId: agent.id }, data: { agentId: clash.id } });
    await tx.toolExecution.updateMany({ where: { agentId: agent.id }, data: { agentId: clash.id } });
    await tx.taskAssignment.updateMany({ where: { agentId: agent.id }, data: { agentId: clash.id } });
    await tx.projectAgent.delete({ where: { id: agent.id } });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @campus/api exec vitest run test/dedupe.integration.test.ts`
Expected: PASS.

- [ ] **Step 5: Add the CLI script**

Create `scripts/db-dedupe.ts` (same conventions as `scripts/db-prune.ts`):

```ts
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
```

Add to root `package.json` scripts, directly under `"db:prune"`:

```json
    "db:dedupe": "tsx scripts/db-dedupe.ts",
```

- [ ] **Step 6: Verify the CLI end-to-end**

Run: `pnpm db:dedupe --dry-run`
Expected: prints either `Nothing to merge...` or a list of duplicate groups against your real campus DB; exits 0. (This reads `public` — dry-run only here.)

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/projects/dedupe.ts apps/api/test/dedupe.integration.test.ts scripts/db-dedupe.ts package.json
git commit -m "feat(api): pnpm db:dedupe merges duplicate rooms sharing a rootPath"
```

---

### Task 7: full gates + docs touch-up

**Files:**
- Modify: `docs/troubleshooting.md` (add a "duplicate rooms" entry pointing at `pnpm db:dedupe`)

- [ ] **Step 1: Run all gates**

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```
Expected: all green. (`pnpm test` needs `pnpm db:up` done once.)

- [ ] **Step 2: Document**

Append to `docs/troubleshooting.md`:

```markdown
## One project shows up as two rooms

Fixed causes: missing `origin` remote (now falls back to any remote), token/port variants
of the same remote URL, non-git projects keyed by cwd instead of their `.claude` root, and
transient git failures. Rooms created before the fix are merged manually:

​```bash
pnpm db:dedupe --dry-run   # list duplicate groups
pnpm db:dedupe             # merge history into one room per project directory
​```
```

- [ ] **Step 3: Commit**

```bash
git add docs/troubleshooting.md
git commit -m "docs: troubleshooting entry for duplicate rooms + db:dedupe"
```
