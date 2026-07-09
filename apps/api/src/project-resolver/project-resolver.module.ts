import { Module } from '@nestjs/common';
import { ProjectResolverService } from './project-resolver.service';

@Module({
  providers: [ProjectResolverService],
  exports: [ProjectResolverService],
})
export class ProjectResolverModule {}
