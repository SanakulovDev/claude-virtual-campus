import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { SOCKET_EVENTS } from '@campus/contracts';

export interface SessionContextInput {
  externalSessionId: string;
  projectId: string;
  projectModuleId: string | null;
  cwd: string;
  branch: string | null;
  worktreePath: string | null;
}

@Injectable()
export class SessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
  ) {}

  async upsert(input: SessionContextInput) {
    const existing = await this.prisma.claudeSession.findUnique({ where: { externalSessionId: input.externalSessionId } });
    const session = existing
      ? await this.prisma.claudeSession.update({
          where: { id: existing.id },
          data: { status: 'ACTIVE', lastEventAt: new Date(), cwd: input.cwd, branch: input.branch },
        })
      : await this.prisma.claudeSession.create({
          data: {
            externalSessionId: input.externalSessionId,
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

  async end(externalSessionId: string) {
    const session = await this.prisma.claudeSession.findUnique({ where: { externalSessionId } });
    if (!session) return null;
    const updated = await this.prisma.claudeSession.update({
      where: { id: session.id },
      data: { status: 'ENDED', endedAt: new Date() },
    });
    await this.prisma.projectAgent.updateMany({
      where: { currentSessionId: session.id },
      data: { status: 'idle', activity: 'idle', currentZoneKey: 'entrance' },
    });
    this.realtime.emitToProject(session.projectId, SOCKET_EVENTS.sessionEnded, updated);
    return updated;
  }

  /** Marks sessions with no recent event as disconnected -- called on API startup (spec section 28). */
  async markStaleSessionsDisconnected(staleAfterMs = 5 * 60 * 1000) {
    const threshold = new Date(Date.now() - staleAfterMs);
    await this.prisma.claudeSession.updateMany({
      where: { status: 'ACTIVE', lastEventAt: { lt: threshold } },
      data: { status: 'DISCONNECTED' },
    });
  }

  async getById(id: string) {
    const session = await this.prisma.claudeSession.findUnique({ where: { id } });
    if (!session) throw new NotFoundException(`Session ${id} not found`);
    return session;
  }
}
