import { Module } from '@nestjs/common';
import { ApprovalsService } from './approvals.service';
import { ApprovalsController } from './approvals.controller';
import { ProjectResolverModule } from '../project-resolver/project-resolver.module';
import { ProjectsModule } from '../projects/projects.module';
import { CommandClassificationModule } from '../commands/command-classification.module';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [ProjectResolverModule, ProjectsModule, CommandClassificationModule, RealtimeModule],
  providers: [ApprovalsService],
  controllers: [ApprovalsController],
})
export class ApprovalsModule {}
