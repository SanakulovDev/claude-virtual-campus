import { ConflictException, ForbiddenException, HttpException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { spawn, type ChildProcess } from 'node:child_process';
import { createInterface } from 'node:readline';
import type { CampusRun } from '@prisma/client';
import { SOCKET_EVENTS } from '@campus/contracts';
import { redactSensitiveData } from '@campus/event-normalizer';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { isLoopbackHost, resolveApiHost } from '../config/api-host';
import { buildRunEnv } from './run-env';
import { parseStreamLine, clampPayload, extractOutcome, extractSessionId, type RunOutcome } from './stream-parser';
import { selectClaimable } from './scheduler';

const RUN_TIMEOUT_MS = Number(process.env.RUN_TIMEOUT_MS ?? 30 * 60 * 1000);
const RUN_EVENT_MAX_BYTES = Number(process.env.RUN_EVENT_MAX_BYTES ?? 32 * 1024);
const STDERR_CAP = 16 * 1024;
const GLOBAL_RUN_LIMIT = 3;
const QUEUE_LIMIT = 10;

@Injectable()
export class RunsService implements OnModuleInit {
  /** Live child handles; entries vanish on API restart (stop() then only flips the row). */
  private readonly children = new Map<string, ChildProcess>();
  private readonly seqCounters = new Map<string, number>();
  private readonly timedOut = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
  ) {}

  /** Runs interrupted by an API restart can never finish -- mark them honestly. */
  async onModuleInit() {
    await this.prisma.campusRun.updateMany({
      where: { status: { in: ['RUNNING', 'STARTING', 'STOPPING'] } },
      data: { status: 'FAILED', resultText: 'API restarted', finishedAt: new Date() },
    });
    await this.schedule();
  }

  private assertLoopback() {
    if (!isLoopbackHost(resolveApiHost())) {
      throw new ForbiddenException('runs are disabled on non-loopback binds');
    }
  }

  async start(projectId: string, prompt: string, options: { permissionMode?: string; model?: string } = {}): Promise<CampusRun> {
    this.assertLoopback();
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);
    const queued = await this.prisma.campusRun.count({ where: { projectId, status: 'QUEUED' } });
    if (queued >= QUEUE_LIMIT) throw new HttpException('queue is full for this project', 429);

    const run = await this.prisma.campusRun.create({
      data: { projectId, prompt, status: 'QUEUED', permissionMode: options.permissionMode ?? 'default', model: options.model ?? null },
    });
    await this.prisma.campusRun.update({ where: { id: run.id }, data: { conversationId: run.id } });
    this.realtime.emitToCampus(SOCKET_EVENTS.runStarted, run);
    await this.schedule();
    return this.prisma.campusRun.findUnique({ where: { id: run.id } }) as Promise<CampusRun>;
  }

  /** spawn with an args array + stdin prompt: the prompt is data, never argv, never shell. */
  private launch(run: CampusRun, cwd: string) {
    const args = ['-p', '--output-format', 'stream-json', '--verbose', '--permission-mode', run.permissionMode];
    if (run.model) args.push('--model', run.model);
    if (run.parentRunId && run.sessionId) args.push('--resume', run.sessionId); // continue: parent's session copied onto the child before launch
    const child = spawn(process.env.CLAUDE_BIN ?? 'claude', args, {
      cwd,
      detached: true, // own process group so we can kill the whole tree
      env: buildRunEnv(process.env),
    });
    this.children.set(run.id, child);
    this.seqCounters.set(run.id, 0);

    child.stdin?.write(run.prompt);
    child.stdin?.end();

    let stderr = '';
    child.stderr?.on('data', (b: Buffer) => {
      stderr = (stderr + b.toString()).slice(-STDERR_CAP);
    });

    const rl = createInterface({ input: child.stdout! });
    let outcome: RunOutcome | null = null;
    rl.on('line', (line) => {
      const parsed = parseStreamLine(line);
      if (!parsed) {
        void this.bumpSkipped(run.id);
        return;
      }
      if (parsed.type === 'system' && !run.sessionId) {
        const sid = extractSessionId(parsed.payload);
        if (sid) void this.setSessionId(run.id, sid);
      }
      if (parsed.type === 'result') {
        outcome = extractOutcome(parsed.payload);
        if (outcome.resultText) outcome.resultText = this.redactText(outcome.resultText);
      }
      void this.persistEvent(run.id, parsed.type, parsed.payload);
      void this.markRunning(run.id);
    });

    child.on('error', (err) => void this.finalize(run.id, { status: 'FAILED', resultText: err.message }));
    child.on('close', (code) => {
      const timedOut = this.timedOut.delete(run.id);
      const status = timedOut ? 'TIMED_OUT' : outcome?.status ?? (code === 0 ? 'COMPLETED' : 'FAILED');
      const resultText = outcome?.resultText ?? (status === 'COMPLETED' ? '' : this.redactText(stderr.trim()) || `exit ${code}`);
      void this.finalize(run.id, { ...(outcome ?? {}), status, resultText, exitCode: code ?? null });
    });
  }

  private async persistEvent(runId: string, type: string, payload: unknown) {
    const seq = this.seqCounters.get(runId) ?? 0;
    this.seqCounters.set(runId, seq + 1);
    const redacted = redactSensitiveData(payload as Record<string, unknown>);
    const clamped = clampPayload(redacted, RUN_EVENT_MAX_BYTES);
    await this.prisma.runEvent.create({ data: { runId, seq, type, payload: clamped as object } }).catch(() => undefined);
    this.realtime.emitToCampus(SOCKET_EVENTS.runEvent, { runId, seq, type, payload: clamped });
  }

  private async bumpSkipped(runId: string) {
    await this.prisma.campusRun.update({ where: { id: runId }, data: { skippedLines: { increment: 1 } } }).catch(() => undefined);
  }

  private async setSessionId(runId: string, sessionId: string) {
    await this.prisma.campusRun.update({ where: { id: runId }, data: { sessionId } }).catch(() => undefined);
  }

  /** stderr, and the model's own result text, can echo secrets -- redact with the canonical
   * patterns before either becomes resultText (persisted + broadcast). Reuses
   * redactSensitiveData (no second set of regexes to drift). */
  private redactText(s: string): string {
    return redactSensitiveData(s) as string;
  }

  /** STARTING -> RUNNING on first real output; guarded so it fires at most once. */
  private async markRunning(runId: string) {
    const res = await this.prisma.campusRun.updateMany({ where: { id: runId, status: 'STARTING' }, data: { status: 'RUNNING', startedAt: new Date() } });
    if (res.count > 0) {
      const run = await this.prisma.campusRun.findUnique({ where: { id: runId } });
      if (run) this.realtime.emitToCampus(SOCKET_EVENTS.runUpdated, run);
    }
  }

  /** Transition to a terminal status exactly once. A racing exit + result line, or stop +
   * exit, both call this; the status guard makes the second call a no-op. */
  private async finalize(
    runId: string,
    // Omit RunOutcome's own narrower `status` before intersecting -- otherwise the
    // intersection narrows to 'COMPLETED' | 'FAILED' and rejects 'TIMED_OUT'.
    outcome: Omit<Partial<RunOutcome>, 'status'> & { status: CampusRun['status']; resultText?: string | null; exitCode?: number | null },
  ) {
    this.children.delete(runId);
    this.seqCounters.delete(runId);
    const res = await this.prisma.campusRun.updateMany({
      where: { id: runId, status: { in: ['STARTING', 'RUNNING', 'STOPPING'] } },
      data: {
        status: outcome.status,
        resultText: outcome.resultText ?? undefined,
        exitCode: outcome.exitCode ?? undefined,
        durationMs: outcome.durationMs ?? undefined,
        costUsd: outcome.costUsd ?? undefined,
        inputTokens: outcome.inputTokens ?? undefined,
        outputTokens: outcome.outputTokens ?? undefined,
        cacheReadTokens: outcome.cacheReadTokens ?? undefined,
        cacheCreationTokens: outcome.cacheCreationTokens ?? undefined,
        usageJson: (outcome.usageJson ?? undefined) as object | undefined,
        finishedAt: new Date(),
      },
    });
    if (res.count === 0) return; // already finalized
    const run = await this.prisma.campusRun.findUnique({ where: { id: runId } });
    if (run) {
      this.realtime.emitToCampus(SOCKET_EVENTS.runFinished, run);
      this.realtime.emitToCampus(SOCKET_EVENTS.runUpdated, run);
    }
    await this.schedule(); // fill the freed slot (Task 6)
  }

  private isScheduling = false;
  private scheduleAgain = false;

  /** The ONLY place a run is spawned. Serialized in-process; correctness is the guarded
   * QUEUED->STARTING claim, which is a no-op for any row a concurrent pass already took. */
  private async schedule(): Promise<void> {
    if (this.isScheduling) {
      this.scheduleAgain = true;
      return;
    }
    this.isScheduling = true;
    try {
      do {
        this.scheduleAgain = false;
        const claimed = await this.prisma.$transaction(async (tx) => {
          const inFlight = await tx.campusRun.findMany({ where: { status: { in: ['RUNNING', 'STARTING'] } }, select: { projectId: true } });
          const freeSlots = GLOBAL_RUN_LIMIT - inFlight.length;
          if (freeSlots <= 0) return [];
          const queued = await tx.campusRun.findMany({ where: { status: 'QUEUED' }, orderBy: { createdAt: 'asc' }, select: { id: true, projectId: true, createdAt: true } });
          const ids = selectClaimable({ queued, runningProjectIds: new Set(inFlight.map((r) => r.projectId)), freeSlots });
          if (ids.length === 0) return [];
          await tx.campusRun.updateMany({ where: { id: { in: ids }, status: 'QUEUED' }, data: { status: 'STARTING', startedAt: new Date() } });
          return tx.campusRun.findMany({ where: { id: { in: ids }, status: 'STARTING' } });
        });
        for (const run of claimed) {
          const project = await this.prisma.project.findUnique({ where: { id: run.projectId } });
          if (!project) {
            await this.finalize(run.id, { status: 'FAILED', resultText: 'project missing' });
            continue;
          }
          this.realtime.emitToCampus(SOCKET_EVENTS.runUpdated, run);
          this.launch(run, project.rootPath);
        }
      } while (this.scheduleAgain);
    } finally {
      this.isScheduling = false;
    }
  }

  async stop(runId: string): Promise<CampusRun> {
    this.assertLoopback();
    const run = await this.prisma.campusRun.findUnique({ where: { id: runId } });
    if (!run) throw new NotFoundException(`Run ${runId} not found`);
    if (run.status !== 'RUNNING') throw new ConflictException('run is not running');

    const child = this.children.get(runId);
    if (child) child.kill('SIGTERM');
    this.children.delete(runId);
    // If the handle is gone (API restarted since spawn) the process is orphaned; the row
    // is still resolved so the UI never shows a phantom RUNNING run (documented caveat).
    const stopped = await this.prisma.campusRun.update({
      where: { id: runId },
      data: { status: 'STOPPED', finishedAt: new Date() },
    });
    this.realtime.emitToCampus(SOCKET_EVENTS.runFinished, stopped);
    return stopped;
  }

  async listForProject(projectId: string): Promise<CampusRun[]> {
    this.assertLoopback();
    return this.prisma.campusRun.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }
}
