import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  AgentRuntime,
  ApprovalRequestBody,
  ClaudeHookDecisionResponse,
  CodexHookDecisionResponse,
  HookDecisionResponse,
} from '@campus/contracts';
import { SOCKET_EVENTS } from '@campus/contracts';
import { redactSensitiveData } from '@campus/event-normalizer';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectResolverService } from '../project-resolver/project-resolver.service';
import { ProjectsService } from '../projects/projects.service';
import { CommandClassificationService } from '../commands/command-classification.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

const POLL_INTERVAL_MS = 400;

function readTimeoutMs(): number {
  return Number(process.env.APPROVAL_TIMEOUT_MS ?? 30_000);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

@Injectable()
export class ApprovalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly resolver: ProjectResolverService,
    private readonly projects: ProjectsService,
    private readonly commands: CommandClassificationService,
    private readonly realtime: RealtimeGateway,
  ) {}

  /**
   * Handles the blocking PreToolUse approval hook. Non-destructive tool calls are
   * allowed immediately without persistence (nothing was actually gated). Destructive
   * commands are persisted, surfaced to the UI, and block until allow/deny/timeout --
   * timeout always resolves to deny, never to allow (spec section 10).
   */
  async requestApproval(body: ApprovalRequestBody, runtime: AgentRuntime): Promise<HookDecisionResponse | null> {
    const command = typeof body.tool_input?.command === 'string' ? body.tool_input.command : '';
    const classification = body.tool_name === 'Bash' ? this.commands.classify(command) : null;
    const requiresApproval = classification?.isDestructive ?? false;

    if (!requiresApproval) {
      // Empty stdout delegates to the coding agent's normal approval policy. Returning
      // "allow" here would silently bypass unrelated, non-destructive approvals.
      return null;
    }

    const resolved = await this.resolver.resolve(body.cwd);
    const project = await this.projects.upsertFromResolvedProject(resolved);

    const timeoutAt = new Date(Date.now() + readTimeoutMs());
    const request = await this.prisma.approvalRequest.create({
      data: {
        projectId: project.id,
        sessionExternalId: body.session_id,
        runtime,
        toolName: body.tool_name,
        safeSummary: command
          ? `Run: ${String(redactSensitiveData(command)).slice(0, 200)}`
          : `Use ${body.tool_name}`,
        commandCategory: classification?.category ?? null,
        timeoutAt,
      },
    });
    this.realtime.emitToProject(project.id, SOCKET_EVENTS.approvalRequested, request);

    const deadline = timeoutAt.getTime();
    while (Date.now() < deadline) {
      await sleep(POLL_INTERVAL_MS);
      const current = await this.prisma.approvalRequest.findUnique({ where: { id: request.id } });
      if (current && current.status !== 'PENDING') {
        return current.status === 'ALLOWED' ? allowDecision(runtime) : denyDecision(runtime, 'Denied by user');
      }
    }

    const timedOut = await this.prisma.approvalRequest.updateMany({
      where: { id: request.id, status: 'PENDING' },
      data: { status: 'TIMED_OUT', resolvedAt: new Date() },
    });
    if (timedOut.count === 0) {
      const resolved = await this.prisma.approvalRequest.findUnique({ where: { id: request.id } });
      return resolved?.status === 'ALLOWED'
        ? allowDecision(runtime)
        : denyDecision(runtime, 'Denied by user');
    }
    this.realtime.emitToProject(project.id, SOCKET_EVENTS.approvalResolved, { id: request.id, status: 'TIMED_OUT' });
    return denyDecision(runtime, 'Approval timed out');
  }

  async resolve(approvalId: string, decision: 'ALLOWED' | 'DENIED') {
    const existing = await this.prisma.approvalRequest.findUnique({ where: { id: approvalId } });
    if (!existing) throw new NotFoundException(`Approval request ${approvalId} not found`);
    if (existing.status !== 'PENDING') return existing;
    const result = await this.prisma.approvalRequest.updateMany({
      where: { id: approvalId, status: 'PENDING' },
      data: { status: decision, resolvedAt: new Date() },
    });
    const updated = await this.prisma.approvalRequest.findUnique({ where: { id: approvalId } });
    if (!updated) throw new NotFoundException(`Approval request ${approvalId} not found`);
    if (result.count > 0) this.realtime.emitToProject(updated.projectId, SOCKET_EVENTS.approvalResolved, updated);
    return updated;
  }
}

function allowDecision(runtime: AgentRuntime): HookDecisionResponse {
  if (runtime === 'codex') {
    const response: CodexHookDecisionResponse = {
      hookSpecificOutput: { hookEventName: 'PermissionRequest', decision: { behavior: 'allow' } },
    };
    return response;
  }
  const response: ClaudeHookDecisionResponse = {
    hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'allow' },
  };
  return response;
}

function denyDecision(runtime: AgentRuntime, reason: string): HookDecisionResponse {
  if (runtime === 'codex') {
    const response: CodexHookDecisionResponse = {
      hookSpecificOutput: { hookEventName: 'PermissionRequest', decision: { behavior: 'deny', message: reason } },
    };
    return response;
  }
  const response: ClaudeHookDecisionResponse = {
    hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason },
  };
  return response;
}
