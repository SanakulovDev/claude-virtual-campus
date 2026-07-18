import { Body, Controller, Delete, Get, Param, Post, Query } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { PrismaService } from '../prisma/prisma.service';
import { buildBootstrapSnapshot } from '../realtime/bootstrap';

@Controller()
export class ProjectsController {
  constructor(
    private readonly projects: ProjectsService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('api/campus/bootstrap')
  bootstrap() {
    return buildBootstrapSnapshot(this.prisma);
  }

  @Get('api/projects')
  list() {
    return this.projects.list();
  }

  @Get('api/projects/:projectId')
  getOne(@Param('projectId') projectId: string) {
    return this.projects.getById(projectId);
  }

  @Get('api/projects/:projectId/events')
  getEvents(@Param('projectId') projectId: string, @Query('limit') limit?: string) {
    return this.projects.getEvents(projectId, limit ? Number(limit) : undefined);
  }

  @Get('api/projects/:projectId/technologies')
  getTechnologies(@Param('projectId') projectId: string) {
    return this.projects.getTechnologies(projectId);
  }

  @Get('api/projects/:projectId/modules')
  getModules(@Param('projectId') projectId: string) {
    return this.projects.getModules(projectId);
  }

  @Post('api/projects/:projectId/technologies/refresh')
  refreshTechnologies(@Param('projectId') projectId: string) {
    return this.projects.refreshTechnologies(projectId);
  }

  @Delete('api/projects/:projectId')
  remove(@Param('projectId') projectId: string) {
    return this.projects.remove(projectId);
  }

  @Post('api/projects/install')
  install(@Body('path') targetPath: string) {
    return this.projects.installProject(targetPath);
  }
}
