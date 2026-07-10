import type { AgentActivity } from '@campus/contracts';
import type { AgentRow } from '../lib/types';

/**
 * The only agent states the 3D world exposes. Detailed backend activities/zones stay in
 * the store and inspector; this collapses them so agents move on meaningful phase changes
 * (planning -> working -> checking -> done) instead of on every individual tool event.
 */
export type SimplifiedAgentVisualState =
  | 'idle'
  | 'planning'
  | 'working'
  | 'checking'
  | 'attention'
  | 'completed';

/** Where an agent physically sits/stands inside its studio for a given visual state. */
export type StudioLocationKey = 'desk' | 'planning-table' | 'review-screen' | 'attention';

const ACTIVITY_TO_STATE: Record<AgentActivity, SimplifiedAgentVisualState> = {
  idle: 'idle',
  walking: 'idle',
  planning: 'planning',
  meeting: 'planning',
  researching: 'working',
  coding: 'working',
  formatting: 'working',
  running_command: 'working',
  managing_database: 'working',
  managing_infrastructure: 'working',
  testing: 'checking',
  building: 'checking',
  reviewing: 'checking',
  waiting_approval: 'attention',
  blocked: 'attention',
  failed: 'attention',
  completed: 'completed',
};

const STATE_TO_LOCATION: Record<SimplifiedAgentVisualState, StudioLocationKey> = {
  idle: 'desk',
  planning: 'planning-table',
  working: 'desk',
  checking: 'review-screen',
  attention: 'attention',
  completed: 'desk',
};

/** Detailed backend agent state -> one of the simplified visual states. */
export function selectAgentVisualState(agent: Pick<AgentRow, 'activity'>): SimplifiedAgentVisualState {
  return ACTIVITY_TO_STATE[agent.activity] ?? 'idle';
}

/**
 * Studio location for a visual state. Note 'attention' resolves to 'attention', meaning
 * "pause where you are and raise a beacon" -- the agent does not walk to a separate room.
 */
export function selectStudioLocation(state: SimplifiedAgentVisualState): StudioLocationKey {
  return STATE_TO_LOCATION[state];
}

export function selectAgentLocation(agent: Pick<AgentRow, 'activity'>): StudioLocationKey {
  return selectStudioLocation(selectAgentVisualState(agent));
}
