import { Injectable } from '@nestjs/common';
import { normalizeHookEvent, type NormalizedEventCore } from '@campus/event-normalizer';
import type { RawHookPayload } from '@campus/contracts';

@Injectable()
export class EventNormalizationService {
  normalize(raw: RawHookPayload, rootPath: string): NormalizedEventCore {
    return normalizeHookEvent(raw, rootPath);
  }
}
