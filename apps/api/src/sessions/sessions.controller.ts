import { Controller, Get, Param } from '@nestjs/common';
import { SessionsService } from './sessions.service';

@Controller('api/sessions')
export class SessionsController {
  constructor(private readonly sessions: SessionsService) {}

  @Get(':sessionId')
  getOne(@Param('sessionId') sessionId: string) {
    return this.sessions.getById(sessionId);
  }
}
