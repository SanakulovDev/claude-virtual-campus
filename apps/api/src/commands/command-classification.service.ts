import { Injectable } from '@nestjs/common';
import { classifyCommand, type CommandClassification } from '@campus/event-normalizer';

@Injectable()
export class CommandClassificationService {
  classify(rawCommand: string): CommandClassification {
    return classifyCommand(rawCommand);
  }
}
