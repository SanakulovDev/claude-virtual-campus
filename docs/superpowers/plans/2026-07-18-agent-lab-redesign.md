# Agent Lab Redesign Implementation Plan (Parts B+C+D)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the island/hub/hex-ring campus with one open-plan isometric office ("Agent Lab"): corridor spine, rooms in pairs, low-poly office people who walk the hallway between rooms, plus a zero-interaction kiosk mode for a small 7–10" landscape monitor.

**Architecture:** All layout becomes world-space in a new `selectors/office-layout.ts` (pure functions, index-driven like today). A pure `selectors/routing.ts` turns (from, to) into hallway waypoint paths. `AgentAvatar` walks waypoints instead of lerping to a single target and renders a low-poly person instead of a robot. Camera becomes fixed-angle orthographic isometric with overview/room/follow modes; `?kiosk=1` hides HUD and auto-directs the camera. Backend, sockets, store shapes, and the 5-state visual model are unchanged.

**Tech Stack:** Next.js, React Three Fiber, @react-three/drei, zustand, vitest.

## Global Constraints

- Frontend never decides what an agent does — visual state comes only from `selectors/visual-state.selector.ts` mappings of backend activity (CLAUDE.md).
- Ambient idle life stays cosmetic: labelled ambient, stops on any real event, never produces events.
- No language-specific branches; technology is metadata only.
- Old camera store modes (`campus`/`room`/`follow`) and all store actions keep working — HUD panels depend on them.
- Gates before done: `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm test:e2e` (stop `pnpm dev` before `test:e2e`).
- Run one web test file: `pnpm --filter @campus/web exec vitest run selectors/office-layout.test.ts`.
- Prerequisite: the Part A plan (`2026-07-18-project-identity-hardening.md`) is merged first.

## World-space conventions (used by every task)

- Hallway spine along **X**, centered z=0, half-width `HALL_HALF = 3`.
- Entrance core occupies `x ∈ [-14, 0]`: shared review zone on the north side (z < 0), lounge on the south side (z > 0).
- Rooms start at `ROOMS_X0 = 2`, size `ROOM_W = 16` (along x) × `ROOM_D = 12` (along z), gap `ROOM_GAP = 0.6`. Project index `i`: pair = `floor(i/2)`; even `i` = north room (center z = −9), odd `i` = south room (center z = +9).
- Room-local coords: door on local `+Z` wall at local `[0, 0, 6]`; desks in the back half (local −z). North rooms have `rotationY = 0` (local +Z = world +Z); south rooms `rotationY = π` (local x,z negate).
- Y is up; floor at y=0; people ~1.8 tall.

---

### Task 1: theme palette + `visit` ambient activity

**Files:**
- Modify: `apps/web/lib/theme.ts`
- Modify: `packages/contracts/src/agents.ts:118-130`

**Interfaces:**
- Produces: `PALETTE` gains office keys (`officeFloor`, `hallwayFloor`, `wall`, `partition`, `partitionGlass`, `doorTrim`, `rug`, `sofa`, `coffeeMachine`, `screenFrame`, `skin`, `skinTones`, `hairColors`, `pants`); `AMBIENT_ACTIVITIES` gains `{ key: 'visit', label: 'visiting a neighbor team', area: null }`. `STATE_COLOR`/`STATE_LABEL`/`STATE_ICON`/`projectAccent`/`agentBodyColor`/`HTML_Z_RANGE` unchanged.

- [ ] **Step 1: Extend the palette**

In `apps/web/lib/theme.ts`, add inside `PALETTE` (keep every existing key — old components still compile until Task 6 deletes them):

```ts
  /** Agent Lab office system: warm wood + white walls + glass partitions. */
  officeFloor: '#c9a87c',
  hallwayFloor: '#b8946a',
  wall: '#f2efe9',
  partition: '#e4dfd6',
  partitionGlass: '#cfe0e8',
  doorTrim: '#8a7a64',
  rug: '#7f9c8f',
  sofa: '#7a8fa6',
  coffeeMachine: '#3a3f47',
  screenFrame: '#2b303a',
  pants: '#4a5160',
  skinTones: ['#e7c6a5', '#d9a97f', '#c68d5e', '#a96f45', '#8a5a36'],
  hairColors: ['#2f2a26', '#5b4632', '#8a6f4d', '#b5b0a8', '#c2703f', '#1d1d1f'],
```

Note: `skinTones`/`hairColors` are arrays — change the `as const` object accordingly (arrays stay `readonly string[]` under `as const`, which is fine for indexing with `% length`).

- [ ] **Step 2: Add the `visit` ambient activity**

In `packages/contracts/src/agents.ts`, append to `AMBIENT_ACTIVITIES` before the closing `] as const;`:

```ts
  { key: 'visit', label: 'visiting a neighbor team', area: null },
```

- [ ] **Step 3: Verify compile + tests**

Run: `pnpm typecheck && pnpm --filter @campus/web exec vitest run && pnpm --filter @campus/contracts exec vitest run`
Expected: PASS (ambient tests use the pool generically).

- [ ] **Step 4: Commit**

```bash
git add apps/web/lib/theme.ts packages/contracts/src/agents.ts
git commit -m "feat(web): office palette + visit ambient activity"
```

---

### Task 2: `office-layout.ts` — world-space floorplan (TDD)

**Files:**
- Create: `apps/web/selectors/office-layout.ts`
- Create: `apps/web/selectors/office-layout.test.ts`

**Interfaces (everything later tasks consume — exact):**

```ts
export const HALL_HALF: number;            // 3
export const ROOM_W: number;               // 16
export const ROOM_D: number;               // 12
export const ROOM_GAP: number;             // 0.6
export const ROOMS_X0: number;             // 2
export const CORE_LEN: number;             // 14

export interface RoomPlacement {
  center: [number, number, number];
  rotationY: number;                        // 0 north, Math.PI south
  door: [number, number, number];           // world, on the hallway wall
  north: boolean;
  pair: number;
}
export function roomPlacement(index: number): RoomPlacement;
export function roomToWorld(index: number, local: [number, number, number]): [number, number, number];
export function deskLocal(deskIndex: number): [number, number, number];
export function tableLocal(): [number, number, number];
export function buildingBounds(projectCount: number): { minX: number; maxX: number; minZ: number; maxZ: number };
export type OfficeZone = { kind: 'hallway' } | { kind: 'core' } | { kind: 'room'; index: number };
export function zoneAt(x: number, z: number): OfficeZone;
export const REVIEW_SCREEN: [number, number, number];   // [-7, 0, -5.8]
export function reviewSpot(crowdIndex: number, crowdCount: number): [number, number, number];
export function ambientSpot(key: string, seed: number, homeRoomIndex: number, projectCount: number): [number, number, number] | null;
export function laneFor(agentId: string): number;        // -1.1 | 0 | 1.1
```

- [ ] **Step 1: Write the failing tests**

Create `apps/web/selectors/office-layout.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  HALL_HALF, ROOM_W, ROOM_D, ROOM_GAP, ROOMS_X0,
  roomPlacement, roomToWorld, deskLocal, buildingBounds, zoneAt,
  reviewSpot, ambientSpot, laneFor,
} from './office-layout';

describe('roomPlacement', () => {
  it('places even indices north and odd indices south of the hallway', () => {
    expect(roomPlacement(0).north).toBe(true);
    expect(roomPlacement(0).center[2]).toBeLessThan(0);
    expect(roomPlacement(1).north).toBe(false);
    expect(roomPlacement(1).center[2]).toBeGreaterThan(0);
    expect(roomPlacement(0).center[0]).toBe(roomPlacement(1).center[0]); // same pair
  });

  it('grows lengthwise: pair n+1 sits one room further along x', () => {
    expect(roomPlacement(2).center[0] - roomPlacement(0).center[0]).toBeCloseTo(ROOM_W + ROOM_GAP);
  });

  it('puts the door on the hallway wall', () => {
    const north = roomPlacement(0);
    expect(north.door[2]).toBeCloseTo(-HALL_HALF);
    const south = roomPlacement(1);
    expect(south.door[2]).toBeCloseTo(HALL_HALF);
    expect(north.door[0]).toBeCloseTo(north.center[0]);
  });
});

describe('roomToWorld', () => {
  it('maps local +Z toward the hallway on both sides', () => {
    const northFront = roomToWorld(0, [0, 0, ROOM_D / 2]);
    expect(northFront[2]).toBeCloseTo(-HALL_HALF);          // north front wall touches hallway
    const southFront = roomToWorld(1, [0, 0, ROOM_D / 2]);
    expect(southFront[2]).toBeCloseTo(HALL_HALF);
  });

  it('mirrors x for south rooms so layouts stay symmetric', () => {
    const north = roomToWorld(0, [2, 0, -3]);
    const south = roomToWorld(1, [2, 0, -3]);
    expect(south[0] - roomPlacement(1).center[0]).toBeCloseTo(-(north[0] - roomPlacement(0).center[0]));
  });
});

describe('zoneAt', () => {
  it('classifies hallway, core and rooms', () => {
    expect(zoneAt(10, 0)).toEqual({ kind: 'hallway' });
    expect(zoneAt(-7, -6)).toEqual({ kind: 'core' });
    const r0 = roomPlacement(0);
    expect(zoneAt(r0.center[0], r0.center[2])).toEqual({ kind: 'room', index: 0 });
    const r3 = roomPlacement(3);
    expect(zoneAt(r3.center[0], r3.center[2])).toEqual({ kind: 'room', index: 3 });
  });
});

describe('buildingBounds', () => {
  it('covers the core plus every room pair', () => {
    const b = buildingBounds(4); // 2 pairs
    expect(b.minX).toBeLessThan(-13);
    expect(b.maxX).toBeGreaterThan(ROOMS_X0 + 2 * (ROOM_W + ROOM_GAP) - ROOM_GAP);
    expect(b.maxZ).toBeGreaterThan(HALL_HALF + ROOM_D);
  });
  it('still has a footprint with zero projects', () => {
    const b = buildingBounds(0);
    expect(b.maxX).toBeGreaterThan(b.minX);
  });
});

describe('crowd + ambient spots', () => {
  it('fans review spots out without overlap', () => {
    const a = reviewSpot(0, 3);
    const b = reviewSpot(1, 3);
    expect(a).not.toEqual(b);
    expect(Math.abs(a[2] - b[2])).toBeLessThan(0.01); // same row, spread on x
  });

  it('gives every ambient key a world spot or null, deterministically', () => {
    for (const key of ['coffee', 'sofa', 'plants', 'walk', 'visit', 'chat', 'stretch']) {
      const s1 = ambientSpot(key, 7, 0, 4);
      const s2 = ambientSpot(key, 7, 0, 4);
      expect(s1).toEqual(s2);
    }
    expect(ambientSpot('reading', 7, 0, 4)).toBeNull(); // desk-bound activity: stay put
  });

  it('visit targets a different room than home', () => {
    const spot = ambientSpot('visit', 3, 0, 4);
    expect(spot).not.toBeNull();
    const zone = zoneAt(spot![0], spot![2]);
    expect(zone.kind).toBe('room');
    expect((zone as { kind: 'room'; index: number }).index).not.toBe(0);
  });

  it('visit with a single project returns null (nowhere to go)', () => {
    expect(ambientSpot('visit', 3, 0, 1)).toBeNull();
  });

  it('lane assignment is stable and one of three lanes', () => {
    expect(laneFor('agent-a')).toBe(laneFor('agent-a'));
    expect([-1.1, 0, 1.1]).toContain(laneFor('agent-xyz'));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @campus/web exec vitest run selectors/office-layout.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `apps/web/selectors/office-layout.ts`:

```ts
/**
 * World-space floorplan of the Agent Lab: one building, hallway spine along X, entrance
 * core (lounge + shared review) at negative X, project rooms attached in pairs north/south
 * of the hallway. Everything is derived from the project array index -- stable across
 * restarts, no persisted positions (the DB's roomPositionX/Z stay ignored).
 */

