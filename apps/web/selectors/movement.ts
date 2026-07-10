/**
 * Movement debounce. Rapid backend events must not make an agent thrash between locations.
 * Most of the smoothing is already free: the visual-state mapping collapses every "working"
 * tool event onto the same 'desk' location, so a burst of Read/Edit/Bash events produces no
 * movement at all. This helper covers the remaining flicker between genuinely different
 * locations (e.g. working <-> checking) by requiring a new destination to be stable for a
 * short window before the agent commits to walking there.
 *
 * 'attention' is treated as urgent and commits immediately -- a blocked/failed/approval
 * state should register at once, not after a delay.
 */
export function shouldCommitMove<T extends string>(
  committed: T,
  desired: T,
  msSinceDesiredAppeared: number,
  windowMs: number,
): boolean {
  if (desired === committed) return false;
  if (desired === 'attention') return true;
  return msSinceDesiredAppeared >= windowMs;
}

export const MOVEMENT_DEBOUNCE_MS = 450;
