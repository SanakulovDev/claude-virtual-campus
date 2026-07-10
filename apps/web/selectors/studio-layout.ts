import type { AgentRow } from '../lib/types';
import type { StudioLocationKey } from './visual-state.selector';

/**
 * Studio-local coordinates (studio faces +Z). Back status wall at -Z, open review side at
 * +Z. Everything an agent does resolves to one of these anchors -- there are no separate
 * research/terminal/database/etc. stations in the world any more.
 */
export const STUDIO_ANCHORS = {
  statusWall: [0, 0, -6.5] as [number, number, number],
  sign: [0, 3.4, -6.4] as [number, number, number],
  planningTable: [0, 0, -2.4] as [number, number, number],
  reviewScreen: [0, 0, 5.6] as [number, number, number],
};

export const STUDIO_HALF_WIDTH = 8;
export const STUDIO_HALF_DEPTH = 7.5;

const DESK_ROW_Z = 1.4;
const DESK_SPACING_X = 3.2;
const DESK_ROW_DEPTH = 3.0;

/**
 * Deterministic desk position for the nth agent in a studio. Desks fan out in rows of up
 * to 3; each agent keeps the same desk across renders so nobody teleports between seats.
 */
export function deskPosition(deskIndex: number): [number, number, number] {
  const perRow = 3;
  const row = Math.floor(deskIndex / perRow);
  const col = deskIndex % perRow;
  const rowCount = row + 1;
  const x = (col - (perRow - 1) / 2) * DESK_SPACING_X;
  const z = DESK_ROW_Z + row * DESK_ROW_DEPTH;
  // Nudge later rows toward the wall so they stay inside the platform.
  return [x, 0, z - (rowCount - 1) * 0.2];
}

/**
 * Stable ordering of a studio's agents so desk assignment never shifts: main Claude first,
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

/**
 * Target studio-local position for an agent given its resolved location and desk. Multiple
 * agents sharing the planning table / review screen get a small deterministic fan-out so
 * they never overlap.
 */
export function locationPosition(
  location: StudioLocationKey,
  deskIndex: number,
  crowdIndex: number,
  crowdCount: number,
): [number, number, number] {
  const desk = deskPosition(deskIndex);
  if (location === 'desk' || location === 'attention') {
    // Stand just in front of the desk (toward the open front) facing the monitor.
    return [desk[0], 0, desk[2] + 0.95];
  }
  const anchor = location === 'planning-table' ? STUDIO_ANCHORS.planningTable : STUDIO_ANCHORS.reviewScreen;
  if (crowdCount <= 1) {
    return [anchor[0], 0, anchor[2] + (location === 'review-screen' ? -1.4 : 1.4)];
  }
  const spread = Math.min(crowdCount, 5);
  const offset = (crowdIndex - (spread - 1) / 2) * 1.5;
  const facingZ = location === 'review-screen' ? anchor[2] - 1.4 : anchor[2] + 1.4;
  return [anchor[0] + offset, 0, facingZ];
}
