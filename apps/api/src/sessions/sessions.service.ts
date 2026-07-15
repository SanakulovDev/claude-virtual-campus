import { Injectable, Logger, NotFoundException, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { SOCKET_EVENTS } from '@campus/contracts';
import type { AgentRuntime } from '@campus/contracts';

export interface SessionContextInput {
  externalSessionId: string;
  runtime: AgentRuntime;
  projectId: string;
  projectModuleId: string | null;
  cwd: string;
  branch: string | null;
  worktreePath: string | null;
}

@Injectable()
export class SessionsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SessionsService.name);
  private staleSweepTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
  ) {}

  onModuleInit() {
    this.staleSweepTimer = setInterval(() => {
      void this.markStaleSessionsDisconnected().catch((error: unknown) => {
        this.logger.error('Failed to sweep stale sessions', error instanceof Error ? error.stack : String(error));
      });
    }, 60_000);
    this.staleSweepTimer.unref();
  }

  onModuleDestroy() {
    if (this.staleSweepTimer) clearInterval(this.staleSweepTimer);
  }

  async upsert(input: SessionContextInput) {
    const existing = await this.prisma.claudeSession.findUnique({
      where: { runtime_externalSessionId: { runtime: input.runtime, externalSessionId: input.externalSessionId } },
    });
    const session = existing
      ? await this.prisma.claudeSession.update({
          where: { id: existing.id },
          data: { status: 'ACTIVE', lastEventAt: new Date(), cwd: input.cwd, branch: input.branch },
        })
      : await this.prisma.claudeSession.create({
          data: {
            externalSessionId: input.externalSessionId,
            runtime: input.runtime,
            projectId: input.projectId,
            projectModuleId: input.projectModuleId,
            cwd: input.cwd,
            branch: input.branch,
            worktreePath: input.worktreePath,
          },
        });
    this.realtime.emitToProject(input.projectId, existing ? SOCKET_EVENTS.sessionUpdated : SOCKET_EVENTS.sessionStarted, session);
    return session;
  }

  async touch(sessionId: string) {
    return this.prisma.claudeSession.update({ where: { id: sessionId }, data: { lastEventAt: new Date() } });
  }

  async end(runtime: AgentRuntime, externalSessionId: string) {
    const session = await this.prisma.claudeSession.findUnique({
      where: { runtime_externalSessionId: { runtime, externalSessionId } },
    });
    if (!session) return null;
    const updated = await this.prisma.claudeSession.update({
      where: { id: session.id },
      data: { status: 'ENDED', endedAt: new Date() },
    });
    await this.prisma.projectAgent.updateMany({
      where: { currentSessionId: session.id },
      data: {
        status: 'idle',
        activity: 'idle',
        currentZoneKey: 'entrance',
        currentTool: null,
        currentFile: null,
        currentCommandSummary: null,
        commandCategory: null,
      },
    });
    this.realtime.emitToProject(session.projectId, SOCKET_EVENTS.sessionEnded, updated);
    return updated;
  }

  /** Marks sessions with no recent event as disconnected -- called on API startup (spec section 28). */
  async markStaleSessionsDisconnected(staleAfterMs = 5 * 60 * 1000) {
    const threshold = new Date(Date.now() - staleAfterMs);
    const stale = await this.prisma.claudeSession.findMany({
      where: { status: 'ACTIVE', lastEventAt: { lt: threshold } },
      select: { id: true, projectId: true },
    });
    if (stale.length === 0) return;
    await this.prisma.claudeSession.updateMany({
      where: { id: { in: stale.map((session) => session.id) } },
      data: { status: 'DISCONNECTED' },
    });
    await this.prisma.projectAgent.updateMany({
      where: { currentSessionId: { in: stale.map((session) => session.id) } },
      data: {
        status: 'idle',
        activity: 'idle',
        currentZoneKey: 'entrance',
        currentTool: null,
        currentFile: null,
        currentCommandSummary: null,
        commandCategory: null,
      },
    });
    for (const session of stale) {
      this.realtime.emitToProject(session.projectId, SOCKET_EVENTS.sessionUpdated, {
        id: session.id,
        status: 'DISCONNECTED',
      });
    }
  }

  async getById(id: string) {
    const session = await this.prisma.claudeSession.findUnique({ where: { id } });
    if (!session) throw new NotFoundException(`Session ${id} not found`);
    return session;
  }
}
