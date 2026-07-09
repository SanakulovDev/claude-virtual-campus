import { Injectable } from '@nestjs/common';
import { classifyFile, type FileClassification } from '@campus/event-normalizer';

@Injectable()
export class FileClassificationService {
  classify(filePath: string, rootPath: string): FileClassification {
    return classifyFile(filePath, rootPath);
  }
}
