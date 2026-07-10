import { Injectable, NotFoundException } from '@nestjs/common';
import {
  AGENT_TYPES,
  MAIN_CLAUDE_NAME,
  MAIN_CLAUDE_ROLE,
  SOCKET_EVENTS,
  pickAgentName,
  profileForAgentType,
  type AgentType,
} from '@campus/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

const MAIN_AGENT_EXTERNAL_ID = 'main-claude';

function coerceAgentType(candidate: string | undefined): AgentType {
  if (candidate && (AGENT_TYPES as readonly string[]).includes(candidate)) {
    return candidate as AgentType;
  }
  return candidate ? 'general-purpose' : 'unknown-agent';
}

/** Optional presentation overrides from a project's .claude/campus.json (name/role only). */
export interface TeamOverride {
  name?: string;
  role?: string;
}

@Injectable()
export class AgentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
  ) {}

  /** Generated names already taken in this project, so a new agent never duplicates one. */
  private async usedGeneratedNames(projectId: string): Promise<string[]> {
    const rows = await this.prisma.projectAgent.findMany({
      where: { projectId },
      select: { generatedName: true },
    });
    return rows.map((r) => r.generatedName).filter((n): n is string => Boolean(n));
  }

  private async getOrCreateMainAgent(projectId: string, sessionId: string) {
    const existing = await this.prisma.projectAgent.findUnique({
      where: { projectId_externalAgentId: { projectId, externalAgentId: MAIN_AGENT_EXTERNAL_ID } },
    });
    const profile = profileForAgentType('main-claude');
    if (existing) {
      return this.prisma.projectAgent.update({
        where: { id: existing.id },
        data: {
          currentSessionId: sessionId,
          lastSeenAt: new Date(),
          // keep Team Lead identity current (also migrates older "Main Claude" rows)
          displayName: existing.customName ?? MAIN_CLAUDE_NAME,
          generatedName: existing.generatedName ?? MAIN_CLAUDE_NAME,
          role: existing.role ?? MAIN_CLAUDE_ROLE,
          bio: existing.bio ?? profile.bio,
        },
      });
    }
    const created = await this.prisma.projectAgent.create({
      data: {
        projectId,
        externalAgentId: MAIN_AGENT_EXTERNAL_ID,
        agentType: 'main-claude',
        displayName: MAIN_CLAUDE_NAME,
        generatedName: MAIN_CLAUDE_NAME,
        role: MAIN_CLAUDE_ROLE,
        bio: profile.bio,
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
   * subagent, and SubagentStop pops back to whichever agent was active before it.
   *
   * A subagent's identity is keyed on (session + agentType), so re-running the same kind
   * of subagent -- or reconnecting after a restart -- reuses the same teammate (same name,
   * same desk) instead of spawning a duplicate. This is documented in README/CLAUDE.md.
   */
  async resolveActiveAgent(options: {
    projectId: string;
    sessionId: string;
    isSubagentStart: boolean;
    isSubagentStop: boolean;
    subagentType?: string;
    subagentDescription?: string;
    override?: TeamOverride;
  }) {
    const { projectId, sessionId, isSubagentStart, isSubagentStop, subagentType, override } = options;

    if (isSubagentStart) {
      const agentType = coerceAgentType(subagentType);
      const externalAgentId = `${sessionId}:${agentType}`;
      const existing = await this.prisma.projectAgent.findUnique({
        where: { projectId_externalAgentId: { projectId, externalAgentId } },
      });
      if (existing) {
        // Same subagent kind restarted in this session -- reuse the teammate, don't duplicate.
        return this.prisma.projectAgent.update({
          where: { id: existing.id },
          data: { status: 'active', currentSessionId: sessionId, currentZoneKey: 'assigned-desk', lastSeenAt: new Date() },
        });
      }
      const profile = profileForAgentType(agentType);
      const generatedName = override?.name ?? pickAgentName(await this.usedGeneratedNames(projectId));
      const created = await this.prisma.projectAgent.create({
        data: {
          projectId,
          externalAgentId,
          agentType,
          generatedName,
          displayName: generatedName,
          role: override?.role ?? profile.role,
          bio: profile.bio,
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
        data: { status: 'idle', activity: 'idle', activitySource: 'real-work', currentZoneKey: 'assigned-desk' },
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
        // any real event resets the source to real work -- ambient life is client-side only
        activitySource: 'real-work',
        lastSeenAt: new Date(),
      },
    });
    this.realtime.emitToProject(agent.projectId, SOCKET_EVENTS.agentStateChanged, { ...agent, ...patch });
    return agent;
  }

  /** Rename an agent. A null/blank name resets it back to its generated name. */
  async rename(agentId: string, name: string | null | undefined) {
    const existing = await this.getById(agentId);
    const trimmed = name?.trim();
    const customName = trimmed ? trimmed : null;
    const fallback = existing.generatedName ?? existing.displayName;
    const agent = await this.prisma.projectAgent.update({
      where: { id: agentId },
      data: { customName, displayName: customName ?? fallback },
    });
    this.realtime.emitToProject(agent.projectId, SOCKET_EVENTS.agentStateChanged, agent);
    return agent;
  }

  async getById(id: string) {
    const agent = await this.prisma.projectAgent.findUnique({ where: { id } });
    if (!agent) throw new NotFoundException(`Agent ${id} not found`);
    return agent;
  }
}
