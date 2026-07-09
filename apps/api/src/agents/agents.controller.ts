import { Controller, Get, Param } from '@nestjs/common';
import { AgentsService } from './agents.service';

@Controller('api/agents')
export class AgentsController {
  constructor(private readonly agents: AgentsService) {}

  @Get(':agentId')
  getOne(@Param('agentId') agentId: string) {
    return this.agents.getById(agentId);
  }
}
