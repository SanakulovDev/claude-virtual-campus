import { Injectable, Logger } from '@nestjs/common';
import type { RawHookPayload } from '@campus/contracts';
import { SOCKET_EVENTS } from '@campus/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectResolverService } from '../project-resolver/project-resolver.service';
import { ProjectsService } from '../projects/projects.service';
import { SessionsService } from '../sessions/sessions.service';
import { AgentsService } from '../agents/agents.service';
import { TasksService } from '../tasks/tasks.service';
import { EventNormalizationService } from '../event-normalization/event-normalization.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly resolver: ProjectResolverService,
    private readonly projects: ProjectsService,
    private readonly sessions: SessionsService,
    private readonly agents: AgentsService,
    private readonly tasks: TasksService,
    private readonly normalizer: EventNormalizationService,
    private readonly realtime: RealtimeGateway,
  ) {}

  async ingest(raw: RawHookPayload) {
    const resolved = await this.resolver.resolve(raw.cwd);
    const project = await this.projects.upsertFromResolvedProject(resolved);

    const session = await this.sessions.upsert({
      externalSessionId: raw.session_id,
      projectId: project.id,
      projectModuleId: null,
      cwd: raw.cwd,
      branch: resolved.branch,
      worktreePath: resolved.worktreePath,
    });

    const toolInput = (raw.tool_input as Record<string, unknown> | undefined) ?? undefined;
    const isSubagentStart = raw.hook_event_name === 'PreToolUse' && raw.tool_name === 'Task';
    const isSubagentStop = raw.hook_event_name === 'SubagentStop';

    const agent = await this.agents.resolveActiveAgent({
      projectId: project.id,
      sessionId: session.id,
      isSubagentStart,
      isSubagentStop,
      subagentType: typeof toolInput?.subagent_type === 'string' ? toolInput.subagent_type : undefined,
      subagentDescription: typeof toolInput?.description === 'string' ? toolInput.description : undefined,
    });

    const core = this.normalizer.normalize(raw, resolved.rootPath);

    const event = await this.prisma.claudeEvent.create({
      data: {
        projectId: project.id,
        sessionId: session.id,
        agentId: agent.id,
        hookEventName: raw.hook_event_name,
        toolName: core.toolName,
        normalizedType: core.normalizedType,
        payload: core.safeMetadata as object,
        occurredAt: new Date(),
      },
    });
    this.realtime.emitToProject(project.id, SOCKET_EVENTS.eventReceived, event);

    await this.agents.applyStateChange(agent.id, {
      activity: core.activity,
      currentZoneKey: core.targetZoneKey,
      currentTool: core.toolName,
      currentFile: core.filePath,
      currentCommandSummary: core.commandSummary,
      commandCategory: core.commandCategory,
    });
    await this.projects.recomputeRoomTemplate(project.id);

    if (raw.hook_event_name === 'PreToolUse' && core.toolName) {
      const execution = await this.prisma.toolExecution.create({
        data: {
          projectId: project.id,
          sessionId: session.id,
          agentId: agent.id,
          toolName: core.toolName,
          commandCategory: core.commandCategory,
          fileCategory: core.fileCategory,
          safeSummary: core.workSummary,
        },
      });
      this.realtime.emitToProject(project.id, SOCKET_EVENTS.toolStarted, execution);
    }

    if (raw.hook_event_name === 'PostToolUse') {
      const running = await this.prisma.toolExecution.findFirst({
        where: { sessionId: session.id, agentId: agent.id, status: 'RUNNING' },
        orderBy: { startedAt: 'desc' },
      });
      if (running) {
        const updated = await this.prisma.toolExecution.update({
          where: { id: running.id },
          data: { status: core.isFailure ? 'FAILED' : 'COMPLETED', completedAt: new Date(), safeSummary: core.workSummary },
        });
        this.realtime.emitToProject(project.id, core.isFailure ? SOCKET_EVENTS.toolFailed : SOCKET_EVENTS.toolCompleted, updated);
      }
    }

    if (raw.hook_event_name === 'UserPromptSubmit') {
      await this.tasks.createFromPrompt(project.id, session.id, core.workSummary);
    }
    if (core.isTaskCompletionSignal) {
      await this.tasks.completeLatestForSession(project.id, session.id);
    }
    if (raw.hook_event_name === 'SessionEnd') {
      await this.sessions.end(raw.session_id);
    } else {
      await this.sessions.touch(session.id);
    }

    return { received: true, eventId: event.id };
  }
}
