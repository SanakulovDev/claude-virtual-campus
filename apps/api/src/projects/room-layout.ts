import type { RoomTemplate } from '@prisma/client';

export function calculateRoomTemplate(agentCount: number): RoomTemplate {
  if (agentCount >= 9) return 'LARGE';
  if (agentCount >= 4) return 'MEDIUM';
  return 'SMALL';
}
