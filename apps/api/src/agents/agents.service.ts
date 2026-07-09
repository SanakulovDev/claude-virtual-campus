import { Injectable, NotFoundException } from '@nestjs/common';
import { AGENT_TYPES, SOCKET_EVENTS, type AgentType } from '@campus/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

const MAIN_AGENT_EXTERNAL_ID = 'main-claude';

function coerceAgentType(candidate: string | undefined): AgentType {
  if (candidate && (AGENT_TYPES as readonly string[]).includes(candidate)) {
    return candidate as AgentType;
  }
  return candidate ? 'general-purpose' : 'unknown-agent';
}

@Injectable()
export class AgentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
  ) {}

  private async getOrCreateMainAgent(projectId: string, sessionId: string) {
    const existing = await this.prisma.projectAgent.findUnique({
      where: { projectId_externalAgentId: { projectId, externalAgentId: MAIN_AGENT_EXTERNAL_ID } },
    });
    if (existing) {
      return this.prisma.projectAgent.update({
        where: { id: existing.id },
        data: { currentSessionId: sessionId, lastSeenAt: new Date() },
      });
    }
    const created = await this.prisma.projectAgent.create({
      data: {
        projectId,
        externalAgentId: MAIN_AGENT_EXTERNAL_ID,
        agentType: 'main-claude',
        displayName: 'Main Claude',
        currentSessionId: sessionId,
      },
    });
    this.realtime.emitToProject(projectId, SOCKET_EVENTS.agentCreated, created);
    return created;
  }

  /**
   * Resolves which agent produced this event. Claude Code hooks fire process-wide, not
   * per-subagent, so there is no dedicated subagent identifier in the payload -- we
   * infer the active agent from a session-scoped stack: a Task tool PreToolUse pushes a
   * synthetic subagent (using the real subagent_type/description from tool_input when
   * present), and SubagentStop pops back to whichever agent was active before it. This
   * is documented as a known limitation in README/CLAUDE.md.
   */
  async resolveActiveAgent(options: {
    projectId: string;
    sessionId: string;
    isSubagentStart: boolean;
    isSubagentStop: boolean;
    subagentType?: string;
    subagentDescription?: string;
  }) {
    const { projectId, sessionId, isSubagentStart, isSubagentStop, subagentType, subagentDescription } = options;

    if (isSubagentStart) {
      const agentType = coerceAgentType(subagentType);
      const created = await this.prisma.projectAgent.create({
        data: {
          projectId,
          externalAgentId: `${sessionId}:sub:${Date.now()}`,
          agentType,
          displayName: subagentDescription?.slice(0, 80) || subagentType || 'Subagent',
          currentSessionId: sessionId,
          status: 'active',
          currentZoneKey: 'assigned-desk',
        },
      });
      this.realtime.emitToProject(projectId, SOCKET_EVENTS.agentCreated, created);
      return created;
    }

    const activeSubagent = await this.prisma.projectAgent.findFirst({
      where: { projectId, currentSessionId: sessionId, status: 'active', agentType: { not: 'main-claude' } },
      orderBy: { lastSeenAt: 'desc' },
    });

    const agent = activeSubagent ?? (await this.getOrCreateMainAgent(projectId, sessionId));

    if (isSubagentStop && activeSubagent) {
      await this.prisma.projectAgent.update({
        where: { id: activeSubagent.id },
        data: { status: 'idle', activity: 'idle', currentZoneKey: 'assigned-desk' },
      });
    }

    return agent;
  }

  async applyStateChange(agentId: string, patch: {
    activity: string;
    currentZoneKey: string;
    currentTaskTitle?: string | null;
    currentTool?: string | null;
    currentFile?: string | null;
    currentCommandSummary?: string | null;
    commandCategory?: string | null;
  }) {
    const agent = await this.prisma.projectAgent.update({
      where: { id: agentId },
      data: {
        activity: patch.activity,
        currentZoneKey: patch.currentZoneKey,
        status: patch.activity === 'idle' ? 'idle' : 'active',
        lastSeenAt: new Date(),
      },
    });
    this.realtime.emitToProject(agent.projectId, SOCKET_EVENTS.agentStateChanged, { ...agent, ...patch });
    return agent;
  }

  async getById(id: string) {
    const agent = await this.prisma.projectAgent.findUnique({ where: { id } });
    if (!agent) throw new NotFoundException(`Agent ${id} not found`);
    return agent;
  }
}
