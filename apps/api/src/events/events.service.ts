import { Injectable } from '@nestjs/common';
import type { AgentRuntime, RawHookPayload } from '@campus/contracts';
import { SOCKET_EVENTS } from '@campus/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectResolverService } from '../project-resolver/project-resolver.service';
import { ProjectsService } from '../projects/projects.service';
import { SessionsService } from '../sessions/sessions.service';
import { AgentsService } from '../agents/agents.service';
import { TasksService } from '../tasks/tasks.service';
import { EventNormalizationService } from '../event-normalization/event-normalization.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { readTeamConfig } from '../agents/campus-team';

@Injectable()
export class EventsService {
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

  async ingest(raw: RawHookPayload, runtime: AgentRuntime) {
    const resolved = await this.resolver.resolve(raw.cwd);
    const project = await this.projects.upsertFromResolvedProject(resolved);

    const session = await this.sessions.upsert({
      externalSessionId: raw.session_id,
      runtime,
      projectId: project.id,
      projectModuleId: null,
      cwd: raw.cwd,
      branch: resolved.branch,
      worktreePath: resolved.worktreePath,
    });

    const toolInput = (raw.tool_input as Record<string, unknown> | undefined) ?? undefined;
    const isSubagentStart = raw.hook_event_name === 'SubagentStart' ||
      (raw.hook_event_name === 'PreToolUse' && raw.tool_name === 'Task');
    const isSubagentStop = raw.hook_event_name === 'SubagentStop';
    const subagentType = typeof raw.agent_type === 'string'
      ? raw.agent_type
      : typeof toolInput?.subagent_type === 'string'
        ? toolInput.subagent_type
        : undefined;
    const externalSubagentId = typeof raw.agent_id === 'string' ? raw.agent_id : undefined;

    // Optional presentation overrides from the active runtime's campus.json (fail-open).
    const team = readTeamConfig(resolved.rootPath, runtime);

    const agent = await this.agents.resolveActiveAgent({
      projectId: project.id,
      sessionId: session.id,
      runtime,
      isSubagentStart,
      isSubagentStop,
      externalSubagentId,
      subagentType,
      subagentDescription: typeof toolInput?.description === 'string' ? toolInput.description : undefined,
      override: subagentType ? team.overrides.get(subagentType) : undefined,
    });

    const core = this.normalizer.normalize(raw, resolved.rootPath);

    const event = await this.prisma.claudeEvent.create({
      data: {
        projectId: project.id,
        sessionId: session.id,
        agentId: agent.id,
        runtime,
        hookEventName: raw.hook_event_name,
        toolName: core.toolName,
        normalizedType: core.normalizedType,
        payload: core.safeMetadata as object,
        occurredAt: new Date(),
      },
    });
    this.realtime.emitToProject(project.id, SOCKET_EVENTS.eventReceived, {
      ...event,
      occurredAt: event.occurredAt.toISOString(),
      activity: core.activity,
      targetZoneKey: core.targetZoneKey,
      workSummary: core.workSummary,
      filePath: core.filePath,
      fileCategory: core.fileCategory,
      commandSummary: core.commandSummary,
      commandCategory: core.commandCategory,
      safeMetadata: core.safeMetadata,
    });

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
      const externalToolUseId = typeof raw.tool_use_id === 'string' ? raw.tool_use_id : null;
      const execution = await this.prisma.toolExecution.create({
        data: {
          projectId: project.id,
          sessionId: session.id,
          agentId: agent.id,
          toolName: core.toolName,
          externalToolUseId,
          commandCategory: core.commandCategory,
          fileCategory: core.fileCategory,
          safeSummary: core.workSummary,
        },
      });
      this.realtime.emitToProject(project.id, SOCKET_EVENTS.toolStarted, execution);
    }

    if (raw.hook_event_name === 'PostToolUse') {
      const externalToolUseId = typeof raw.tool_use_id === 'string' ? raw.tool_use_id : null;
      const running = await this.prisma.toolExecution.findFirst({
        where: {
          sessionId: session.id,
          agentId: agent.id,
          status: 'RUNNING',
          ...(externalToolUseId ? { externalToolUseId } : core.toolName ? { toolName: core.toolName } : {}),
        },
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
      await this.sessions.end(runtime, raw.session_id);
    } else {
      await this.sessions.touch(session.id);
    }

    return { received: true, eventId: event.id };
  }
}
