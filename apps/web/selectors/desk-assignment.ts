import type { AgentRow } from '../lib/types';

/**
 * Stable ordering of a room's agents so desk assignment never shifts: main Claude first,
 * then the rest by id. Returns each agent with its assigned desk index.
 */
export function assignDesks(agents: AgentRow[]): Array<{ agent: AgentRow; deskIndex: number }> {
  const ordered = [...agents].sort((a, b) => {
    const aMain = a.externalAgentId === 'main-claude' ? 0 : 1;
    const bMain = b.externalAgentId === 'main-claude' ? 0 : 1;
    if (aMain !== bMain) return aMain - bMain;
    return a.id.localeCompare(b.id);
  });
  return ordered.map((agent, deskIndex) => ({ agent, deskIndex }));
}
