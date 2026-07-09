import { Module } from '@nestjs/common';
import { EventsService } from './events.service';
import { EventsController } from './events.controller';
import { ProjectResolverModule } from '../project-resolver/project-resolver.module';
import { ProjectsModule } from '../projects/projects.module';
import { SessionsModule } from '../sessions/sessions.module';
import { AgentsModule } from '../agents/agents.module';
import { TasksModule } from '../tasks/tasks.module';
import { EventNormalizationModule } from '../event-normalization/event-normalization.module';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [
    ProjectResolverModule,
    ProjectsModule,
    SessionsModule,
    AgentsModule,
    TasksModule,
    EventNormalizationModule,
    RealtimeModule,
  ],
  providers: [EventsService],
  controllers: [EventsController],
})
export class EventsModule {}
