import { Injectable, NotFoundException } from '@nestjs/common';
import type { ApprovalRequestBody, HookDecisionResponse } from '@campus/contracts';
import { SOCKET_EVENTS } from '@campus/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectResolverService } from '../project-resolver/project-resolver.service';
import { ProjectsService } from '../projects/projects.service';
import { CommandClassificationService } from '../commands/command-classification.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

const DEFAULT_TIMEOUT_MS = Number(process.env.APPROVAL_TIMEOUT_MS ?? 30_000);
const POLL_INTERVAL_MS = 400;

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
  async requestApproval(body: ApprovalRequestBody): Promise<HookDecisionResponse> {
    const command = typeof body.tool_input?.command === 'string' ? body.tool_input.command : '';
    const classification = body.tool_name === 'Bash' ? this.commands.classify(command) : null;
    const requiresApproval = classification?.isDestructive ?? false;

    if (!requiresApproval) {
      return allowDecision();
    }

    const resolved = await this.resolver.resolve(body.cwd);
    const project = await this.projects.upsertFromResolvedProject(resolved);

    const timeoutAt = new Date(Date.now() + DEFAULT_TIMEOUT_MS);
    const request = await this.prisma.approvalRequest.create({
      data: {
        projectId: project.id,
        sessionExternalId: body.session_id,
        toolName: body.tool_name,
        safeSummary: command ? `Run: ${command.slice(0, 200)}` : `Use ${body.tool_name}`,
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
        return current.status === 'ALLOWED' ? allowDecision() : denyDecision('Denied by user');
      }
    }

    await this.prisma.approvalRequest.update({ where: { id: request.id }, data: { status: 'TIMED_OUT', resolvedAt: new Date() } });
    this.realtime.emitToProject(project.id, SOCKET_EVENTS.approvalResolved, { id: request.id, status: 'TIMED_OUT' });
    return denyDecision('Approval timed out');
  }

  async resolve(approvalId: string, decision: 'ALLOWED' | 'DENIED') {
    const existing = await this.prisma.approvalRequest.findUnique({ where: { id: approvalId } });
    if (!existing) throw new NotFoundException(`Approval request ${approvalId} not found`);
    if (existing.status !== 'PENDING') return existing;
    const updated = await this.prisma.approvalRequest.update({
      where: { id: approvalId },
      data: { status: decision, resolvedAt: new Date() },
    });
    this.realtime.emitToProject(updated.projectId, SOCKET_EVENTS.approvalResolved, updated);
    return updated;
  }
}

function allowDecision(): HookDecisionResponse {
  return { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'allow' } };
}

function denyDecision(reason: string): HookDecisionResponse {
  return { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason } };
}
