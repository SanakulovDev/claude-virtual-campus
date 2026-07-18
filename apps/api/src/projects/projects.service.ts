import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync, statSync } from 'node:fs';
import path from 'node:path';
import type { ResolvedProject } from '@campus/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { ProjectResolverService } from '../project-resolver/project-resolver.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { SOCKET_EVENTS } from '@campus/contracts';
import { calculateRoomPosition, calculateRoomTemplate } from './room-layout';

const execFileAsync = promisify(execFile);

/** Walk up from here to the monorepo root (where pnpm-workspace.yaml lives), so we can find
 * the installer script and repo-local tsx regardless of dev vs. compiled dist layout. */
function findRepoRoot(): string {
  let dir = __dirname;
  for (let i = 0; i < 8; i += 1) {
    if (existsSync(path.join(dir, 'pnpm-workspace.yaml'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error('could not locate the campus repo root');
}

@Injectable()
export class ProjectsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly resolver: ProjectResolverService,
    private readonly realtime: RealtimeGateway,
  ) {}

  async upsertFromResolvedProject(resolved: ResolvedProject) {
    let existing = await this.prisma.project.findUnique({ where: { projectKey: resolved.projectKey } });

    if (!existing && resolved.projectKey.startsWith('remote:')) {
      // The repo gained a remote after its room was created under a path: key.
      // Upgrade that row in place so the project keeps its one room. Rows whose
      // rootPath predates the anchor fix won't match; `pnpm db:dedupe` covers those.
      const pathTwin = await this.prisma.project.findFirst({
        where: { rootPath: resolved.rootPath, projectKey: { startsWith: 'path:' } },
        orderBy: { createdAt: 'asc' },
      });
      if (pathTwin) {
        existing = await this.prisma.project
          .update({ where: { id: pathTwin.id }, data: { projectKey: resolved.projectKey } })
          .catch((error: unknown) => {
            // P2002: a concurrent event upgraded another twin first -- fall through to upsert.
            if ((error as { code?: string }).code === 'P2002') return null;
            throw error;
          });
      }
    }

    const isNew = !existing;
    const position = calculateRoomPosition(isNew ? await this.prisma.project.count() : 0);
    // Native upsert compiles to INSERT ... ON CONFLICT, so two concurrent first events
    // both land on the same row instead of the loser 500ing on the unique index.
    const project = await this.prisma.project.upsert({
      where: { projectKey: resolved.projectKey },
      update: {
        lastActiveAt: new Date(),
        name: resolved.name,
        remoteUrl: resolved.remoteUrl,
        isGitRepository: resolved.isGitRepository,
      },
      create: {
        projectKey: resolved.projectKey,
        name: resolved.name,
        rootPath: resolved.rootPath,
        remoteUrl: resolved.remoteUrl,
        isGitRepository: resolved.isGitRepository,
        roomPositionX: position.x,
        roomPositionZ: position.z,
      },
    });

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

  /** Connect a project from the UI: run the campus installer on a local path (writes only
   * .claude/). Does NOT create a room -- that still appears on the first real Claude event.
   * execFile with an args array (never a shell string) so a path can't inject a command. */
  async installProject(rawPath: string) {
    if (typeof rawPath !== 'string' || rawPath.trim() === '') {
      throw new BadRequestException('A project path is required.');
    }
    const target = path.resolve(rawPath.trim());
    if (!existsSync(target) || !statSync(target).isDirectory()) {
      throw new BadRequestException(`Not a directory: ${target}`);
    }

    const root = findRepoRoot();
    const tsx = path.join(root, 'node_modules', '.bin', 'tsx');
    const installer = path.join(root, 'packages', 'claude-plugin', 'installer', 'install.ts');
    try {
      await execFileAsync(tsx, [installer, target], { timeout: 20000 });
    } catch (error) {
      throw new BadRequestException(`Installer failed: ${(error as Error).message}`);
    }
    return { installed: true, path: target };
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
