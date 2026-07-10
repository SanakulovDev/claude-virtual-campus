import type { AgentRow } from '../lib/types';
import { selectAgentVisualState, type SimplifiedAgentVisualState } from './visual-state.selector';

export type ProjectVisualState = SimplifiedAgentVisualState;

// Higher-urgency states win when a studio's agents are in a mix of states. Attention is
// most urgent; a just-finished 'completed' outranks a fully idle studio so completion is
// briefly visible on the status wall.
const PRIORITY: ProjectVisualState[] = ['attention', 'checking', 'working', 'planning', 'completed', 'idle'];

export function selectProjectVisualState(agents: Pick<AgentRow, 'activity'>[]): ProjectVisualState {
  if (agents.length === 0) return 'idle';
  let best: ProjectVisualState = 'idle';
  let bestRank = PRIORITY.length;
  for (const agent of agents) {
    const state = selectAgentVisualState(agent);
    const rank = PRIORITY.indexOf(state);
    if (rank !== -1 && rank < bestRank) {
      bestRank = rank;
      best = state;
    }
  }
  return best;
}