export const HALL_HALF = 3;
export const ROOM_W = 16;
export const ROOM_D = 12;
export const ROOM_GAP = 0.6;
export const ROOMS_X0 = 2;
export const CORE_LEN = 14;
const MARGIN = 1;

export interface RoomPlacement {
  center: [number, number, number];
  rotationY: number;
  door: [number, number, number];
  north: boolean;
  pair: number;
}

export function roomPlacement(index: number): RoomPlacement {
  const pair = Math.floor(index / 2);
  const north = index % 2 === 0;
  const x = ROOMS_X0 + pair * (ROOM_W + ROOM_GAP) + ROOM_W / 2;
  const z = (HALL_HALF + ROOM_D / 2) * (north ? -1 : 1);
  return {
    center: [x, 0, z],
    rotationY: north ? 0 : Math.PI,
    door: [x, 0, north ? -HALL_HALF : HALL_HALF],
    north,
    pair,
  };
}

/** Room-local -> world. Local +Z is the door wall (toward the hallway) on both sides. */
export function roomToWorld(index: number, local: [number, number, number]): [number, number, number] {
  const p = roomPlacement(index);
  if (p.north) return [p.center[0] + local[0], local[1], p.center[2] + local[2]];
  return [p.center[0] - local[0], local[1], p.center[2] - local[2]];
}

/** Desks fill the back half of a room (local -z), rows of 3, stable per agent. */
export function deskLocal(deskIndex: number): [number, number, number] {
  const perRow = 3;
  const row = Math.floor(deskIndex / perRow);
  const col = deskIndex % perRow;
  return [(col - 1) * 3.4 + 0.8, 0, -0.8 - row * 3.0];
}

/** Small planning table near the front-left of the room, clear of the door lane (door x=0). */
export function tableLocal(): [number, number, number] {
  return [-4.6, 0, 2.2];
}

export function buildingBounds(projectCount: number) {
  const pairs = Math.max(1, Math.ceil(projectCount / 2));
  return {
    minX: -CORE_LEN - MARGIN,
    maxX: ROOMS_X0 + pairs * (ROOM_W + ROOM_GAP) - ROOM_GAP + MARGIN,
    minZ: -(HALL_HALF + ROOM_D + MARGIN),
    maxZ: HALL_HALF + ROOM_D + MARGIN,
  };
}

export type OfficeZone = { kind: 'hallway' } | { kind: 'core' } | { kind: 'room'; index: number };

export function zoneAt(x: number, z: number): OfficeZone {
  if (Math.abs(z) <= HALL_HALF) return { kind: 'hallway' };
  if (x < ROOMS_X0) return { kind: 'core' };
  const pair = Math.floor((x - ROOMS_X0) / (ROOM_W + ROOM_GAP));
  return { kind: 'room', index: pair * 2 + (z < 0 ? 0 : 1) };
}

/** Shared review screen against the core's north wall; agents stand south of it, facing it. */
export const REVIEW_SCREEN: [number, number, number] = [-7, 0, -5.8];

export function reviewSpot(crowdIndex: number, crowdCount: number): [number, number, number] {
  const spread = Math.min(crowdCount, 5);
  const offset = (crowdIndex - (spread - 1) / 2) * 1.5;
  return [REVIEW_SCREEN[0] + offset, 0, REVIEW_SCREEN[2] + 1.8];
}

/** Fixed lounge-side furniture spots (south core). */
const AMBIENT_FIXED: Record<string, [number, number, number][]> = {
  coffee: [[-11.5, 0, 4.8]],
  sofa: [[-8.6, 0, 6.2], [-7.2, 0, 6.2], [-5.8, 0, 6.2]],
  plants: [[-3.4, 0, 6.4], [-12.6, 0, 6.4]],
  chess: [[-10.2, 0, 4.6], [-9.4, 0, 4.6]],
  pingpong: [[-10.2, 0, 4.6], [-9.4, 0, 4.6]],
  chat: [[-6.5, 0, 4.4], [-5.6, 0, 4.4]],
  stretch: [[-4.4, 0, 4.6]],
  model: [[-12.4, 0, 5.6]],
  plaza: [[-7, 0, 4.6]],
};

/**
 * World spot for an ambient activity, or null to stay at the desk. Deterministic in
 * (key, seed) so it is testable and stable within one ambient bucket. 'visit' sends the
 * agent to a guest spot in another project's room -- the cross-room life the lab is for.
 */
