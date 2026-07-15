import { BadRequestException, Body, Controller, Headers, Post, UnauthorizedException } from '@nestjs/common';
import { rawHookPayloadSchema } from '@campus/contracts';
import { EventsService } from './events.service';

@Controller('api')
export class EventsController {
  constructor(private readonly events: EventsService) {}

  private async receive(body: unknown, runtime: 'claude' | 'codex', token?: string) {
    const expectedToken = process.env.HOOK_SHARED_SECRET;
    if (expectedToken && token !== expectedToken) throw new UnauthorizedException('Invalid campus hook token');
    const parsed = rawHookPayloadSchema.safeParse(body);
    if (!parsed.success) {
      // Fail-open contract lives in the hook script itself (always exits 0); a 400 here
      // just means the payload was malformed, it must never crash the caller's shell.
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.events.ingest(parsed.data, runtime);
  }

  @Post('claude/events')
  receiveClaude(@Body() body: unknown, @Headers('x-campus-token') token?: string) {
    return this.receive(body, 'claude', token);
  }

  @Post('codex/events')
  receiveCodex(@Body() body: unknown, @Headers('x-campus-token') token?: string) {
    return this.receive(body, 'codex', token);
  }
}
