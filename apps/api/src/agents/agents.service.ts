import { Injectable, NotFoundException } from '@nestjs/common';
import {
  AGENT_TYPES,
  SOCKET_EVENTS,
  mainAgentIdentity,
  pickAgentName,
  profileForAgentType,
  type AgentRuntime,
  type AgentType,
} from '@campus/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

function coerceAgentType(candidate: string | undefined): AgentType {
  if (candidate && (AGENT_TYPES as readonly string[]).includes(candidate)) {
    return candidate as AgentType;
  }
  return candidate ? 'general-purpose' : 'unknown-agent';
}

/** Optional presentation overrides from a project's runtime campus.json (name/role only). */
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

  private async getOrCreateMainAgent(projectId: string, sessionId: string, runtime: AgentRuntime) {
    const identity = mainAgentIdentity(runtime);
    const existing = await this.prisma.projectAgent.findUnique({
      where: { projectId_externalAgentId: { projectId, externalAgentId: identity.externalId } },
    });
    const profile = profileForAgentType(identity.agentType);
    if (existing) {
      return this.prisma.projectAgent.update({
        where: { id: existing.id },
        data: {
          currentSessionId: sessionId,
          runtime,
          lastSeenAt: new Date(),
          displayName: existing.customName ?? identity.name,
          generatedName: existing.generatedName ?? identity.name,
          role: existing.role ?? identity.role,
          bio: existing.bio ?? profile.bio,
        },
      });
    }
    const created = await this.prisma.projectAgent.create({
      data: {
        projectId,
        externalAgentId: identity.externalId,
        runtime,
        agentType: identity.agentType,
        displayName: identity.name,
        generatedName: identity.name,
        role: identity.role,
        bio: profile.bio,
        currentSessionId: sessionId,
      },
    });
    this.realtime.emitToProject(projectId, SOCKET_EVENTS.agentCreated, created);
    return created;
  }

  /**
   * Resolves which agent produced this event. Codex supplies explicit subagent ids on
   * lifecycle hooks. Claude Code is inferred from Task/SubagentStop signals.
   *
   * A subagent's identity is keyed on (session + agentType), so re-running the same kind
   * of subagent -- or reconnecting after a restart -- reuses the same teammate (same name,
   * same desk) instead of spawning a duplicate. This is documented in README/CLAUDE.md.
   */
  async resolveActiveAgent(options: {
    projectId: string;
    sessionId: string;
    runtime: AgentRuntime;
    isSubagentStart: boolean;
    isSubagentStop: boolean;
    externalSubagentId?: string;
    subagentType?: string;
    subagentDescription?: string;
    override?: TeamOverride;
  }) {
    const { projectId, sessionId, runtime, isSubagentStart, isSubagentStop, subagentType, externalSubagentId, override } = options;

    const subagentExternalId = externalSubagentId
      ? `${runtime}:${sessionId}:${externalSubagentId}`
      : runtime === 'claude' && subagentType
        ? `${sessionId}:${coerceAgentType(subagentType)}`
        : `${runtime}:${sessionId}:${coerceAgentType(subagentType)}`;

    if (isSubagentStart) {
      const agentType = coerceAgentType(subagentType);
      const existing = await this.prisma.projectAgent.findUnique({
        where: { projectId_externalAgentId: { projectId, externalAgentId: subagentExternalId } },
      });
      if (existing) {
        // Same subagent kind restarted in this session -- reuse the teammate, don't duplicate.
        return this.prisma.projectAgent.update({
          where: { id: existing.id },
          data: { runtime, status: 'active', currentSessionId: sessionId, currentZoneKey: 'assigned-desk', lastSeenAt: new Date() },
        });
      }
      const profile = profileForAgentType(agentType);
      const generatedName = override?.name ?? pickAgentName(await this.usedGeneratedNames(projectId));
      const created = await this.prisma.projectAgent.create({
        data: {
          projectId,
          externalAgentId: subagentExternalId,
          runtime,
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

    const explicitlyStopped = isSubagentStop && externalSubagentId
      ? await this.prisma.projectAgent.findUnique({
          where: { projectId_externalAgentId: { projectId, externalAgentId: subagentExternalId } },
        })
      : null;

    const activeSubagent = await this.prisma.projectAgent.findFirst({
      where: { projectId, currentSessionId: sessionId, runtime, status: 'active', agentType: { notIn: ['main-claude', 'main-codex'] } },
      orderBy: { lastSeenAt: 'desc' },
    });

    const agent = explicitlyStopped ?? activeSubagent ?? (await this.getOrCreateMainAgent(projectId, sessionId, runtime));

    const stoppedAgent = explicitlyStopped ?? activeSubagent;
    if (isSubagentStop && stoppedAgent) {
      await this.prisma.projectAgent.update({
        where: { id: stoppedAgent.id },
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
        currentTool: patch.currentTool,
        currentFile: patch.currentFile,
        currentCommandSummary: patch.currentCommandSummary,
        commandCategory: patch.commandCategory,
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
