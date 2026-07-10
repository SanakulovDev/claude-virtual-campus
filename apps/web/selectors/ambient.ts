import { AMBIENT_ACTIVITIES, type AmbientActivity } from '@campus/contracts';
import type { AgentRow } from '../lib/types';
import { selectAgentVisualState } from './visual-state.selector';

/**
 * Ambient idle life is a purely client-side, cosmetic layer. It never creates Claude
 * events, tool calls, tasks or transcripts -- it only decides that a genuinely idle agent
 * may be shown doing something human (a coffee break, watering plants) instead of sitting
 * frozen. Any real agent state stops it immediately because eligibility is recomputed from
 * live agent state on every render.
 */

export interface AmbientContext {
  /** Master switch (user can disable ambient life entirely). */
  enabled: boolean;
  /** Respect the OS reduced-motion setting -- no ambient wandering when set. */
  reducedMotion: boolean;
  /** A pending approval or active failure in the room freezes ambient life. */
  roomBlocked: boolean;
}

/**
 * An agent may show ambient life only when it is truly idle (real work always wins) and
 * nothing in the room needs attention. Returns false the instant real work arrives.
 */
export function agentIsAmbientEligible(agent: Pick<AgentRow, 'activity' | 'status'>, ctx: AmbientContext): boolean {
  if (!ctx.enabled || ctx.reducedMotion || ctx.roomBlocked) return false;
  return selectAgentVisualState(agent) === 'idle';
}

function hash(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h;
}

/** Deterministic ambient activity for a seed (agent id + time bucket), so it's testable. */
export function pickAmbientActivity(seed: string): AmbientActivity {
  return AMBIENT_ACTIVITIES[hash(seed) % AMBIENT_ACTIVITIES.length]!;
}

/**
 * The ambient activity to show for an agent right now, or null when it should be doing
 * nothing ambient (ineligible). `bucket` rotates the activity over time.
 */
export function ambientActivityForAgent(
  agent: Pick<AgentRow, 'id' | 'activity' | 'status'>,
  ctx: AmbientContext,
  bucket: number,
): AmbientActivity | null {
  if (!agentIsAmbientEligible(agent, ctx)) return null;
  return pickAmbientActivity(`${agent.id}:${bucket}`);
}
