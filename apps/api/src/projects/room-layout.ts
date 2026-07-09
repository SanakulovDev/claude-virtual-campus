import type { RoomTemplate } from '@prisma/client';

export { calculateRoomPosition } from '@campus/contracts';

export function calculateRoomTemplate(agentCount: number): RoomTemplate {
  if (agentCount >= 9) return 'LARGE';
  if (agentCount >= 4) return 'MEDIUM';
  return 'SMALL';
}
