import { Module } from '@nestjs/common';
import { FileClassificationService } from './file-classification.service';

@Module({
  providers: [FileClassificationService],
  exports: [FileClassificationService],
})
export class FileClassificationModule {}
