import { BadRequestException, Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { parseIntParam } from '../common/parse-int-param';
import { RunsService } from './runs.service';

const startRunSchema = z.object({
  prompt: z.string().trim().min(1).max(10_000),
  permissionMode: z.enum(['default', 'acceptEdits', 'plan']).optional(),
  model: z.enum(['sonnet', 'opus', 'haiku']).optional(),
});

@Controller()
export class RunsController {
  constructor(private readonly runs: RunsService) {}

  @Post('api/projects/:projectId/runs')
  start(@Param('projectId') projectId: string, @Body() body: unknown) {
    const parsed = startRunSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    const { prompt, ...options } = parsed.data;
    return this.runs.start(projectId, prompt, options);
  }

  @Get('api/projects/:projectId/runs')
  list(@Param('projectId') projectId: string) {
    return this.runs.listForProject(projectId);
  }

  @Post('api/runs/:runId/stop')
  stop(@Param('runId') runId: string) {
    return this.runs.stop(runId);
  }

  @Post('api/runs/:runId/continue')
  continueRun(@Param('runId') runId: string, @Body() body: unknown) {
    const parsed = startRunSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    const { prompt, ...overrides } = parsed.data;
    return this.runs.continue(runId, prompt, overrides);
  }

  @Get('api/runs/:runId/events')
  events(@Param('runId') runId: string, @Query('after') after?: string, @Query('take') take?: string) {
    return this.runs.listEvents(runId, parseIntParam(after, undefined), parseIntParam(take, 200) ?? 200);
  }

  @Get('api/runs/:runId/thread')
  thread(@Param('runId') runId: string) {
    return this.runs.listThread(runId);
  }
}
