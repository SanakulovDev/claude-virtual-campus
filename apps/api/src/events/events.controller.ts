import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { rawHookPayloadSchema } from '@campus/contracts';
import { EventsService } from './events.service';

@Controller('api/claude')
export class EventsController {
  constructor(private readonly events: EventsService) {}

  @Post('events')
  async receive(@Body() body: unknown) {
    const parsed = rawHookPayloadSchema.safeParse(body);
    if (!parsed.success) {
      // Fail-open contract lives in the hook script itself (always exits 0); a 400 here
      // just means the payload was malformed, it must never crash the caller's shell.
      throw new BadRequestException(parsed.error.flatten());
    }
    return this.events.ingest(parsed.data);
  }
}
