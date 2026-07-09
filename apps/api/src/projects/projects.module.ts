import { Module } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { ProjectResolverModule } from '../project-resolver/project-resolver.module';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [ProjectResolverModule, RealtimeModule],
  providers: [ProjectsService],
  controllers: [ProjectsController],
  exports: [ProjectsService],
})
export class ProjectsModule {}
