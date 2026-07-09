import { Module } from '@nestjs/common';
import { EventNormalizationService } from './event-normalization.service';

@Module({
  providers: [EventNormalizationService],
  exports: [EventNormalizationService],
})
export class EventNormalizationModule {}