export function ambientSpot(
  key: string,
  seed: number,
  homeRoomIndex: number,
  projectCount: number,
): [number, number, number] | null {
  const fixed = AMBIENT_FIXED[key];
  if (fixed) return fixed[seed % fixed.length]!;
  if (key === 'walk') {
    const b = buildingBounds(projectCount);
    const x = ROOMS_X0 + (seed % Math.max(1, Math.floor(b.maxX - ROOMS_X0 - 1)));
    return [x, 0, ((seed % 3) - 1) * 1.1];
  }
  if (key === 'visit') {
    if (projectCount < 2) return null;
    const other = (homeRoomIndex + 1 + (seed % (projectCount - 1))) % projectCount;
    return roomToWorld(other, [3.8, 0, 3.4]); // guest spot just inside the door
  }
  return null; // e.g. 'reading' -- stays at the desk
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** Stable hallway lane per agent so two walkers rarely share a centerline. */
export function laneFor(agentId: string): number {
  return ((hashString(agentId) % 3) - 1) * 1.1;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @campus/web exec vitest run selectors/office-layout.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/selectors/office-layout.ts apps/web/selectors/office-layout.test.ts
git commit -m "feat(web): world-space office layout selector (corridor spine)"
```

---

### Task 3: `routing.ts` — hallway waypoint paths (TDD)

**Files:**
- Create: `apps/web/selectors/routing.ts`
- Create: `apps/web/selectors/routing.test.ts`

**Interfaces:**
- Consumes: `zoneAt`, `roomPlacement`, `HALL_HALF` from `./office-layout`.
- Produces: `routeBetween(from: [number, number, number], to: [number, number, number], lane: number): [number, number, number][]` — ordered waypoints ending exactly at `to`; length 1 when no hallway detour is needed. Task 5's `AgentAvatar` walks this array.

- [ ] **Step 1: Write the failing tests**

Create `apps/web/selectors/routing.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { routeBetween } from './routing';
import { roomPlacement, roomToWorld, zoneAt, HALL_HALF } from './office-layout';

describe('routeBetween', () => {
  it('goes direct within the same room', () => {
    const a = roomToWorld(0, [0, 0, -2]);
    const b = roomToWorld(0, [2, 0, 1]);
    expect(routeBetween(a, b, 0)).toEqual([b]);
  });

  it('routes room->room through both doors and the hallway', () => {
    const from = roomToWorld(0, [0, 0, -2]);   // north room 0
    const to = roomToWorld(3, [1, 0, -1]);     // south room 3, another pair
    const path = routeBetween(from, to, 1.1);

    expect(path[path.length - 1]).toEqual(to);
    // first waypoint: own door
    expect(path[0]![0]).toBeCloseTo(roomPlacement(0).door[0]);
    expect(path[0]![2]).toBeCloseTo(roomPlacement(0).door[2]);
    // middle waypoints ride the hallway lane
    const lanePoints = path.slice(1, -2);
    for (const p of lanePoints) expect(Math.abs(p[2])).toBeLessThanOrEqual(HALL_HALF);
    // penultimate waypoint: destination door
    expect(path[path.length - 2]![0]).toBeCloseTo(roomPlacement(3).door[0]);
  });

  it('routes desk->shared review through the home door only', () => {
    const from = roomToWorld(2, [0, 0, -2]);
    const to: [number, number, number] = [-7, 0, -4];   // review area (core)
    const path = routeBetween(from, to, 0);
    expect(path[0]![0]).toBeCloseTo(roomPlacement(2).door[0]);
    expect(path[path.length - 1]).toEqual(to);
  });

  it('goes direct along the hallway when both ends are in it', () => {
    const path = routeBetween([4, 0, 0], [30, 0, 1], -1.1);
    expect(path[path.length - 1]).toEqual([30, 0, 1]);
    expect(path.length).toBeLessThanOrEqual(3);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @campus/web exec vitest run selectors/routing.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `apps/web/selectors/routing.ts`:

```ts
import { roomPlacement, zoneAt } from './office-layout';

type V3 = [number, number, number];

/**
 * Waypoint path from `from` to `to` through the office. No navmesh: rooms open onto the
 * hallway, the core opens onto the hallway, so every route is at most
 * own-door -> hallway lane -> destination door -> target. `lane` (from laneFor) offsets
 * the hallway leg so concurrent walkers don't share one line. The path always ends
 * exactly at `to`; a same-zone move is just [to].
 */
export function routeBetween(from: V3, to: V3, lane: number): V3[] {
  const fromZone = zoneAt(from[0], from[2]);
  const toZone = zoneAt(to[0], to[2]);

  // Same room, or hallway<->hallway: walk straight there.
  if (fromZone.kind === toZone.kind) {
    if (fromZone.kind !== 'room') return [to];
    if (fromZone.index === (toZone as { index: number }).index) return [to];
  }

  const path: V3[] = [];
  let entryX = from[0];
  if (fromZone.kind === 'room') {
    const door = roomPlacement(fromZone.index).door;
    path.push([door[0], 0, door[2]]);
    entryX = door[0];
  }

  let exitX = to[0];
  let exitDoor: V3 | null = null;
  if (toZone.kind === 'room') {
    const door = roomPlacement(toZone.index).door;
    exitDoor = [door[0], 0, door[2]];
    exitX = door[0];
  }

  // Hallway leg along the lane, only when there is actual x distance to cover.
  if (Math.abs(exitX - entryX) > 0.5) {
    path.push([entryX, 0, lane]);
    path.push([exitX, 0, lane]);
  }

  if (exitDoor) path.push(exitDoor);
  path.push(to);
  return path;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @campus/web exec vitest run selectors/routing.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/selectors/routing.ts apps/web/selectors/routing.test.ts
git commit -m "feat(web): hallway waypoint routing selector"
```

---

### Task 4: office shell components (building, room, core)

**Files:**
- Rewrite: `apps/web/components/campus/CampusEnvironment.tsx` (island → office lighting/background; keep the filename and export name)
- Create: `apps/web/components/office/OfficeBuilding.tsx`
- Create: `apps/web/components/office/OfficeRoom.tsx`
- Modify: `apps/web/components/studio/PlanningTable.tsx` (accept a `position` prop instead of reading `STUDIO_ANCHORS`)
- Reuse unchanged: `apps/web/components/studio/AgentDesk.tsx`

**Interfaces:**
- Produces: `<CampusEnvironment />` (no props now — lighting + background only); `<OfficeBuilding projectCount={n} anyChecking={bool} />` (floor, hallway, outer walls, core furniture incl. review screen + lounge); `<OfficeRoom project={ProjectRow} index={i} detail={'full'|'reduced'} onSelect={() => void} />` renders shell + sign + desks + table only — **agents are rendered by Task 6's scene, not by OfficeRoom** (they walk between rooms, so they can't live inside one room's group).
- Consumes: Task 2 layout functions; `PALETTE`, `projectAccent`, `STATE_COLOR`, `STATE_ICON`, `STATE_LABEL` from theme; `selectProjectVisualState`.

- [ ] **Step 1: Rewrite CampusEnvironment**

Replace the whole body of `apps/web/components/campus/CampusEnvironment.tsx`:

```tsx
'use client';

import { PALETTE } from '../../lib/theme';

/** Warm interior daylight for the Agent Lab. Roofless open-plan office viewed from a fixed
 * isometric angle -- an architectural model, not a game level. No textures. */
export function CampusEnvironment() {
  return (
    <>
      <color attach="background" args={[PALETTE.sceneBackground]} />
      <hemisphereLight args={['#fff6e8', '#c9c3b8', 0.85]} />
      <ambientLight intensity={0.35} />
      <directionalLight
        position={[40, 70, 40]}
        intensity={1.15}
        color="#fff3e2"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={1}
        shadow-camera-far={300}
        shadow-camera-left={-140}
        shadow-camera-right={140}
        shadow-camera-top={140}
        shadow-camera-bottom={-140}
        shadow-bias={-0.0004}
      />
      <directionalLight position={[-50, 35, -40]} intensity={0.25} color="#cdd8e6" />
    </>
  );
}
```

- [ ] **Step 2: Give PlanningTable a position prop**

In `apps/web/components/studio/PlanningTable.tsx`, change the signature and drop the `STUDIO_ANCHORS` import:

```tsx
export function PlanningTable({ active, position }: { active: boolean; position: [number, number, number] }) {
  return (
    <group position={position}>
```

(keep the rest of the geometry exactly as is; delete the `const [x, , z] = STUDIO_ANCHORS.planningTable;` line and the old `position={[x, 0, z]}`).

- [ ] **Step 3: Create OfficeBuilding**

Create `apps/web/components/office/OfficeBuilding.tsx`:

```tsx
'use client';

import { PALETTE } from '../../lib/theme';
import {
  buildingBounds, HALL_HALF, REVIEW_SCREEN, CORE_LEN, ROOMS_X0,
} from '../../selectors/office-layout';

const WALL_H = 2.4;
const WALL_T = 0.18;

function Wall({ cx, cz, w, d }: { cx: number; cz: number; w: number; d: number }) {
  return (
    <mesh position={[cx, WALL_H / 2, cz]} castShadow receiveShadow>
      <boxGeometry args={[w, WALL_H, d]} />
      <meshStandardMaterial color={PALETTE.wall} roughness={0.9} />
    </mesh>
  );
}

function Sofa({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.35, 0]} castShadow>
        <boxGeometry args={[4.4, 0.5, 1.4]} />
        <meshStandardMaterial color={PALETTE.sofa} roughness={0.95} />
      </mesh>
      <mesh position={[0, 0.75, -0.55]} castShadow>
        <boxGeometry args={[4.4, 0.7, 0.3]} />
        <meshStandardMaterial color={PALETTE.sofa} roughness={0.95} />
      </mesh>
    </group>
  );
}

function CoffeeMachine({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.55, 0]} castShadow>
        <boxGeometry args={[0.9, 1.1, 0.7]} />
        <meshStandardMaterial color={PALETTE.deskWoodDark} roughness={0.85} />
      </mesh>
      <mesh position={[0, 1.35, 0]} castShadow>
        <boxGeometry args={[0.5, 0.5, 0.45]} />
        <meshStandardMaterial color={PALETTE.coffeeMachine} roughness={0.6} />
      </mesh>
    </group>
  );
}

function Plant({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.25, 0]} castShadow>
        <cylinderGeometry args={[0.28, 0.34, 0.5, 10]} />
        <meshStandardMaterial color={PALETTE.pot} roughness={1} />
      </mesh>
      <mesh position={[0, 0.85, 0]} castShadow>
        <sphereGeometry args={[0.5, 10, 10]} />
        <meshStandardMaterial color={PALETTE.foliage} roughness={1} />
      </mesh>
    </group>
  );
}

/** Big shared review screen on the core's north wall -- checking agents walk here. */
function ReviewWall({ checking }: { checking: boolean }) {
  return (
    <group position={[REVIEW_SCREEN[0], 0, REVIEW_SCREEN[2] - 0.4]}>
      <mesh position={[0, 1.7, 0]} castShadow>
        <boxGeometry args={[5.2, 2.4, 0.2]} />
        <meshStandardMaterial color={PALETTE.screenFrame} roughness={0.6} />
      </mesh>
      <mesh position={[0, 1.7, 0.12]}>
        <planeGeometry args={[4.7, 1.9]} />
        <meshStandardMaterial
          color={checking ? '#d69a3c' : '#1d2733'}
          emissive={checking ? '#d69a3c' : '#000000'}
          emissiveIntensity={checking ? 0.45 : 0}
        />
      </mesh>
    </group>
  );
}

/**
 * The lab shell: one floor slab, darker hallway strip, low outer walls (roofless -- the
 * isometric camera looks in from above) and the entrance-core furniture. Rooms come from
 * OfficeRoom; agents from the scene.
 */
export function OfficeBuilding({ projectCount, anyChecking }: { projectCount: number; anyChecking: boolean }) {
  const b = buildingBounds(projectCount);
  const w = b.maxX - b.minX;
  const d = b.maxZ - b.minZ;
  const cx = (b.minX + b.maxX) / 2;

  return (
    <group>
      {/* floor slab */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0, 0]} receiveShadow>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color={PALETTE.officeFloor} roughness={1} />
      </mesh>
      {/* hallway strip */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0.01, 0]} receiveShadow>
        <planeGeometry args={[w, HALL_HALF * 2]} />
        <meshStandardMaterial color={PALETTE.hallwayFloor} roughness={1} />
      </mesh>
      {/* lounge rug */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-CORE_LEN / 2, 0.02, 5.4]} receiveShadow>
        <circleGeometry args={[3.4, 24]} />
        <meshStandardMaterial color={PALETTE.rug} roughness={1} />
      </mesh>

      {/* outer walls */}
      <Wall cx={cx} cz={b.minZ} w={w} d={WALL_T} />
      <Wall cx={cx} cz={b.maxZ} w={w} d={WALL_T} />
      <Wall cx={b.minX} cz={0} w={WALL_T} d={d} />
      <Wall cx={b.maxX} cz={0} w={WALL_T} d={d} />
      {/* wall separating core from the first room pair (leaves the hallway open) */}
      <Wall cx={ROOMS_X0 - 0.5} cz={-(HALL_HALF + (d / 2 - HALL_HALF) / 2)} w={WALL_T} d={d / 2 - HALL_HALF} />
      <Wall cx={ROOMS_X0 - 0.5} cz={HALL_HALF + (d / 2 - HALL_HALF) / 2} w={WALL_T} d={d / 2 - HALL_HALF} />

      {/* core furniture */}
      <ReviewWall checking={anyChecking} />
      <Sofa position={[-7.2, 0, 6.2]} />
      <CoffeeMachine position={[-11.5, 0, 5.6]} />
      <Plant position={[-3.4, 0, 6.4]} />
      <Plant position={[-12.6, 0, 6.4]} />
    </group>
  );
}
```

- [ ] **Step 4: Create OfficeRoom**

Create `apps/web/components/office/OfficeRoom.tsx`:

```tsx
'use client';

import { useMemo } from 'react';
import { Html } from '@react-three/drei';
import { PALETTE, projectAccent, STATE_COLOR, STATE_ICON, STATE_LABEL, HTML_Z_RANGE } from '../../lib/theme';
import type { AgentRow, ProjectRow } from '../../lib/types';
import { roomPlacement, deskLocal, tableLocal, ROOM_W, ROOM_D } from '../../selectors/office-layout';
import { selectProjectVisualState } from '../../selectors/project-status.selector';
import { selectAgentVisualState } from '../../selectors/visual-state.selector';
import { assignDesks } from '../../selectors/desk-assignment';
import { AgentDesk, type DeskMonitorKind } from '../studio/AgentDesk';
import { PlanningTable } from '../studio/PlanningTable';

const WALL_H = 2.2;
const WALL_T = 0.14;
const DOOR_W = 2.4;

function monitorKind(agent: AgentRow): DeskMonitorKind {
  if (selectAgentVisualState(agent) !== 'working') return 'off';
  switch (agent.activity) {
    case 'researching': return 'reading';
    case 'coding': case 'formatting': return 'coding';
    case 'running_command': return 'command';
    case 'managing_database': return 'database';
    case 'managing_infrastructure': return 'infrastructure';
    default: return 'coding';
  }
}

/**
 * One project's room: glass partitions with an open doorway onto the hallway, a name +
 * status strip above the door, desks and a small planning table. Renders NO agents --
 * people are scene-level so they can walk between rooms.
 */
export function OfficeRoom({
  project, index, detail, onSelect,
}: {
  project: ProjectRow;
  index: number;
  detail: 'full' | 'reduced';
  onSelect: () => void;
}) {
  const placement = useMemo(() => roomPlacement(index), [index]);
  const accent = projectAccent(project.projectKey);
  const state = selectProjectVisualState(project.agents);
  const assigned = useMemo(() => assignDesks(project.agents), [project.agents]);

  const halfW = ROOM_W / 2;
  const halfD = ROOM_D / 2;
  const sideWallLen = (ROOM_W - DOOR_W) / 2;

  return (
    <group position={placement.center} rotation={[0, placement.rotationY, 0]}>
      {/* click plane to select the project */}
      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}
        onClick={(e) => { e.stopPropagation(); onSelect(); }}>
        <planeGeometry args={[ROOM_W, ROOM_D]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      {/* back wall (solid) + side partitions (glass) + front wall with doorway gap */}
      <mesh position={[0, WALL_H / 2, -halfD]} castShadow>
        <boxGeometry args={[ROOM_W, WALL_H, WALL_T]} />
        <meshStandardMaterial color={PALETTE.partition} roughness={0.9} />
      </mesh>
      {[-halfW, halfW].map((x) => (
        <mesh key={x} position={[x, WALL_H / 2, 0]}>
          <boxGeometry args={[WALL_T, WALL_H, ROOM_D]} />
          <meshStandardMaterial color={PALETTE.partitionGlass} transparent opacity={0.35} roughness={0.2} />
        </mesh>
      ))}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * (DOOR_W / 2 + sideWallLen / 2), WALL_H / 2, halfD]}>
          <boxGeometry args={[sideWallLen, WALL_H, WALL_T]} />
          <meshStandardMaterial color={PALETTE.partitionGlass} transparent opacity={0.35} roughness={0.2} />
        </mesh>
      ))}
      {/* door trim + status strip above the doorway */}
      <mesh position={[0, WALL_H + 0.12, halfD]}>
        <boxGeometry args={[DOOR_W + 0.4, 0.24, WALL_T + 0.04]} />
        <meshStandardMaterial color={STATE_COLOR[state]} emissive={STATE_COLOR[state]} emissiveIntensity={0.35} />
      </mesh>

      {/* name sign above the door -- screen-space Html, so it reads upright from any side */}
      <Html position={[0, WALL_H + 0.9, halfD]} center zIndexRange={HTML_Z_RANGE}>
        <button
          onClick={onSelect}
          className="pointer-events-auto whitespace-nowrap rounded-full border px-3 py-1 text-xs font-semibold shadow-sm"
          style={{ background: 'rgba(20,24,31,0.85)', color: '#f5f6f8', borderColor: accent }}
          title={STATE_LABEL[state]}
        >
          <span style={{ color: STATE_COLOR[state] }}>{STATE_ICON[state]}</span> {project.name}
        </button>
      </Html>

      {detail === 'full' && (
        <>
          <PlanningTable active={state === 'planning'} position={tableLocal()} />
          {assigned.map(({ agent, deskIndex }) => (
            <AgentDesk key={deskIndex} position={deskLocal(deskIndex)} monitor={monitorKind(agent)} />
          ))}
        </>
      )}
    </group>
  );
}
```

- [ ] **Step 5: Move `assignDesks` to a neutral module**

`assignDesks` currently lives in `studio-layout.ts`, which Task 6 deletes. Create `apps/web/selectors/desk-assignment.ts` with the function moved verbatim:

```ts
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
```

Update `selectors/studio-layout.ts` to re-export it (`export { assignDesks } from './desk-assignment';`, deleting its local copy) so old components keep compiling until Task 6 removes them. Update `selectors.test.ts` imports only if the test file imports `assignDesks` from `studio-layout` — a re-export keeps that working unchanged.

- [ ] **Step 6: Compile check**

Run: `pnpm --filter @campus/web exec tsc --noEmit` (or `pnpm typecheck`)
Expected: PASS. (New components are not yet mounted; PlanningTable's new required prop breaks `ProjectStudio.tsx` — fix its call site to `<PlanningTable active={...} position={[0, 0, -2.4]} />` for now; it dies in Task 6.)

- [ ] **Step 7: Commit**

```bash
git add apps/web/components/campus/CampusEnvironment.tsx apps/web/components/office apps/web/components/studio/PlanningTable.tsx apps/web/components/campus/ProjectStudio.tsx apps/web/selectors/desk-assignment.ts apps/web/selectors/studio-layout.ts
git commit -m "feat(web): office building + room shell components"
```

---

### Task 5: AgentAvatar — low-poly office person walking waypoints

**Files:**
- Rewrite: `apps/web/components/agents/AgentAvatar.tsx`
- Keep: `apps/web/components/agents/AgentLabel.tsx` (unchanged)

**Interfaces:**
- Produces: `AgentAvatar` props keep the same shape — `target: [number,number,number]` just becomes the **world destination** (routing derives doors/zones from coordinates alone, so no extra props are needed). Final props:

```ts
interface AgentAvatarProps {
  agent: AgentRow;
  visualState: SimplifiedAgentVisualState;
  ambient: AmbientActivity | null;
  resting?: boolean;
  target: [number, number, number];  // world-space destination
  restFacingY: number;
  selected: boolean;
  onSelect: () => void;
  onFollow: () => void;
}
```

- Consumes: `routeBetween` (Task 3), `laneFor` (Task 2), `agentBodyColor`, `PALETTE.skinTones/hairColors/pants`, `STATE_COLOR`.

Behavior contract:
- On `target` change, compute `routeBetween(currentPosition, target, laneFor(agent.id))` once and walk it segment by segment at the existing speed (`delta * 3.2` lerp per segment, advance when within 0.15).
- Poses per state (same state machine as today): walking = leg + arm swing; `working` seated-typing (torso lowered −0.28, arms −1.1 with typing jitter); `checking`/`planning` = standing, arms −0.4; `completed` = jump; `resting` = slump + slow bob, dim status light; ambient-in-place = sway. Attention beacon + selection ring + AgentLabel + main-claude crown all preserved.
- Person look: pants legs, role-tinted shirt (`agentBodyColor`), skin tone `PALETTE.skinTones[hash(id) % len]`, hair `PALETTE.hairColors[hash(id) >> 3 % len]` with 3 hair shapes (cap / side-part / bun) by `hash(id) % 3`.

- [ ] **Step 1: Rewrite the component**

Replace `apps/web/components/agents/AgentAvatar.tsx` with:

```tsx
'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import type { AmbientActivity } from '@campus/contracts';
import { agentBodyColor, PALETTE, STATE_COLOR } from '../../lib/theme';
import type { SimplifiedAgentVisualState } from '../../selectors/visual-state.selector';
import { routeBetween } from '../../selectors/routing';
import { laneFor } from '../../selectors/office-layout';
import { AgentLabel } from './AgentLabel';
import type { AgentRow } from '../../lib/types';

interface AgentAvatarProps {
  agent: AgentRow;
  visualState: SimplifiedAgentVisualState;
  ambient: AmbientActivity | null;
  resting?: boolean;
  /** World-space destination. The avatar routes itself there via the hallway. */
  target: [number, number, number];
  restFacingY: number;
  selected: boolean;
  onSelect: () => void;
  onFollow: () => void;
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** Hair variants keep teammates individual without a model library. */
function Hair({ variant, color }: { variant: number; color: string }) {
  if (variant === 0) {
    return (
      <mesh position={[0, 1.86, 0]} castShadow>
        <sphereGeometry args={[0.21, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={color} roughness={1} />
      </mesh>
    );
  }
  if (variant === 1) {
    return (
      <group>
        <mesh position={[0, 1.87, -0.02]} castShadow>
          <sphereGeometry args={[0.21, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color={color} roughness={1} />
        </mesh>
        <mesh position={[0.12, 1.78, -0.1]} castShadow>
          <boxGeometry args={[0.08, 0.16, 0.16]} />
          <meshStandardMaterial color={color} roughness={1} />
        </mesh>
      </group>
    );
  }
  return (
    <group>
      <mesh position={[0, 1.86, 0]} castShadow>
        <sphereGeometry args={[0.21, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={color} roughness={1} />
      </mesh>
      <mesh position={[0, 1.95, -0.16]} castShadow>
        <sphereGeometry args={[0.09, 10, 10]} />
        <meshStandardMaterial color={color} roughness={1} />
      </mesh>
    </group>
  );
}

/**
 * Low-poly office person. Shirt colour = role tint; skin/hair are stable per agent id.
 * Position comes from walking a hallway waypoint route to the current destination; pose
 * comes from the simplified visual state. Ambient life is labelled and cosmetic only.
 */
export function AgentAvatar({ agent, visualState, ambient, resting = false, target, restFacingY, selected, onSelect, onFollow }: AgentAvatarProps) {
  const root = useRef<THREE.Group>(null);
  const torso = useRef<THREE.Group>(null);
  const leftArm = useRef<THREE.Mesh>(null);
  const rightArm = useRef<THREE.Mesh>(null);
  const leftLeg = useRef<THREE.Group>(null);
  const rightLeg = useRef<THREE.Group>(null);
  const beacon = useRef<THREE.Mesh>(null);

  const pathRef = useRef<THREE.Vector3[]>([]);
  const legRef = useRef(0);

  const shirt = agentBodyColor(agent.agentType, agent.externalAgentId);
  const seedHash = hashString(agent.id);
  const skin = PALETTE.skinTones[seedHash % PALETTE.skinTones.length]!;
  const hairColor = PALETTE.hairColors[(seedHash >> 3) % PALETTE.hairColors.length]!;
  const hairVariant = seedHash % 3;
  const isMain = agent.externalAgentId === 'main-claude' || agent.agentType === 'main-claude';
  const lane = useMemo(() => laneFor(agent.id), [agent.id]);

  // New destination -> new route from wherever we are right now.
  useEffect(() => {
    const g = root.current;
    const from: [number, number, number] = g
      ? [g.position.x, 0, g.position.z]
      : [target[0], 0, target[2]];
    pathRef.current = routeBetween(from, target, lane).map((p) => new THREE.Vector3(p[0], 0, p[2]));
    legRef.current = 0;
  }, [target[0], target[2], lane]);

  useFrame(({ clock }, delta) => {
    const g = root.current;
    if (!g) return;
    const t = clock.elapsedTime;

    // walk the waypoint path
    let moving = false;
    const path = pathRef.current;
    if (legRef.current < path.length) {
      const waypoint = path[legRef.current]!;
      const dist = g.position.distanceTo(waypoint);
      if (dist < 0.15 && legRef.current < path.length - 1) legRef.current += 1;
      if (dist > 0.08) {
        moving = true;
        g.position.lerp(waypoint, Math.min(1, delta * 3.2));
        const dir = waypoint.clone().sub(g.position);
        if (dir.lengthSq() > 0.0001) {
          g.rotation.y = dampAngle(g.rotation.y, Math.atan2(dir.x, dir.z), delta * 6);
        }
      }
    }

    if (!moving) {
      if (resting) g.rotation.y = dampAngle(g.rotation.y, restFacingY, delta * 3);
      else if (ambient) g.rotation.y = dampAngle(g.rotation.y, restFacingY + Math.sin(t * 0.8) * 0.35, delta * 3);
      else g.rotation.y = dampAngle(g.rotation.y, restFacingY, delta * 5);
    }

    const seated = !moving && !resting && !ambient && (visualState === 'working' || visualState === 'checking');
    const targetY = resting
      ? -0.42 + Math.sin(t * 0.9) * 0.03
      : seated ? -0.28
      : ambient && !moving ? Math.sin(t * 1.6) * 0.05
      : 0;
    if (torso.current) {
      torso.current.position.y = THREE.MathUtils.lerp(torso.current.position.y, targetY, Math.min(1, delta * 6));
      if (visualState === 'completed' && !resting) torso.current.position.y = Math.abs(Math.sin(t * 6)) * 0.35;
    }

    // legs swing only while walking
    if (leftLeg.current && rightLeg.current) {
      const swing = moving ? Math.sin(t * 9) * 0.55 : 0;
      leftLeg.current.rotation.x = THREE.MathUtils.lerp(leftLeg.current.rotation.x, swing, Math.min(1, delta * 8));
      rightLeg.current.rotation.x = THREE.MathUtils.lerp(rightLeg.current.rotation.x, -swing, Math.min(1, delta * 8));
    }

    if (leftArm.current && rightArm.current) {
      if (moving) {
        leftArm.current.rotation.x = -Math.sin(t * 9) * 0.45;
        rightArm.current.rotation.x = Math.sin(t * 9) * 0.45;
      } else if (resting) {
        leftArm.current.rotation.x = THREE.MathUtils.lerp(leftArm.current.rotation.x, 0.15, Math.min(1, delta * 4));
        rightArm.current.rotation.x = THREE.MathUtils.lerp(rightArm.current.rotation.x, 0.15, Math.min(1, delta * 4));
      } else if (ambient) {
        const s = Math.sin(t * 1.4) * 0.2;
        leftArm.current.rotation.x = -0.2 + s;
        rightArm.current.rotation.x = -0.2 - s;
      } else if (visualState === 'working') {
        const typ = Math.sin(t * 9) * 0.15;
        leftArm.current.rotation.x = -1.1 + typ;
        rightArm.current.rotation.x = -1.1 - typ;
      } else if (visualState === 'checking' || visualState === 'planning') {
        leftArm.current.rotation.x = -0.4;
        rightArm.current.rotation.x = -0.4;
      } else if (visualState === 'completed') {
        leftArm.current.rotation.x = -2.6;
        rightArm.current.rotation.x = -2.6;
      } else {
        leftArm.current.rotation.x = THREE.MathUtils.lerp(leftArm.current.rotation.x, 0, delta * 5);
        rightArm.current.rotation.x = THREE.MathUtils.lerp(rightArm.current.rotation.x, 0, delta * 5);
      }
    }

    if (beacon.current) {
      const on = visualState === 'attention';
      beacon.current.visible = on;
      if (on) beacon.current.position.y = 2.05 + Math.sin(t * 4) * 0.08;
    }
  });

  const statusColor = STATE_COLOR[visualState];
  const glow = resting ? 0.12 : 1;

  return (
    <group
      ref={root}
      position={target}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      onDoubleClick={(e) => { e.stopPropagation(); onFollow(); }}
    >
      <group ref={torso}>
        {/* legs: hip-pivot groups so they swing while walking */}
        {[-0.13, 0.13].map((x, i) => (
          <group key={x} ref={i === 0 ? leftLeg : rightLeg} position={[x, 0.72, 0]}>
            <mesh position={[0, -0.28, 0]} castShadow>
              <capsuleGeometry args={[0.09, 0.4, 4, 8]} />
              <meshStandardMaterial color={PALETTE.pants} roughness={0.9} />
            </mesh>
            <mesh position={[0, -0.56, 0.06]} castShadow>
              <boxGeometry args={[0.16, 0.1, 0.3]} />
              <meshStandardMaterial color="#2f2a26" roughness={0.9} />
            </mesh>
          </group>
        ))}

        {/* shirt torso (role tint) */}
        <RoundedBox args={[0.52, 0.62, 0.32]} radius={0.1} smoothness={4} position={[0, 1.12, 0]} castShadow>
          <meshStandardMaterial color={shirt} roughness={0.9} />
        </RoundedBox>

        {/* arms: shirt sleeve + skin hand */}
        <mesh ref={leftArm} position={[-0.33, 1.28, 0]} castShadow>
          <capsuleGeometry args={[0.06, 0.34, 4, 8]} />
          <meshStandardMaterial color={shirt} roughness={0.9} />
          <mesh position={[0, -0.26, 0]}>
            <sphereGeometry args={[0.07, 10, 10]} />
            <meshStandardMaterial color={skin} roughness={0.8} />
          </mesh>
        </mesh>
        <mesh ref={rightArm} position={[0.33, 1.28, 0]} castShadow>
          <capsuleGeometry args={[0.06, 0.34, 4, 8]} />
          <meshStandardMaterial color={shirt} roughness={0.9} />
          <mesh position={[0, -0.26, 0]}>
            <sphereGeometry args={[0.07, 10, 10]} />
            <meshStandardMaterial color={skin} roughness={0.8} />
          </mesh>
        </mesh>

        {/* head + hair */}
        <mesh position={[0, 1.68, 0]} castShadow>
          <sphereGeometry args={[0.2, 14, 14]} />
          <meshStandardMaterial color={skin} roughness={0.8} />
        </mesh>
        <Hair variant={hairVariant} color={hairColor} />

        {/* status pin on the chest -- carries the live state colour */}
        <mesh position={[0.16, 1.32, 0.17]}>
          <sphereGeometry args={[0.045, 10, 10]} />
          <meshStandardMaterial color={statusColor} emissive={statusColor} emissiveIntensity={0.9 * glow} toneMapped={false} />
        </mesh>

        {isMain && (
          <mesh position={[0, 2.0, 0]}>
            <torusGeometry args={[0.14, 0.025, 8, 16]} />
            <meshStandardMaterial color="#e8b23c" emissive="#e8b23c" emissiveIntensity={0.4} />
          </mesh>
        )}
      </group>

      <mesh ref={beacon} position={[0, 2.05, 0]} visible={false}>
        <octahedronGeometry args={[0.16, 0]} />
        <meshStandardMaterial color={STATE_COLOR.attention} emissive={STATE_COLOR.attention} emissiveIntensity={1} />
      </mesh>

      {selected && (
        <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.42, 0.54, 28]} />
          <meshBasicMaterial color="#3aa0f0" />
        </mesh>
      )}

      <AgentLabel name={agent.displayName} role={agent.role} state={visualState} ambientLabel={ambient?.label ?? null} resting={resting} selected={selected} />
    </group>
  );
}

function dampAngle(current: number, target: number, t: number): number {
  let diff = target - current;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return current + diff * Math.min(1, t);
}
```

Notes: `profileForAgentType` accessories and the robot `Gripper` die with the robot. If `@campus/contracts`'s `profileForAgentType` import becomes unused anywhere else, leave the contract untouched — only this import is removed.

- [ ] **Step 2: Compile check**

Run: `pnpm typecheck`
Expected: PASS — props are unchanged in shape, so `ProjectStudio.tsx` still compiles (its studio-local `target` briefly renders people at wrong world spots; Task 6 replaces it in the same PR).

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/agents/AgentAvatar.tsx
git commit -m "feat(web): low-poly office person avatar with waypoint walking"
```

---

### Task 6: scene rewrite — mount the lab, delete the island

**Files:**
- Create: `apps/web/components/office/OfficeAgent.tsx`
- Rewrite: `apps/web/components/campus/CampusScene.tsx`
- Delete: `apps/web/components/campus/CampusHub.tsx`, `apps/web/components/campus/ProjectStudio.tsx`, `apps/web/components/studio/StudioPlatform.tsx`, `apps/web/components/studio/StudioSign.tsx`, `apps/web/components/studio/StatusWall.tsx`, `apps/web/components/studio/ReviewScreen.tsx`, `apps/web/selectors/campus-layout.ts`, `apps/web/selectors/studio-layout.ts`
- Modify: `apps/web/selectors/selectors.test.ts` (drop studio/campus-layout cases; `useDebouncedLocation` needs no change — its `StudioLocationKey` type comes from `visual-state.selector`, which stays)

**Interfaces:**
- Produces: `<OfficeAgent agent projectIndex projectId crowd={{index,count}} projectCount />` — computes the agent's world destination:
  - `desk`/`attention` → `roomToWorld(projectIndex, deskLocal(deskIndex) + [0,0,0.95])`
  - `planning-table` → `roomToWorld(projectIndex, tableLocal() + crowd fan-out on local x: `(crowdIndex - (count-1)/2) * 1.2`)`
  - `review-screen` → `reviewSpot(crowdIndex, crowdCount)` (world, in the core)
  - ambient with a spot → that spot; ambient without → desk.
- Detail rule (replaces `studioDetailLevel`): `detail = active || index < 8 ? 'full' : 'reduced'` where active = project state ≠ idle.

- [ ] **Step 1: Create OfficeAgent**

Create `apps/web/components/office/OfficeAgent.tsx`:

```tsx
'use client';

import { useMemo } from 'react';
import type { AgentRow } from '../../lib/types';
import { useCampusStore } from '../../stores/campusStore';
import { useDebouncedLocation } from '../../hooks/useDebouncedLocation';
import { useAmbientActivity } from '../../hooks/useAmbientActivity';
import { selectAgentVisualState, selectStudioLocation } from '../../selectors/visual-state.selector';
import { roomToWorld, deskLocal, tableLocal, reviewSpot, ambientSpot, roomPlacement } from '../../selectors/office-layout';
import { AgentAvatar } from '../agents/AgentAvatar';

/** Facing when parked: desks face the back wall (local -z); review faces the screen (north). */
function restFacing(location: string, north: boolean): number {
  if (location === 'review-screen') return Math.PI; // world -z (screen on the north wall)
  return north ? Math.PI : 0; // local -z in world terms per side
}

/**
 * One person in the lab. Resolves the agent's committed location + ambient life to a
 * world-space destination; AgentAvatar routes itself there through the hallway.
 */
export function OfficeAgent({
  agent, projectId, projectIndex, deskIndex, crowd, projectCount,
}: {
  agent: AgentRow;
  projectId: string;
  projectIndex: number;
  deskIndex: number;
  crowd: { index: number; count: number };
  projectCount: number;
}) {
  const visualState = selectAgentVisualState(agent);
  const desired = selectStudioLocation(visualState);
  const location = useDebouncedLocation(desired);
  const ambient = useAmbientActivity(agent, projectId);
  const resting = useCampusStore((s) => Boolean(s.restingAgentIds[agent.id]));
  const selectAgent = useCampusStore((s) => s.selectAgent);
  const followAgent = useCampusStore((s) => s.followAgent);
  const selectedAgentId = useCampusStore((s) => s.selection.selectedAgentId);
  const north = roomPlacement(projectIndex).north;

  const target = useMemo<[number, number, number]>(() => {
    if (ambient && !resting && location === 'desk') {
      const spot = ambientSpot(ambient.key, deskIndex + crowd.index + 1, projectIndex, projectCount);
      if (spot) return spot;
    }
    if (location === 'review-screen') return reviewSpot(crowd.index, crowd.count);
    if (location === 'planning-table') {
      const t = tableLocal();
      const offset = (crowd.index - (crowd.count - 1) / 2) * 1.2;
      return roomToWorld(projectIndex, [t[0] + offset, 0, t[2] + 1.2]);
    }
    const d = deskLocal(deskIndex);
    return roomToWorld(projectIndex, [d[0], 0, d[2] + 0.95]);
  }, [ambient?.key, resting, location, deskIndex, crowd.index, crowd.count, projectIndex, projectCount]);

  return (
    <AgentAvatar
      agent={agent}
      visualState={visualState}
      ambient={ambient}
      resting={resting}
      target={target}
      restFacingY={restFacing(location, north)}
      selected={selectedAgentId === agent.id}
      onSelect={() => selectAgent(agent.id)}
      onFollow={() => followAgent(agent.id)}
    />
  );
}
```

- [ ] **Step 2: Rewrite CampusScene**

Replace `apps/web/components/campus/CampusScene.tsx`:

```tsx
'use client';

import { Canvas } from '@react-three/fiber';
import { ContactShadows } from '@react-three/drei';
import { CampusEnvironment } from './CampusEnvironment';
import { CampusCameraController } from './CampusCameraController';
import { OfficeBuilding } from '../office/OfficeBuilding';
import { OfficeRoom } from '../office/OfficeRoom';
import { OfficeAgent } from '../office/OfficeAgent';
import { useCampusStore } from '../../stores/campusStore';
import { useKioskMode } from '../../hooks/useKioskMode';
import { assignDesks } from '../../selectors/desk-assignment';
import { buildingBounds } from '../../selectors/office-layout';
import { selectProjectVisualState } from '../../selectors/project-status.selector';
import { selectAgentVisualState, selectStudioLocation } from '../../selectors/visual-state.selector';

export function CampusScene() {
  const projects = useCampusStore((s) => s.projects);
  const projectList = Object.values(projects);
  const deselect = useCampusStore((s) => s.closeInspector);
  const selectProject = useCampusStore((s) => s.selectProject);
  const focusProject = useCampusStore((s) => s.focusProjectRoom);
  const kiosk = useKioskMode();

  const bounds = buildingBounds(projectList.length);
  const anyChecking = projectList.some((p) => selectProjectVisualState(p.agents) === 'checking');

  // crowd counts for the shared review area span ALL projects now
  const reviewCrowd = projectList.flatMap((p) =>
    assignDesks(p.agents)
      .filter((a) => selectStudioLocation(selectAgentVisualState(a.agent)) === 'review-screen')
      .map((a) => ({ agentId: a.agent.id })),
  );

  return (
    <Canvas
      shadows
      dpr={kiosk ? [1, 1.25] : [1, 1.8]}
      orthographic
      camera={{ position: [60, 60, 60], zoom: 20, near: -200, far: 600 }}
      onPointerMissed={() => deselect()}
      gl={{ antialias: true }}
    >
      <CampusEnvironment />
      <CampusCameraController />
      <ContactShadows
        position={[(bounds.minX + bounds.maxX) / 2, 0.03, 0]}
        scale={Math.max(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ) * 1.2}
        blur={2.4}
        opacity={0.3}
        far={30}
        resolution={1024}
      />
      <OfficeBuilding projectCount={projectList.length} anyChecking={anyChecking} />

      {projectList.map((project, index) => {
        const active = selectProjectVisualState(project.agents) !== 'idle';
        return (
          <OfficeRoom
            key={project.id}
            project={project}
            index={index}
            detail={active || index < 8 ? 'full' : 'reduced'}
            onSelect={() => { selectProject(project.id); focusProject(project.id); }}
          />
        );
      })}

      {projectList.map((project, index) => {
        const assigned = assignDesks(project.agents);
        const planning = assigned.filter((a) => selectStudioLocation(selectAgentVisualState(a.agent)) === 'planning-table');
        return assigned.map(({ agent, deskIndex }) => {
          const loc = selectStudioLocation(selectAgentVisualState(agent));
          const crowdList = loc === 'planning-table'
            ? planning.map((a) => ({ agentId: a.agent.id }))
            : loc === 'review-screen' ? reviewCrowd : [];
          const crowdIndex = crowdList.findIndex((c) => c.agentId === agent.id);
          return (
            <OfficeAgent
              key={agent.id}
              agent={agent}
              projectId={project.id}
              projectIndex={index}
              deskIndex={deskIndex}
              crowd={{ index: crowdIndex < 0 ? 0 : crowdIndex, count: crowdList.length || 1 }}
              projectCount={projectList.length}
            />
          );
        });
      })}
    </Canvas>
  );
}
```

(`useKioskMode` arrives in Task 8 — create a stub now in `apps/web/hooks/useKioskMode.ts`: `export function useKioskMode(): boolean { return false; }` and replace it in Task 8.)

- [ ] **Step 3: Delete dead files**

```bash
git rm apps/web/components/campus/CampusHub.tsx apps/web/components/campus/ProjectStudio.tsx \
  apps/web/components/studio/StudioPlatform.tsx apps/web/components/studio/StudioSign.tsx \
  apps/web/components/studio/StatusWall.tsx apps/web/components/studio/ReviewScreen.tsx \
  apps/web/selectors/campus-layout.ts apps/web/selectors/studio-layout.ts
```

Fix fallout: `selectors/selectors.test.ts` — delete describe blocks that import from `campus-layout`/`studio-layout` (keep visual-state/movement/project-status cases); any lingering `studio-layout` imports switch to `desk-assignment`/`office-layout`. `CampusCameraController.tsx` still imports `campus-layout` — Task 7 rewrites it; to keep this commit green, do Task 7 in the same PR branch **before** running gates, or temporarily point its imports at `office-layout` equivalents. Preferred: execute Tasks 6 and 7 back-to-back, gate once.

- [ ] **Step 4: Run web tests**

Run: `pnpm --filter @campus/web exec vitest run`
Expected: PASS after Task 7.

- [ ] **Step 5: Commit**

```bash
git add -A apps/web
git commit -m "feat(web): mount the Agent Lab scene, remove island/hub/studios"
```

---

### Task 7: orthographic isometric camera controller

**Files:**
- Rewrite: `apps/web/components/campus/CampusCameraController.tsx`

**Interfaces:**
- Consumes: store `camera` state (`campus`/`room`/`follow` — unchanged), `buildingBounds`, `roomPlacement`, `roomToWorld`, `deskLocal`, `reviewSpot`, office `zoneAt`; `assignDesks`; visual-state selectors.
- Produces: same component name/mount point. Fixed isometric direction `ISO_DIR = normalize(1, 1.15, 1)`; per-mode target + ortho zoom; eased interruptible transitions; orbit rotate enabled in normal mode, pan/zoom always, everything disabled in kiosk (kiosk prop wired in Task 8 via `useKioskMode`).

- [ ] **Step 1: Rewrite the controller**

Replace `apps/web/components/campus/CampusCameraController.tsx`:

```tsx
'use client';

import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import { useCampusStore } from '../../stores/campusStore';
import { useKioskMode } from '../../hooks/useKioskMode';
import { buildingBounds, roomPlacement, roomToWorld, deskLocal, reviewSpot, ROOM_W, ROOM_D } from '../../selectors/office-layout';
import { assignDesks } from '../../selectors/desk-assignment';
import { selectAgentVisualState, selectStudioLocation } from '../../selectors/visual-state.selector';
import type { ProjectRow } from '../../lib/types';

const ISO_DIR = new THREE.Vector3(1, 1.15, 1).normalize();
const CAM_DIST = 120;

interface Shot { sig: string; target: THREE.Vector3; zoom: number }

function agentWorldPosition(projects: ProjectRow[], agentId: string): THREE.Vector3 | null {
  for (let i = 0; i < projects.length; i += 1) {
    const project = projects[i]!;
    const entry = assignDesks(project.agents).find((a) => a.agent.id === agentId);
    if (!entry) continue;
    const loc = selectStudioLocation(selectAgentVisualState(entry.agent));
    if (loc === 'review-screen') {
      const s = reviewSpot(0, 1);
      return new THREE.Vector3(s[0], 1, s[2]);
    }
    const d = deskLocal(entry.deskIndex);
    const w = roomToWorld(i, [d[0], 0, d[2] + 0.95]);
    return new THREE.Vector3(w[0], 1, w[2]);
  }
  return null;
}

/** Ortho zoom that fits a world-space box at the fixed iso angle, with margin. */
function fitZoom(size: { width: number; height: number }, minX: number, maxX: number, minZ: number, maxZ: number): number {
  const corners: THREE.Vector3[] = [];
  for (const x of [minX, maxX]) for (const z of [minZ, maxZ]) for (const y of [0, 3]) corners.push(new THREE.Vector3(x, y, z));
  const center = new THREE.Vector3((minX + maxX) / 2, 0, (minZ + maxZ) / 2);
  const camPos = center.clone().add(ISO_DIR.clone().multiplyScalar(CAM_DIST));
  const view = new THREE.Matrix4().lookAt(camPos, center, new THREE.Vector3(0, 1, 0)).invert();
  let maxU = 0.001; let maxV = 0.001;
  for (const c of corners) {
    const p = c.clone().applyMatrix4(view);
    maxU = Math.max(maxU, Math.abs(p.x));
    maxV = Math.max(maxV, Math.abs(p.y));
  }
  return Math.min(size.width / 2 / maxU, size.height / 2 / maxV) * 0.9;
}

/** Fixed-angle isometric camera with overview / room / follow modes. Transitions eased and
 * interruptible; grabbing the controls cancels an in-flight move. */
export function CampusCameraController() {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const { camera, size } = useThree();
  const cameraState = useCampusStore((s) => s.camera);
  const projects = useCampusStore((s) => s.projects);
  const kiosk = useKioskMode();
  const projectList = Object.values(projects);
  const projectIds = projectList.map((p) => p.id);

  const shotRef = useRef<Shot | null>(null);
  const activeSigRef = useRef('');
  const progressRef = useRef(1);

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return undefined;
    const cancel = () => { progressRef.current = 1; };
    controls.addEventListener('start', cancel);
    return () => controls.removeEventListener('start', cancel);
  }, []);

  function computeShot(): Shot {
    if (cameraState.mode === 'follow' && cameraState.followedAgentId) {
      const pos = agentWorldPosition(projectList, cameraState.followedAgentId);
      if (pos) return { sig: `follow:${cameraState.followedAgentId}`, target: pos, zoom: 55 };
    }

    if (cameraState.mode === 'room' && cameraState.focusedProjectId) {
      const index = projectIds.indexOf(cameraState.focusedProjectId);
      if (index >= 0) {
        const p = roomPlacement(index);
        const zoom = fitZoom(size, p.center[0] - ROOM_W / 2 - 2, p.center[0] + ROOM_W / 2 + 2, p.center[2] - ROOM_D / 2 - 2, p.center[2] + ROOM_D / 2 + 2);
        return { sig: `room:${cameraState.focusedProjectId}`, target: new THREE.Vector3(p.center[0], 1, p.center[2]), zoom };
      }
    }

    const b = buildingBounds(projectList.length);
    const zoom = fitZoom(size, b.minX, b.maxX, b.minZ, b.maxZ);
    return {
      sig: `overview:${projectList.length}:${size.width}x${size.height}`,
      target: new THREE.Vector3((b.minX + b.maxX) / 2, 0, 0),
      zoom,
    };
  }

  useFrame((_, delta) => {
    const controls = controlsRef.current;
    if (!controls) return;
    const ortho = camera as THREE.OrthographicCamera;
    const shot = computeShot();

    if (shot.sig !== activeSigRef.current) {
      activeSigRef.current = shot.sig;
      shotRef.current = shot;
      progressRef.current = 0;
    } else {
      shotRef.current = shot;
    }

    const current = shotRef.current;
    if (current && progressRef.current < 1) {
      progressRef.current = Math.min(1, progressRef.current + delta * 1.6);
      const e = easeInOut(progressRef.current) * 0.2 + 0.02;
      controls.target.lerp(current.target, e);
      ortho.position.lerp(current.target.clone().add(ISO_DIR.clone().multiplyScalar(CAM_DIST)), e);
      ortho.zoom = THREE.MathUtils.lerp(ortho.zoom, current.zoom, e);
      ortho.updateProjectionMatrix();
    } else if (current && cameraState.mode === 'follow') {
      controls.target.lerp(current.target, Math.min(1, delta * 2));
      ortho.position.lerp(current.target.clone().add(ISO_DIR.clone().multiplyScalar(CAM_DIST)), Math.min(1, delta * 2));
    }
    controls.update();
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.08}
      enableRotate={!kiosk}
      enablePan={!kiosk}
      enableZoom={!kiosk}
      maxPolarAngle={Math.PI / 2.15}
    />
  );
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}
```

- [ ] **Step 2: Gates for Tasks 6+7 together**

Run: `pnpm lint && pnpm typecheck && pnpm --filter @campus/web exec vitest run && pnpm build`
Expected: all PASS.

- [ ] **Step 3: Manual smoke**

Run `pnpm dev`, then in a second terminal `pnpm demo:events` and `pnpm demo:attention`.
Expected: office renders isometric; rooms appear in pairs; a `checking` agent walks its doorway → hallway → shared review screen; attention shows beacon; clicking a room sign focuses it; Escape returns.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/campus/CampusCameraController.tsx
git commit -m "feat(web): fixed isometric orthographic camera with fit-zoom modes"
```

---

### Task 8: kiosk mode + auto-director

**Files:**
- Rewrite stub: `apps/web/hooks/useKioskMode.ts`
- Create: `apps/web/hooks/useKioskDirector.ts`
- Modify: `apps/web/app/page.tsx`
- Modify: `apps/web/components/agents/AgentLabel.tsx` (scale labels up in kiosk — pass a `kiosk` boolean? No: read the hook inside AgentLabel)

**Interfaces:**
- Produces: `useKioskMode(): boolean` — true when the URL has `?kiosk=1` (read once from `window.location.search`; SSR-safe: `false` on server). `useKioskDirector(): void` — kiosk-only camera automation (no-op otherwise).

- [ ] **Step 1: Implement useKioskMode**

Replace `apps/web/hooks/useKioskMode.ts`:

```ts
'use client';

/** True when the page runs as a wall/desk display (?kiosk=1): HUD hidden, camera
 * auto-directed, no pointer input expected. Read once -- kiosk devices don't navigate. */
export function useKioskMode(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('kiosk') === '1';
}
```

- [ ] **Step 2: Implement the auto-director**

Create `apps/web/hooks/useKioskDirector.ts`:

```ts
'use client';

import { useEffect } from 'react';
import { useCampusStore } from '../stores/campusStore';
import { selectAgentVisualState } from '../selectors/visual-state.selector';
import { useKioskMode } from './useKioskMode';

const FOCUS_HOLD_MS = 20_000;   // return to overview this long after the last event
const TICK_MS = 3_000;

/**
 * Kiosk camera automation: attention anywhere wins immediately; otherwise focus the room
 * with the most recent event; after 20s of quiet, pull back to the whole-lab overview.
 * Reads the same store the manual camera uses, so nothing else changes.
 */
export function useKioskDirector(): void {
  const kiosk = useKioskMode();

  useEffect(() => {
    if (!kiosk) return undefined;

    const direct = () => {
      const s = useCampusStore.getState();
      const projects = Object.values(s.projects);

      const attention = projects.find((p) => p.agents.some((a) => selectAgentVisualState(a) === 'attention'));
      if (attention) {
        if (s.camera.focusedProjectId !== attention.id) s.focusProjectRoom(attention.id);
        return;
      }

      const latest = s.timeline[0];
      const fresh = latest && Date.now() - new Date(latest.receivedAt).getTime() < FOCUS_HOLD_MS;
      if (fresh && s.projects[latest.projectId]) {
        if (s.camera.focusedProjectId !== latest.projectId) s.focusProjectRoom(latest.projectId);
        return;
      }

      if (s.camera.mode !== 'campus') s.returnToCampus();
    };

    direct();
    const id = setInterval(direct, TICK_MS);
    return () => clearInterval(id);
  }, [kiosk]);
}
```

- [ ] **Step 3: Wire page.tsx**

In `apps/web/app/page.tsx`, add imports and hide HUD in kiosk:

```tsx
import { useKioskMode } from '../hooks/useKioskMode';
import { useKioskDirector } from '../hooks/useKioskDirector';
```

inside `Page()`:

```tsx
  const kiosk = useKioskMode();
  useKioskDirector();
```

and change the returned JSX:

```tsx
  return (
    <div className="flex h-screen flex-col bg-[#eef1f5]">
      {!kiosk && <CampusTopBar />}
      <div className="flex min-h-0 flex-1">
        {!kiosk && <ProjectDock />}
        <main className="relative min-w-0 flex-1" data-testid="campus-canvas">
          <CampusScene />
          {!kiosk && (
            <>
              <AnalyticsPanel />
              <CampusStatusPill />
              <InspectorDrawer />
              <ApprovalDrawer />
            </>
          )}
        </main>
      </div>
      {!kiosk && <ContextTimeline />}
    </div>
  );
```

- [ ] **Step 4: Bigger labels in kiosk**

In `apps/web/components/agents/AgentLabel.tsx` add `import { useKioskMode } from '../../hooks/useKioskMode';`, then inside the component body add `const kiosk = useKioskMode();` and change the `<Html>` opening tag's `distanceFactor` (a smaller distanceFactor renders the label larger):

```tsx
    <Html position={[0, 2.35, 0]} center distanceFactor={kiosk ? 11 : 16} pointerEvents="none" zIndexRange={HTML_Z_RANGE}>
```

In `apps/web/components/office/OfficeRoom.tsx` do the same (`const kiosk = useKioskMode();`) and on the sign `<button>`'s `style` object add `fontSize: kiosk ? '1.05rem' : undefined`.

- [ ] **Step 5: Verify**

Run `pnpm dev`, open `http://localhost:3100/?kiosk=1` sized ~1024×600, run `pnpm demo:events` and `pnpm demo:attention`.
Expected: no HUD; camera sits on whole-building overview; zooms to the active room on events; snaps to the attention room during `demo:attention`; returns to overview ~20s after quiet. Approval drawer absent — resolve approvals from a normal (non-kiosk) window.

- [ ] **Step 6: Commit**

```bash
git add apps/web/hooks/useKioskMode.ts apps/web/hooks/useKioskDirector.ts apps/web/app/page.tsx apps/web/components/agents/AgentLabel.tsx apps/web/components/office/OfficeRoom.tsx
git commit -m "feat(web): kiosk mode with auto-director camera"
```

---

### Task 9: dead layout cleanup + full gates

**Files:**
- Delete: `packages/contracts/src/layout.ts` (grid `calculateRoomPosition` + `MEDIUM_ROOM_ZONES`)
- Modify: `packages/contracts/src/index.ts` (drop the layout export)
- Modify: `apps/api/src/projects/room-layout.ts` (remove the re-export; keep `calculateRoomTemplate`)
- Modify: `apps/api/src/projects/projects.service.ts` (create with `roomPositionX: 0, roomPositionZ: 0`)
- Leave alone: zone enums (`OFFICE_ZONE_KEYS`, `COMMAND_CATEGORY_ZONE`) — the event pipeline and `ProjectAgent.currentZoneKey` still carry them as metadata; removing them is out of scope.

- [ ] **Step 1: Remove the grid layout**

Delete `packages/contracts/src/layout.ts`; remove its export line from `packages/contracts/src/index.ts`. In `apps/api/src/projects/room-layout.ts` delete the `calculateRoomPosition` re-export. In `projects.service.ts` replace the `count`/`calculateRoomPosition` logic (already reshaped by Part A's Task 5) with literal zeros:

```ts
    const project = await this.prisma.project.upsert({
      where: { projectKey: resolved.projectKey },
      update: { /* unchanged */ },
      create: {
        /* unchanged fields... */
        roomPositionX: 0,
        roomPositionZ: 0,
      },
    });
```

and delete the now-unused `const count = await this.prisma.project.count();` + `calculateRoomPosition` import. Fix any other `calculateRoomPosition`/`MEDIUM_ROOM_ZONES` references `grep -rn "calculateRoomPosition\|MEDIUM_ROOM_ZONES" --include="*.ts" .` turns up (tests included).

- [ ] **Step 2: Full gates**

```bash
pnpm lint && pnpm typecheck && pnpm test && pnpm build
pnpm test:e2e   # stop pnpm dev first
```
Expected: all green. If `test:e2e`/`test:redesign`/screenshot suites assert island/studio visuals, update those assertions to the office scene (room signs, building floor) — they run against `campus_smoke`, never `public`.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: remove dead grid/zone room layout from contracts and api"
```
