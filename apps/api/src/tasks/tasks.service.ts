import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { SOCKET_EVENTS } from '@campus/contracts';

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
  ) {}

  async createFromPrompt(projectId: string, sessionId: string, title: string) {
    const task = await this.prisma.task.create({
      data: { projectId, sessionId, title: title.slice(0, 200), status: 'IN_PROGRESS' },
    });
    this.realtime.emitToProject(projectId, SOCKET_EVENTS.taskCreated, task);
    return task;
  }

  async completeLatestForSession(projectId: string, sessionId: string) {
    const task = await this.prisma.task.findFirst({
      where: { sessionId, status: { in: ['PENDING', 'IN_PROGRESS'] } },
      orderBy: { createdAt: 'desc' },
    });
    if (!task) return null;
    const updated = await this.prisma.task.update({
      where: { id: task.id },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });
    this.realtime.emitToProject(projectId, SOCKET_EVENTS.taskUpdated, updated);
    return updated;
  }
}
