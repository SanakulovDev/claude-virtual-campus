import { Injectable, NotFoundException } from '@nestjs/common';
import type { ResolvedProject } from '@campus/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectResolverService } from '../project-resolver/project-resolver.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { SOCKET_EVENTS } from '@campus/contracts';
import { calculateRoomPosition, calculateRoomTemplate } from './room-layout';

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly resolver: ProjectResolverService,
    private readonly realtime: RealtimeGateway,
  ) {}

  async upsertFromResolvedProject(resolved: ResolvedProject) {
    const existing = await this.prisma.project.findUnique({ where: { projectKey: resolved.projectKey } });

    let project;
    let isNew = false;
    if (existing) {
      project = await this.prisma.project.update({
        where: { id: existing.id },
        data: { lastActiveAt: new Date(), name: resolved.name, remoteUrl: resolved.remoteUrl, isGitRepository: resolved.isGitRepository },
      });
    } else {
      isNew = true;
      const count = await this.prisma.project.count();
      const position = calculateRoomPosition(count);
      project = await this.prisma.project.create({
        data: {
          projectKey: resolved.projectKey,
          name: resolved.name,
          rootPath: resolved.rootPath,
          remoteUrl: resolved.remoteUrl,
          isGitRepository: resolved.isGitRepository,
          roomPositionX: position.x,
          roomPositionZ: position.z,
        },
      });
    }

    if (resolved.technologyProfile) {
      await this.syncTechnologies(project.id, resolved.technologyProfile);
      this.realtime.emitToProject(project.id, SOCKET_EVENTS.projectTechnologyDetected, {
        projectId: project.id,
        technologyProfile: resolved.technologyProfile,
      });
    }

    const modules = await this.resolver.detectModules(project.id, resolved.rootPath);
    for (const mod of modules) {
      await this.prisma.projectModule.upsert({
        where: { projectId_relativePath: { projectId: project.id, relativePath: mod.relativePath } },
        create: {
          projectId: project.id,
          name: mod.name,
          relativePath: mod.relativePath,
          primaryLanguage: mod.technologyProfile.primaryLanguage,
          technologyProfile: mod.technologyProfile as unknown as object,
        },
        update: {
          primaryLanguage: mod.technologyProfile.primaryLanguage,
          technologyProfile: mod.technologyProfile as unknown as object,
        },
      });
    }
    if (modules.length > 0) {
      this.realtime.emitToProject(project.id, SOCKET_EVENTS.projectModuleDetected, { projectId: project.id, modules });
    }

    this.realtime.emitToCampus(isNew ? SOCKET_EVENTS.projectCreated : SOCKET_EVENTS.projectUpdated, project);
    this.realtime.emitToCampus(SOCKET_EVENTS.eventReceived, { type: isNew ? 'project_created' : 'project_updated', projectId: project.id });

    return project;
  }

  private async syncTechnologies(projectId: string, profile: NonNullable<ResolvedProject['technologyProfile']>) {
    const all = [
      ...profile.languages,
      ...profile.frameworks,
      ...profile.packageManagers,
      ...profile.buildTools,
      ...profile.testTools,
      ...profile.infrastructureTools,
    ];
    for (const tech of all) {
      await this.prisma.projectTechnology.upsert({
        where: { projectId_techId: { projectId, techId: tech.id } },
        create: { projectId, techId: tech.id, displayName: tech.displayName, category: tech.category, confidence: tech.confidence, evidence: tech.evidence },
        update: { confidence: tech.confidence, evidence: tech.evidence },
      });
    }
  }

  async recomputeRoomTemplate(projectId: string) {
    const agentCount = await this.prisma.projectAgent.count({ where: { projectId } });
    await this.prisma.project.update({ where: { id: projectId }, data: { roomTemplate: calculateRoomTemplate(agentCount) } });
  }

  list() {
    return this.prisma.project.findMany({
      include: { technologies: true, modules: true, agents: true },
      orderBy: { lastActiveAt: 'desc' },
    });
  }

  async getById(id: string) {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: { technologies: true, modules: true, agents: true, sessions: true, tasks: true },
    });
    if (!project) throw new NotFoundException(`Project ${id} not found`);
    return project;
  }

  /** Removes a room the user no longer wants to watch. Sessions/agents/events/tasks cascade
   * from Project. A still-live project simply reappears on its next hook event. */
  async remove(id: string) {
    const existing = await this.prisma.project.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Project ${id} not found`);
    await this.prisma.project.delete({ where: { id } });
    this.realtime.emitToCampus(SOCKET_EVENTS.projectRemoved, { projectId: id });
    return { removed: id };
  }

  async getEvents(projectId: string, limit = 100) {
    await this.getById(projectId);
    return this.prisma.claudeEvent.findMany({
      where: { projectId },
      orderBy: { receivedAt: 'desc' },
      take: Math.min(limit, 500),
    });
  }

  async getTechnologies(projectId: string) {
    await this.getById(projectId);
    return this.prisma.projectTechnology.findMany({ where: { projectId } });
  }

  async getModules(projectId: string) {
    await this.getById(projectId);
    return this.prisma.projectModule.findMany({ where: { projectId } });
  }

  async refreshTechnologies(projectId: string) {
    const project = await this.getById(projectId);
    const profile = await this.resolver.resolve(project.rootPath);
    if (profile.technologyProfile) {
      await this.syncTechnologies(projectId, profile.technologyProfile);
    }
    return this.getTechnologies(projectId);
  }
}
