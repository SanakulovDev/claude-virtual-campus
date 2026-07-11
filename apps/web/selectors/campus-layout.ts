export interface StudioPlacement {
  /** World position of the studio's centre. */
  position: [number, number, number];
  /** Y rotation so the studio's open front (+Z local) faces away from the hub. */
  rotationY: number;
  /** Unit vector pointing from the hub outward through this studio (for camera framing). */
  outward: [number, number];
  ring: number;
}

const HUB_CLEAR = 21; // radius of the innermost ring
const RING_SPACING = 20;

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

/** Coarse level-of-detail: nearer rings render full detail, far rings simplify. */
export function studioDetailLevel(ring: number, active: boolean): 'full' | 'reduced' {
  if (active) return 'full';
  return ring <= 1 ? 'full' : 'reduced';
}
