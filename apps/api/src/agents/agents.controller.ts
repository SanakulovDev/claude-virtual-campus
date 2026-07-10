import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
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
}
