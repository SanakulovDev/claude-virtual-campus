import { ConflictException, ForbiddenException, HttpException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { execFile, type ChildProcess } from 'node:child_process';
import type { CampusRun } from '@prisma/client';
import { SOCKET_EVENTS } from '@campus/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { isLoopbackHost, resolveApiHost } from '../config/api-host';

const RUN_TIMEOUT_MS = 30 * 60 * 1000;
const MAX_BUFFER = 10 * 1024 * 1024;
const GLOBAL_RUN_LIMIT = 3;

@Injectable()
export class RunsService implements OnModuleInit {
  /** Live child handles; entries vanish on API restart (stop() then only flips the row). */
  private readonly children = new Map<string, ChildProcess>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
  ) {}

  /** Runs interrupted by an API restart can never finish -- mark them honestly. */
  async onModuleInit() {
    await this.prisma.campusRun.updateMany({
      where: { status: 'RUNNING' },
      data: { status: 'FAILED', resultText: 'API restarted', finishedAt: new Date() },
    });
  }

  async start(projectId: string, prompt: string): Promise<CampusRun> {
    if (!isLoopbackHost(resolveApiHost())) {
      throw new ForbiddenException('runs are disabled on non-loopback binds');
    }
    const project = await this.prisma.project.findUnique({ where: { id: projectId } });
    if (!project) throw new NotFoundException(`Project ${projectId} not found`);

    const busy = await this.prisma.campusRun.count({ where: { projectId, status: 'RUNNING' } });
    if (busy > 0) throw new ConflictException('a run is already active for this project');

    const globalBusy = await this.prisma.campusRun.count({ where: { status: 'RUNNING' } });
    if (globalBusy >= GLOBAL_RUN_LIMIT) throw new HttpException('run limit reached', 429);

    const run = await this.prisma.campusRun.create({ data: { projectId, prompt } });
    this.spawn(run, project.rootPath);
    this.realtime.emitToCampus(SOCKET_EVENTS.runStarted, run);
    return run;
  }

  /** execFile with an args array: the prompt is data, never shell input. */
  private spawn(run: CampusRun, cwd: string) {
    const child = execFile(
      process.env.CLAUDE_BIN ?? 'claude',
      ['-p', run.prompt, '--output-format', 'text'],
      { cwd, timeout: RUN_TIMEOUT_MS, maxBuffer: MAX_BUFFER },
      (error, stdout, stderr) => {
        void this.finalize(run.id, error, stdout, stderr);
      },
    );
    this.children.set(run.id, child);
  }

  private async finalize(runId: string, error: unknown, stdout: string, stderr: string) {
    this.children.delete(runId);
    const current = await this.prisma.campusRun.findUnique({ where: { id: runId } });
    if (!current || current.status !== 'RUNNING') return; // stop() already resolved it

    const failure = error as { code?: number | string; killed?: boolean } | null;
    const timedOut = failure?.killed === true;
    const exitCode = typeof failure?.code === 'number' ? failure.code : failure ? null : 0;
    const status = failure ? 'FAILED' : 'COMPLETED';
    const resultText = failure
      ? timedOut
        ? 'timed out after 30m'
        : (stderr.trim().slice(-2000) || String((failure as Error).message ?? 'run failed'))
      : stdout.trim();

    const run = await this.prisma.campusRun.update({
      where: { id: runId },
      data: { status, resultText, exitCode, finishedAt: new Date() },
    });
    this.realtime.emitToCampus(SOCKET_EVENTS.runFinished, run);
  }

  async stop(runId: string): Promise<CampusRun> {
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
    return this.prisma.campusRun.findMany({
      where: { projectId },
      orderBy: { startedAt: 'desc' },
      take: 20,
    });
  }
}
