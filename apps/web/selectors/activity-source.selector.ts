import type { AgentActivitySource, AmbientActivity } from '@campus/contracts';
import type { AgentRow } from '../lib/types';
import { selectAgentVisualState } from './visual-state.selector';
import { summarizeAgentAction } from './activity-summary.selector';

export interface ActivityLine {
  /** e.g. "Jarvis is editing PaymentService.php" or "Lucy is taking a coffee break". */
  text: string;
  source: AgentActivitySource;
  /** Badge under the line. Null when the agent is plainly idle (nothing to attribute). */
  sourceLabel: 'Real agent activity' | 'Ambient activity' | null;
}

function lowerFirst(s: string): string {
  return s ? s[0]!.toLowerCase() + s.slice(1) : s;
}

/**
 * One labelled activity line for an agent. Ambient life is always tagged "Ambient activity"
 * so it is never presented as real agent work; real work is tagged "Real agent activity".
 */
export function selectAgentActivityLine(agent: AgentRow, ambient?: AmbientActivity | null): ActivityLine {
  if (ambient) {
    return { text: `${agent.displayName} is ${ambient.label}`, source: 'ambient-idle', sourceLabel: 'Ambient activity' };
  }
  if (selectAgentVisualState(agent) === 'idle') {
    return { text: `${agent.displayName} is idle`, source: 'real-work', sourceLabel: null };
  }
  return {
    text: `${agent.displayName} is ${lowerFirst(summarizeAgentAction(agent))}`,
    source: 'real-work',
    sourceLabel: 'Real agent activity',
  };
}
