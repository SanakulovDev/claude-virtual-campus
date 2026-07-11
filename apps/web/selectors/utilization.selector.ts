import type { TimelineEntry } from '../lib/types';

/** Recent window over which "how busy has this agent been" is measured. */
export const UTILIZATION_WINDOW_MS = 5 * 60 * 1000;
/** Number of recent work events that reads as fully utilised (100%). */
export const UTILIZATION_SATURATION = 8;

const WORK_TYPES = new Set(['file_read', 'file_edit', 'command_run', 'tool_use', 'tool_completed']);

/**
 * Honest utilization: the share of a recent window an agent has been doing real work,
 * approximated from the volume of real work events in the store. Never fabricated -- it is
 * 0 when there is no recent real activity, and saturates at 1. This is an activity
 * heuristic, NOT hardware telemetry.
 */
export function selectAgentUtilization(agentId: string, timeline: TimelineEntry[], now: number = Date.now()): number {
  const cutoff = now - UTILIZATION_WINDOW_MS;
  let work = 0;
  for (const e of timeline) {
    if (e.agentId !== agentId) continue;
    if (new Date(e.receivedAt).getTime() < cutoff) continue;
    if (WORK_TYPES.has(e.normalizedType)) work += 1;
  }
  return Math.max(0, Math.min(1, work / UTILIZATION_SATURATION));
}
