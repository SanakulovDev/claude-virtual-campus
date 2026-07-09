import { Module } from '@nestjs/common';
import { CommandClassificationService } from './command-classification.service';

@Module({
  providers: [CommandClassificationService],
  exports: [CommandClassificationService],
})
export class CommandClassificationModule {}
