import { BadRequestException, Body, Controller, Headers, Param, Post, Res, UnauthorizedException } from '@nestjs/common';
import type { Response } from 'express';
import { approvalRequestBodySchema } from '@campus/contracts';
import { ApprovalsService } from './approvals.service';

@Controller()
export class ApprovalsController {
  constructor(private readonly approvals: ApprovalsService) {}

  private async requestApproval(body: unknown, runtime: 'claude' | 'codex', response: Response, token?: string) {
    const expectedToken = process.env.HOOK_SHARED_SECRET;
    if (expectedToken && token !== expectedToken) throw new UnauthorizedException('Invalid campus hook token');
    const parsed = approvalRequestBodySchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    const decision = await this.approvals.requestApproval(parsed.data, runtime);
    if (!decision) {
      response.status(204);
      return;
    }
    return decision;
  }

  @Post('api/claude/approval')
  requestClaudeApproval(@Body() body: unknown, @Res({ passthrough: true }) response: Response, @Headers('x-campus-token') token?: string) {
    return this.requestApproval(body, 'claude', response, token);
  }

  @Post('api/codex/approval')
  requestCodexApproval(@Body() body: unknown, @Res({ passthrough: true }) response: Response, @Headers('x-campus-token') token?: string) {
    return this.requestApproval(body, 'codex', response, token);
  }

  @Post('api/approvals/:approvalId/allow')
  allow(@Param('approvalId') approvalId: string) {
    return this.approvals.resolve(approvalId, 'ALLOWED');
  }

  @Post('api/approvals/:approvalId/deny')
  deny(@Param('approvalId') approvalId: string) {
    return this.approvals.resolve(approvalId, 'DENIED');
  }
}
