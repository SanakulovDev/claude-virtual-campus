import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { HealthModule } from './health/health.module';
import { ProjectResolverModule } from './project-resolver/project-resolver.module';
import { ProjectsModule } from './projects/projects.module';
import { SessionsModule } from './sessions/sessions.module';
import { AgentsModule } from './agents/agents.module';
import { TasksModule } from './tasks/tasks.module';
import { EventsModule } from './events/events.module';
import { EventNormalizationModule } from './event-normalization/event-normalization.module';
import { CommandClassificationModule } from './commands/command-classification.module';
import { FileClassificationModule } from './files/file-classification.module';
import { ApprovalsModule } from './approvals/approvals.module';
import { RealtimeModule } from './realtime/realtime.module';

@Module({
  imports: [
    PrismaModule,
    HealthModule,
    ProjectResolverModule,
    ProjectsModule,
    SessionsModule,
    AgentsModule,
    TasksModule,
    EventNormalizationModule,
    CommandClassificationModule,
    FileClassificationModule,
    EventsModule,
    ApprovalsModule,
    RealtimeModule,
  ],
})
export class AppModule {}
