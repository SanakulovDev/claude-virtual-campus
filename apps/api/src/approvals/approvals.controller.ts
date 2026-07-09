import { BadRequestException, Body, Controller, Param, Post } from '@nestjs/common';
import { approvalRequestBodySchema } from '@campus/contracts';
import { ApprovalsService } from './approvals.service';

@Controller()
export class ApprovalsController {
  constructor(private readonly approvals: ApprovalsService) {}

  @Post('api/claude/approval')
  async requestApproval(@Body() body: unknown) {
    const parsed = approvalRequestBodySchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.approvals.requestApproval(parsed.data);
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
