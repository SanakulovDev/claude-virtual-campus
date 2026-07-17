export interface StudioPlacement {
  /** World position of the studio's centre. */
  position: [number, number, number];
  /** Y rotation so the studio's open front (+Z local) faces away from the hub. */
  rotationY: number;
  /** Unit vector pointing from the hub outward through this studio (for camera framing). */
  outward: [number, number];
  ring: number;
}

import { STUDIO_HALF_DEPTH, STUDIO_HALF_WIDTH } from './studio-layout';

const HUB_CLEAR = 21; // radius of the innermost ring
const RING_SPACING = 20;

/** Smallest island: still has to hold the hub and its plaza when no project is connected. */
export const ISLAND_MIN_RADIUS = 26;
/** Lawn left beyond the outermost studio. Raise for more breathing room, lower to tighten. */
const ISLAND_MARGIN = 6;
/** A studio's own reach: half-diagonal of its platform, so any rotation still fits. */
const STUDIO_REACH = Math.hypot(STUDIO_HALF_WIDTH + 0.5, STUDIO_HALF_DEPTH + 0.5);

function slotsInRing(ring: number): number {
  return 6 * (ring + 1);
}

/**
 * Deterministic placement of project studios in expanding rings around the central hub.
 * Stable across restarts (depends only on index). Studios face outward so a focus camera
 * sitting beyond the ring looks straight into the open studio with the hub behind it.
 */
export function calculateStudioPlacement(index: number): StudioPlacement {
  let ring = 0;
  let remaining = index;
  while (remaining >= slotsInRing(ring)) {
    remaining -= slotsInRing(ring);
    ring += 1;
  }
  const slots = slotsInRing(ring);
  const radius = HUB_CLEAR + ring * RING_SPACING;
  // Offset alternate rings by half a slot so studios don't line up radially.
  const angle = (remaining / slots) * Math.PI * 2 + (ring % 2 === 1 ? Math.PI / slots : 0);

  const x = Math.cos(angle) * radius;
  const z = Math.sin(angle) * radius;
  // Local +Z (studio front) should point outward = (cos, sin). A vector (0,0,1) rotated by
  // ry about Y becomes (sin ry, 0, cos ry); solving gives ry = atan2(cos angle, sin angle).
  const rotationY = Math.atan2(Math.cos(angle), Math.sin(angle));

  return {
    position: [x, 0, z],
    rotationY,
    outward: [Math.cos(angle), Math.sin(angle)],
    ring,
  };
}

/**
 * Island radius for a campus of `projectCount` studios: the outermost occupied ring plus the
 * studios standing on it plus a margin of lawn.
 *
 * Sized to content on purpose. A fixed radius big enough for a large campus leaves a small one
 * marooned in empty grass -- rings only reach 21 at ring 0, so three studios inside a radius-60
 * island were surrounded by ~40 units of nothing, and the overview camera framed all of it.
 */
export function calculateIslandRadius(projectCount: number): number {
  if (projectCount <= 0) return ISLAND_MIN_RADIUS;
  const outerRing = calculateStudioPlacement(projectCount - 1).ring;
  const outerRadius = HUB_CLEAR + outerRing * RING_SPACING;
  return Math.max(ISLAND_MIN_RADIUS, outerRadius + STUDIO_REACH + ISLAND_MARGIN);
}

/** Coarse level-of-detail: nearer rings render full detail, far rings simplify. */
export function studioDetailLevel(ring: number, active: boolean): 'full' | 'reduced' {
  if (active) return 'full';
  return ring <= 1 ? 'full' : 'reduced';
}
