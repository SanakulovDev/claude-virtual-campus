import type { PrismaService } from '../prisma/prisma.service';

const RECENT_EVENTS_LIMIT = 50;

/**
 * Builds the snapshot sent to a freshly (re)connected client: all projects, their
 * modules/technologies/agents/sessions, and a bounded slice of recent events. Persists
 * nothing -- pure read, per spec section 28 (load recent events only on reconnect).
 */
export async function buildBootstrapSnapshot(prisma: PrismaService) {
  const [projects, recentEvents] = await Promise.all([
    prisma.project.findMany({
      include: {
        modules: true,
        technologies: true,
        agents: true,
        sessions: { where: { status: 'ACTIVE' } },
        tasks: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
      orderBy: { lastActiveAt: 'desc' },
    }),
    prisma.claudeEvent.findMany({
      orderBy: { receivedAt: 'desc' },
      take: RECENT_EVENTS_LIMIT,
    }),
  ]);

  return { projects, recentEvents };
}
