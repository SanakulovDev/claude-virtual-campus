import { Module } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { RealtimeModule } from '../realtime/realtime.module';

@Module({
  imports: [RealtimeModule],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}
