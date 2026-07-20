import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { parseIntParam } from '../common/parse-int-param';
import { AgentsService } from './agents.service';

@Controller('api/agents')
export class AgentsController {
  constructor(private readonly agents: AgentsService) {}

  @Get(':agentId')
  getOne(@Param('agentId') agentId: string) {
    return this.agents.getById(agentId);
  }

  /** Rename an agent. `{ "name": null }` (or blank) resets it to the generated name. */
  @Patch(':agentId')
  rename(@Param('agentId') agentId: string, @Body('name') name: string | null) {
    return this.agents.rename(agentId, name);
  }

  @Get(':agentId/events')
  events(@Param('agentId') agentId: string, @Query('take') take?: string) {
    return this.agents.listEvents(agentId, parseIntParam(take, 100) ?? 100);
  }
}
