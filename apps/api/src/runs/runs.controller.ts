import { BadRequestException, Body, Controller, Get, Param, Post } from '@nestjs/common';
import { z } from 'zod';
import { RunsService } from './runs.service';

const startRunSchema = z.object({ prompt: z.string().trim().min(1).max(10_000) });

@Controller()
export class RunsController {
  constructor(private readonly runs: RunsService) {}

  @Post('api/projects/:projectId/runs')
  start(@Param('projectId') projectId: string, @Body() body: unknown) {
    const parsed = startRunSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.issues);
    return this.runs.start(projectId, parsed.data.prompt);
  }

  @Get('api/projects/:projectId/runs')
  list(@Param('projectId') projectId: string) {
    return this.runs.listForProject(projectId);
  }

  @Post('api/runs/:runId/stop')
  stop(@Param('runId') runId: string) {
    return this.runs.stop(runId);
  }
}
