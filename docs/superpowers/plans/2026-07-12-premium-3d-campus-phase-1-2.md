# Premium 3D Campus Overhaul — Phase 1 & 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the identity + honest-analytics foundation (Phase 1) and the ultra-realistic isometric scene — orthographic camera, architectural rooms with glass, outdoor courtyard, cinematic lighting, and a NavMesh ground — (Phase 2), keeping the automated pipeline green.

**Architecture:** Phase 1 is a contracts pool swap + one pure web selector. Phase 2 replaces the camera rig, upgrades the scene (rooms/courtyard/lighting/glass) behind a WebGL capability fallback, and adds a NavMesh ground + pure layout math that later phases build on. No backend change beyond the name pool; all scene/analytics work is client-side and driven by existing `ProjectAgent` state.

**Tech Stack:** TypeScript, NestJS/Prisma (untouched here beyond the pool), Next.js, React Three Fiber, @react-three/drei, three, `three-pathfinding` (new), `@react-three/postprocessing` (new), Tailwind, Vitest.

## Global Constraints

- No fake data: analytics derive from real events only; no fabricated CPU/telemetry; no invented transcripts. (verbatim from spec)
- No raw hook payloads to the frontend — normalized shapes only.
- Ambient/planning choreography is cosmetic: no events/tools/tasks/transcripts; labelled; stops on real work; frozen during approval/attention; toggle + reduced-motion respected.
- No language-specific branches in core logic.
- Pipeline stays green on software WebGL (headless asserts no console errors) — every heavy visual needs a low-cost fallback.
- `Claude` / `Team Lead` stays the fixed main-agent identity.
- Contracts must be rebuilt (`pnpm --filter @campus/contracts build`) after any `packages/contracts` change, because `apps/api` imports the built `dist/`.

---

## File Structure

**Phase 1**
- Modify: `packages/contracts/src/agents.ts` — `AGENT_NAME_POOL` → Uzbek names.
- Modify: `packages/contracts/src/agents.test.ts` — pool assertions.
- Modify: `apps/api/test/agents.integration.test.ts` — pool-membership assertion.
- Create: `apps/web/selectors/utilization.selector.ts` — pure utilization heuristic.
- Create: `apps/web/selectors/utilization.selector.test.ts`.

**Phase 2**
- Create: `apps/web/lib/renderCapability.ts` — full vs fallback WebGL classification.
- Create: `apps/web/lib/renderCapability.test.ts`.
- Create: `apps/web/selectors/campus-world-layout.ts` — world-space desk + courtyard/table anchors (pure).
- Create: `apps/web/selectors/campus-world-layout.test.ts`.
- Create: `apps/web/lib/campusNav.ts` — `three-pathfinding` zone build + `findPath` wrapper + pure `nextPathPoint`.
- Create: `apps/web/lib/campusNav.test.ts` — pure `nextPathPoint`.
- Modify: `apps/web/components/campus/CampusScene.tsx` — ortho camera + OrbitControls + lighting + postprocessing (gated).
- Modify: `apps/web/components/campus/CampusCameraController.tsx` — tween ortho target/zoom from store selection.
- Create: `apps/web/components/campus/Courtyard.tsx` — sports court, dining, walkways, nav ground.
- Modify: `apps/web/components/studio/*` — architectural room (floor, desks+monitors, chairs, metallic-framed glass) using capability-gated material.
- Modify: `scripts/screenshots.ts` — no logic change expected; re-run to regenerate.

---

## PHASE 1 — Identity + honest analytics

### Task 1: Uzbek name pool

**Files:**
- Modify: `packages/contracts/src/agents.ts` (the `AGENT_NAME_POOL` array)
- Test: `packages/contracts/src/agents.test.ts`
- Test: `apps/api/test/agents.integration.test.ts:` (pool-membership assertion)

**Interfaces:**
- Produces: `AGENT_NAME_POOL: readonly string[]` (unchanged type; Uzbek contents, ≥ 20 entries, all unique). `pickAgentName` / `profileForAgentType` signatures unchanged.

- [ ] **Step 1: Update the contracts test to expect the Uzbek pool**

In `packages/contracts/src/agents.test.ts`, replace the `'returns the first pool name when nothing is used'` assertion body and add a pool-shape assertion:

```typescript
it('returns the first pool name when nothing is used', () => {
  expect(pickAgentName([])).toBe(AGENT_NAME_POOL[0]);
});

it('uses an Uzbek default pool with no duplicates', () => {
  expect(AGENT_NAME_POOL[0]).toBe("Ulug'bek");
  expect(AGENT_NAME_POOL.length).toBeGreaterThanOrEqual(20);
  expect(new Set(AGENT_NAME_POOL).size).toBe(AGENT_NAME_POOL.length);
  expect(AGENT_NAME_POOL).toContain('Aziza');
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm --filter @campus/contracts test`
Expected: FAIL (`AGENT_NAME_POOL[0]` is still `'Lucy'`).

- [ ] **Step 3: Replace the pool in `agents.ts`**

```typescript
/** Curated pool of readable Uzbek first names, assigned deterministically per project. */
export const AGENT_NAME_POOL = [
  "Ulug'bek",
  'Shahnozaxon',
  'Ahmadjon',
  'Aziza',
  'Javohir',
  'Dilnoza',
  'Sardor',
  'Kamola',
  'Bekzod',
  'Nilufar',
  'Jasur',
  'Malika',
  'Otabek',
  'Gulnora',
  'Sherzod',
  'Zarina',
  'Doniyor',
  'Feruza',
  'Sanjar',
  'Mohira',
  'Akmal',
  'Laylo',
] as const;
```

- [ ] **Step 4: Update the API integration pool assertion**

In `apps/api/test/agents.integration.test.ts`, the test `'names real subagents from the pool and reuses the same teammate on restart'` already imports `AGENT_NAME_POOL` and checks membership — no literal names are hard-coded there, so it stays correct. Confirm by reading it; if any literal `'Lucy'`/`'Jarvis'`/`'Anna'` appears in that file, replace with pool-membership checks:

```typescript
expect((AGENT_NAME_POOL as readonly string[]).includes(planners[0].displayName)).toBe(true);
```

- [ ] **Step 5: Rebuild contracts + run both test suites**

Run:
```bash
pnpm --filter @campus/contracts build
pnpm --filter @campus/contracts test
pnpm --filter @campus/api test
```
Expected: PASS (contracts pool tests; api agent-identity tests still green — names now Uzbek).

- [ ] **Step 6: Commit**

```bash
git add packages/contracts/src/agents.ts packages/contracts/src/agents.test.ts apps/api/test/agents.integration.test.ts
git commit -m "feat(agents): switch default name pool to Uzbek names"
```

---

### Task 2: Honest utilization selector

**Files:**
- Create: `apps/web/selectors/utilization.selector.ts`
- Test: `apps/web/selectors/utilization.selector.test.ts`

**Interfaces:**
- Consumes: `TimelineEntry[]` from `apps/web/lib/types` (fields `agentId`, `normalizedType`, `receivedAt`).
- Produces: `selectAgentUtilization(agentId: string, timeline: TimelineEntry[], now?: number): number` returning `0..1`. `UTILIZATION_WINDOW_MS = 5*60*1000`, `UTILIZATION_SATURATION = 8`.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, it } from 'vitest';
import type { TimelineEntry } from '../lib/types';
import { selectAgentUtilization } from './utilization.selector';

const now = Date.UTC(2026, 6, 12, 12, 0, 0);
function entry(over: Partial<TimelineEntry>): TimelineEntry {
  return {
    id: Math.random().toString(36),
    projectId: 'p1',
    agentId: 'a1',
    sessionId: 's1',
    hookEventName: 'PreToolUse',
    normalizedType: 'file_edit',
    toolName: 'Edit',
    receivedAt: new Date(now - 1000).toISOString(),
    ...over,
  };
}

describe('selectAgentUtilization', () => {
  it('is 0 with no recent events', () => {
    expect(selectAgentUtilization('a1', [], now)).toBe(0);
  });

  it('rises with recent work events and saturates at 1', () => {
    const events = Array.from({ length: 8 }, () => entry({}));
    expect(selectAgentUtilization('a1', events, now)).toBe(1);
  });

  it('is ~0.5 at half saturation', () => {
    const events = Array.from({ length: 4 }, () => entry({}));
    expect(selectAgentUtilization('a1', events, now)).toBeCloseTo(0.5, 5);
  });

  it('ignores other agents and stale events', () => {
    const events = [
      entry({ agentId: 'other' }),
      entry({ receivedAt: new Date(now - 10 * 60 * 1000).toISOString() }),
      entry({ normalizedType: 'session_start' }),
    ];
    expect(selectAgentUtilization('a1', events, now)).toBe(0);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm --filter @campus/web test utilization`
Expected: FAIL (`selectAgentUtilization` not defined).

- [ ] **Step 3: Implement the selector**

```typescript
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @campus/web test utilization`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/selectors/utilization.selector.ts apps/web/selectors/utilization.selector.test.ts
git commit -m "feat(web): add honest agent utilization selector"
```

---

## PHASE 2 — Ultra-realistic architecture + camera + courtyard

### Task 3: WebGL capability gate

**Files:**
- Create: `apps/web/lib/renderCapability.ts`
- Test: `apps/web/lib/renderCapability.test.ts`

**Interfaces:**
- Produces: `classifyRenderer(rendererString: string, opts?: { reducedMotion?: boolean; lowFx?: boolean }): 'full' | 'fallback'` and `detectRenderCapability(): 'full' | 'fallback'` (browser-only; uses a throwaway canvas + `WEBGL_debug_renderer_info`). Full-fidelity effects (glass transmission, bloom) run only in `'full'`.

- [ ] **Step 1: Write the failing test (pure classifier)**

```typescript
import { describe, expect, it } from 'vitest';
import { classifyRenderer } from './renderCapability';

describe('classifyRenderer', () => {
  it('flags software renderers as fallback', () => {
    expect(classifyRenderer('Google SwiftShader')).toBe('fallback');
    expect(classifyRenderer('ANGLE (Software)')).toBe('fallback');
    expect(classifyRenderer('llvmpipe')).toBe('fallback');
  });
  it('treats real GPUs as full', () => {
    expect(classifyRenderer('Apple M2')).toBe('full');
    expect(classifyRenderer('ANGLE (Apple, Apple M2, OpenGL)')).toBe('full');
  });
  it('honours reduced-motion and a lowFx flag', () => {
    expect(classifyRenderer('Apple M2', { reducedMotion: true })).toBe('fallback');
    expect(classifyRenderer('Apple M2', { lowFx: true })).toBe('fallback');
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm --filter @campus/web test renderCapability`
Expected: FAIL.

- [ ] **Step 3: Implement**

```typescript
export type RenderCapability = 'full' | 'fallback';

const SOFTWARE_MARKERS = /swiftshader|software|llvmpipe|microsoft basic render/i;

export function classifyRenderer(
  rendererString: string,
  opts: { reducedMotion?: boolean; lowFx?: boolean } = {},
): RenderCapability {
  if (opts.reducedMotion || opts.lowFx) return 'fallback';
  return SOFTWARE_MARKERS.test(rendererString) ? 'fallback' : 'full';
}

/** Browser-only probe. Returns 'fallback' on any failure so headless/software WebGL is safe. */
export function detectRenderCapability(): RenderCapability {
  if (typeof window === 'undefined') return 'fallback';
  try {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const lowFx = new URLSearchParams(window.location.search).has('lowfx');
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') as WebGLRenderingContext | null;
    if (!gl) return 'fallback';
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
    return classifyRenderer(renderer, { reducedMotion, lowFx });
  } catch {
    return 'fallback';
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @campus/web test renderCapability`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/renderCapability.ts apps/web/lib/renderCapability.test.ts
git commit -m "feat(web): add WebGL capability gate for glass/bloom fallback"
```

---

### Task 4: World-space campus layout math

**Files:**
- Create: `apps/web/selectors/campus-world-layout.ts`
- Test: `apps/web/selectors/campus-world-layout.test.ts`

**Interfaces:**
- Consumes: existing `calculateStudioPlacement(index)` from `apps/web/selectors/campus-layout` (returns `{ position:[x,y,z], rotationY, ring }`) and `deskPosition(deskIndex)` from `apps/web/selectors/studio-layout`.
- Produces:
  - `type Vec3 = [number, number, number]`
  - `worldDeskPosition(studioIndex: number, deskIndex: number): Vec3` — studio-local desk transformed into world space.
  - `worldRoomTable(studioIndex: number): Vec3` — the room's collaboration-table world position.
  - `COURTYARD_ANCHORS: Record<'dining'|'sport'|'lounge'|'garden', Vec3>` — world-space activity spots.

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, expect, it } from 'vitest';
import { worldDeskPosition, worldRoomTable, COURTYARD_ANCHORS } from './campus-world-layout';
import { calculateStudioPlacement } from './campus-layout';

describe('campus world layout', () => {
  it('places a desk near its studio origin in world space', () => {
    const p = calculateStudioPlacement(0);
    const desk = worldDeskPosition(0, 0);
    // desk should be within a studio-radius of the studio placement
    const dx = desk[0] - p.position[0];
    const dz = desk[2] - p.position[2];
    expect(Math.hypot(dx, dz)).toBeLessThan(12);
  });

  it('is deterministic', () => {
    expect(worldDeskPosition(1, 2)).toEqual(worldDeskPosition(1, 2));
    expect(worldRoomTable(1)).toEqual(worldRoomTable(1));
  });

  it('exposes courtyard anchors distinct from each other', () => {
    const vals = Object.values(COURTYARD_ANCHORS).map((v) => v.join(','));
    expect(new Set(vals).size).toBe(vals.length);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `pnpm --filter @campus/web test campus-world-layout`
Expected: FAIL.

- [ ] **Step 3: Implement**

```typescript
import { calculateStudioPlacement } from './campus-layout';
import { deskPosition } from './studio-layout';
import { STUDIO_ANCHORS } from './studio-layout';

export type Vec3 = [number, number, number];

/** Rotate a studio-local point by the studio's Y rotation and translate to its world origin. */
function toWorld(studioIndex: number, local: Vec3): Vec3 {
  const { position, rotationY } = calculateStudioPlacement(studioIndex);
  const cos = Math.cos(rotationY);
  const sin = Math.sin(rotationY);
  const x = local[0] * cos + local[2] * sin;
  const z = -local[0] * sin + local[2] * cos;
  return [position[0] + x, position[1] + local[1], position[2] + z];
}

export function worldDeskPosition(studioIndex: number, deskIndex: number): Vec3 {
  return toWorld(studioIndex, deskPosition(deskIndex));
}

export function worldRoomTable(studioIndex: number): Vec3 {
  return toWorld(studioIndex, STUDIO_ANCHORS.planningTable);
}

/** World-space courtyard activity spots (the central hub area, radius < studio ring). */
export const COURTYARD_ANCHORS: Record<'dining' | 'sport' | 'lounge' | 'garden', Vec3> = {
  dining: [6, 0, 4],
  sport: [6, 0, -5],
  lounge: [0, 0, -7],
  garden: [0, 0, 8],
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter @campus/web test campus-world-layout`
Expected: PASS. (If the rotation sign makes the desk land too far, flip the `sin` signs in `toWorld` — the assertion `< 12` guards correctness.)

- [ ] **Step 5: Commit**

```bash
git add apps/web/selectors/campus-world-layout.ts apps/web/selectors/campus-world-layout.test.ts
git commit -m "feat(web): world-space desk + courtyard layout math"
```

---

### Task 5: NavMesh navigation helper (`three-pathfinding`)

**Files:**
- Create: `apps/web/lib/campusNav.ts`
- Test: `apps/web/lib/campusNav.test.ts`
- Modify: `apps/web/package.json` (add dependency)

**Interfaces:**
- Produces:
  - `nextPathPoint(path: Vec3[], current: Vec3, step: number): { point: Vec3; index: number; arrived: boolean }` — pure follower: advance `step` metres along a corner list.
  - `buildCampusZone(ground: THREE.BufferGeometry): void` and `findCampusPath(from: Vec3, to: Vec3): Vec3[]` — thin `three-pathfinding` wrappers (browser/scene use).

- [ ] **Step 1: Add the dependency**

Run:
```bash
pnpm --filter @campus/web add three-pathfinding
```
Expected: `three-pathfinding` added to `apps/web/package.json`.

- [ ] **Step 2: Write the failing test (pure follower only)**

```typescript
import { describe, expect, it } from 'vitest';
import { nextPathPoint } from './campusNav';

describe('nextPathPoint', () => {
  const path: [number, number, number][] = [
    [0, 0, 0],
    [10, 0, 0],
  ];

  it('advances toward the next corner by step', () => {
    const r = nextPathPoint(path, [0, 0, 0], 1);
    expect(r.point[0]).toBeCloseTo(1, 5);
    expect(r.arrived).toBe(false);
  });

  it('arrives at the final corner', () => {
    const r = nextPathPoint(path, [9.5, 0, 0], 1);
    expect(r.point).toEqual([10, 0, 0]);
    expect(r.arrived).toBe(true);
  });
});
```

- [ ] **Step 3: Run it and watch it fail**

Run: `pnpm --filter @campus/web test campusNav`
Expected: FAIL.

- [ ] **Step 4: Implement**

```typescript
import * as THREE from 'three';
import { Pathfinding } from 'three-pathfinding';
import type { Vec3 } from '../selectors/campus-world-layout';

const ZONE = 'campus';
const pathfinding = new Pathfinding();
let ready = false;

/** Build the navmesh zone once from the authored nav ground geometry. */
export function buildCampusZone(ground: THREE.BufferGeometry): void {
  pathfinding.setZoneData(ZONE, Pathfinding.createZone(ground));
  ready = true;
}

/** Path between two world points along the navmesh, or a straight segment if not ready. */
export function findCampusPath(from: Vec3, to: Vec3): Vec3[] {
  if (!ready) return [from, to];
  const start = new THREE.Vector3(...from);
  const end = new THREE.Vector3(...to);
  const group = pathfinding.getGroup(ZONE, start);
  const path = pathfinding.findPath(start, end, ZONE, group);
  if (!path || path.length === 0) return [from, to];
  return path.map((p) => [p.x, p.y, p.z] as Vec3);
}

/** Pure follower: advance `step` metres from `current` toward the next unreached corner. */
export function nextPathPoint(
  path: Vec3[],
  current: Vec3,
  step: number,
): { point: Vec3; index: number; arrived: boolean } {
  if (path.length === 0) return { point: current, index: 0, arrived: true };
  const target = path[path.length - 1]!;
  const dx = target[0] - current[0];
  const dz = target[2] - current[2];
  const dist = Math.hypot(dx, dz);
  if (dist <= step || dist === 0) return { point: [target[0], current[1], target[2]], index: path.length - 1, arrived: true };
  const k = step / dist;
  return { point: [current[0] + dx * k, current[1], current[2] + dz * k], index: path.length - 1, arrived: false };
}
```

Note: `nextPathPoint` here follows the final corner directly for the two-point paths this task tests; corner-by-corner traversal is layered in Phase 3 where the scene consumes `findCampusPath`. Keep this signature stable.

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm --filter @campus/web test campusNav`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/lib/campusNav.ts apps/web/lib/campusNav.test.ts apps/web/package.json pnpm-lock.yaml
git commit -m "feat(web): add three-pathfinding navmesh helper + pure path follower"
```

---

### Task 6: Orthographic isometric camera + controls

**Files:**
- Modify: `apps/web/components/campus/CampusScene.tsx`
- Modify: `apps/web/components/campus/CampusCameraController.tsx`

**Interfaces:**
- Consumes: store `camera` state (`mode`, `focusedProjectId`, `followedAgentId`) — unchanged.
- Produces: an `OrthographicCamera` scene whose target/zoom the controller tweens; selection wiring untouched so dock/agent clicks still focus.

- [ ] **Step 1: Read the current camera components**

Run: `sed -n '1,200p' apps/web/components/campus/CampusScene.tsx apps/web/components/campus/CampusCameraController.tsx`
Expected: understand current `<Canvas>` camera + controller math before editing.

- [ ] **Step 2: Switch the Canvas to an orthographic isometric camera**

In `CampusScene.tsx`, set the Canvas to orthographic and add drei `OrbitControls` (import from `@react-three/drei`). Replace the camera config:

```tsx
<Canvas
  orthographic
  camera={{ position: [24, 24, 24], zoom: 34, near: 0.1, far: 400 }}
  shadows
  gl={{ antialias: true, preserveDrawingBuffer: true }}
  data-testid="campus-canvas"
>
  {/* ...scene... */}
  <OrbitControls
    makeDefault
    enablePan
    enableRotate
    minZoom={16}
    maxZoom={90}
    minPolarAngle={Math.PI / 6}
    maxPolarAngle={Math.PI / 3}
    mouseButtons={{ LEFT: undefined, MIDDLE: 2, RIGHT: 0 }}
  />
</Canvas>
```

Keep the existing `data-testid="campus-canvas"` so `redesign-smoke` still finds the canvas.

- [ ] **Step 3: Re-express the controller as an ortho target/zoom tween**

Rewrite `CampusCameraController.tsx` to, each frame, lerp the camera position toward an offset from the focus target and lerp `camera.zoom` (calling `camera.updateProjectionMatrix()`), based on `mode`:

```tsx
'use client';
import { useRef } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useCampusStore } from '../../stores/campusStore';
import { calculateStudioPlacement } from '../../selectors/campus-layout';

const CAMPUS = { target: new THREE.Vector3(0, 0, 0), zoom: 34 };

export function CampusCameraController() {
  const { camera } = useThree();
  const mode = useCampusStore((s) => s.camera.mode);
  const focusedProjectId = useCampusStore((s) => s.camera.focusedProjectId);
  const projects = useCampusStore((s) => s.projects);
  const target = useRef(new THREE.Vector3());

  useFrame((_, delta) => {
    let want = CAMPUS.target.clone();
    let zoom = CAMPUS.zoom;
    if ((mode === 'room' || mode === 'follow') && focusedProjectId) {
      const idx = Object.keys(projects).indexOf(focusedProjectId);
      if (idx >= 0) {
        const p = calculateStudioPlacement(idx);
        want = new THREE.Vector3(p.position[0], 0, p.position[2]);
        zoom = 70;
      }
    }
    target.current.lerp(want, Math.min(1, delta * 2.5));
    const offset = new THREE.Vector3(18, 18, 18);
    camera.position.lerp(target.current.clone().add(offset), Math.min(1, delta * 2.5));
    camera.lookAt(target.current);
    const ortho = camera as THREE.OrthographicCamera;
    ortho.zoom = THREE.MathUtils.lerp(ortho.zoom, zoom, Math.min(1, delta * 2.5));
    ortho.updateProjectionMatrix();
  });
  return null;
}
```

(If `CampusCameraController` currently owns OrbitControls, remove that; controls now live in `CampusScene`. If the existing controller reads different store shape, adapt to the real fields seen in Step 1.)

- [ ] **Step 4: Build + smoke the UI**

Run: `pnpm --filter @campus/web build && pnpm test:redesign`
Expected: build PASS; redesign smoke PASS (canvas fills viewport, dock focus still works, no console errors). If OrbitControls' default mouse mapping conflicts, adjust `mouseButtons` so left-drag doesn't hijack agent clicks.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/campus/CampusScene.tsx apps/web/components/campus/CampusCameraController.tsx
git commit -m "feat(web): orthographic isometric camera with orbit/pan/zoom"
```

---

### Task 7: Architectural rooms with capability-gated glass

**Files:**
- Modify: `apps/web/components/studio/StudioPlatform.tsx` (floor + metallic-framed glass partitions)
- Modify: `apps/web/components/studio/AgentDesk.tsx` (futuristic desk + multiple emissive monitors + chair)
- Create: `apps/web/components/studio/GlassPanel.tsx` (capability-gated glass material)

**Interfaces:**
- Consumes: `detectRenderCapability()` from `lib/renderCapability`.
- Produces: `GlassPanel` React component rendering `meshPhysicalMaterial` (transmission) in `'full'`, frosted `meshStandardMaterial` (transparent) in `'fallback'`.

- [ ] **Step 1: Create the capability-gated glass panel**

```tsx
'use client';
import { useMemo } from 'react';
import { detectRenderCapability } from '../../lib/renderCapability';

export function GlassPanel(props: JSX.IntrinsicElements['mesh'] & { size: [number, number, number]; tint?: string }) {
  const cap = useMemo(() => detectRenderCapability(), []);
  const { size, tint = '#bcd4e0', ...mesh } = props;
  return (
    <mesh {...mesh}>
      <boxGeometry args={size} />
      {cap === 'full' ? (
        <meshPhysicalMaterial
          transmission={0.9}
          thickness={0.4}
          roughness={0.15}
          ior={1.3}
          transparent
          opacity={0.6}
          color={tint}
        />
      ) : (
        <meshStandardMaterial transparent opacity={0.28} color={tint} roughness={0.4} />
      )}
    </mesh>
  );
}
```

- [ ] **Step 2: Read the current studio components**

Run: `sed -n '1,200p' apps/web/components/studio/StudioPlatform.tsx apps/web/components/studio/AgentDesk.tsx`
Expected: know the current geometry/props before editing.

- [ ] **Step 3: Upgrade the room — floor + metallic-framed glass walls**

In `StudioPlatform.tsx`, add a solid floor and replace bare walls with metallic frames + `GlassPanel` inserts (keep existing accent prop and dimensions). Example additions:

```tsx
import { GlassPanel } from './GlassPanel';
// floor
<mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
  <planeGeometry args={[16, 15]} />
  <meshStandardMaterial color="#e7e3da" roughness={0.85} />
</mesh>
// a metallic-framed glass side wall (repeat/position per side)
<group position={[8, 1.6, 0]}>
  <mesh castShadow>
    <boxGeometry args={[0.12, 3.2, 15]} />
    <meshStandardMaterial color="#8b93a1" metalness={0.8} roughness={0.3} />
  </mesh>
  <GlassPanel size={[0.06, 3, 14.6]} position={[0, 0, 0]} />
</group>
```

- [ ] **Step 4: Upgrade the desk — multiple emissive monitors + chair**

In `AgentDesk.tsx`, add a second/third monitor and an office chair behind the desk, using emissive material tied to the existing `monitor` kind:

```tsx
// extra monitor
<mesh position={[0.5, 1.15, -0.2]} rotation={[0, -0.3, 0]} castShadow>
  <boxGeometry args={[0.5, 0.32, 0.03]} />
  <meshStandardMaterial color="#10151c" emissive="#2b6cb0" emissiveIntensity={monitor === 'off' ? 0 : 0.5} />
</mesh>
// office chair
<group position={[0, 0, 0.9]}>
  <mesh position={[0, 0.5, 0]} castShadow><boxGeometry args={[0.5, 0.08, 0.5]} /><meshStandardMaterial color="#2b2f36" /></mesh>
  <mesh position={[0, 0.8, -0.24]} castShadow><boxGeometry args={[0.5, 0.6, 0.08]} /><meshStandardMaterial color="#2b2f36" /></mesh>
  <mesh position={[0, 0.26, 0]}><cylinderGeometry args={[0.04, 0.04, 0.5, 8]} /><meshStandardMaterial color="#4a5160" /></mesh>
</group>
```

- [ ] **Step 5: Build + screenshots**

Run: `pnpm --filter @campus/web build && pnpm screenshots`
Expected: build PASS; screenshots regenerate with no console errors (fallback glass path in headless). Then Read `docs/images/project-room.png` and confirm floor/desks/monitors/chairs/glass render and nothing overlaps the agents.

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/studio/GlassPanel.tsx apps/web/components/studio/StudioPlatform.tsx apps/web/components/studio/AgentDesk.tsx docs/images
git commit -m "feat(web): architectural rooms with metallic-framed glass + richer desks"
```

---

### Task 8: Courtyard + NavMesh ground + cinematic lighting/bloom

**Files:**
- Create: `apps/web/components/campus/Courtyard.tsx`
- Modify: `apps/web/components/campus/CampusHub.tsx` (host courtyard; keep shared-area labels)
- Modify: `apps/web/components/campus/CampusScene.tsx` (lighting + gated bloom)
- Modify: `apps/web/package.json` (add `@react-three/postprocessing`)

**Interfaces:**
- Consumes: `COURTYARD_ANCHORS` (Task 4), `buildCampusZone` (Task 5), `detectRenderCapability` (Task 3).
- Produces: `<Courtyard onNavGround={(geom) => buildCampusZone(geom)} />` — renders sports court + dining + walkways and registers the nav ground.

- [ ] **Step 1: Add postprocessing dependency**

Run: `pnpm --filter @campus/web add @react-three/postprocessing postprocessing`
Expected: both added to `apps/web/package.json`.

- [ ] **Step 2: Build the Courtyard component**

```tsx
'use client';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoundedBox } from '@react-three/drei';
import { COURTYARD_ANCHORS } from '../../selectors/campus-world-layout';

/** Outdoor hub: nav ground (flat), sports court, dining tables, lounge, walkways. */
export function Courtyard({ onNavGround }: { onNavGround?: (geom: THREE.BufferGeometry) => void }) {
  const ground = useRef<THREE.Mesh>(null);
  useEffect(() => {
    if (ground.current && onNavGround) onNavGround(ground.current.geometry as THREE.BufferGeometry);
  }, [onNavGround]);

  return (
    <group>
      {/* flat nav ground covering the central courtyard (fed to three-pathfinding) */}
      <mesh ref={ground} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.06, 0]} receiveShadow>
        <planeGeometry args={[34, 34, 1, 1]} />
        <meshStandardMaterial color="#cfd4cc" roughness={1} />
      </mesh>

      {/* sports court */}
      <group position={COURTYARD_ANCHORS.sport}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.08, 0]}>
          <planeGeometry args={[4, 2.6]} />
          <meshStandardMaterial color="#3f6f5f" roughness={0.9} />
        </mesh>
        <mesh position={[0, 0.5, 0]}><boxGeometry args={[0.05, 1, 2.6]} /><meshStandardMaterial color="#ffffff" /></mesh>
      </group>

      {/* dining/lounge */}
      <group position={COURTYARD_ANCHORS.dining}>
        {[-1.2, 1.2].map((x) => (
          <group key={x} position={[x, 0, 0]}>
            <mesh position={[0, 0.7, 0]} castShadow><cylinderGeometry args={[0.6, 0.6, 0.08, 16]} /><meshStandardMaterial color="#d7cfc1" /></mesh>
            <mesh position={[0, 0.35, 0]}><cylinderGeometry args={[0.08, 0.08, 0.7, 8]} /><meshStandardMaterial color="#9c917f" /></mesh>
          </group>
        ))}
      </group>

      {/* walkways: courtyard -> ring (four glowing paths) */}
      {[0, 90, 180, 270].map((deg) => {
        const r = (deg * Math.PI) / 180;
        return (
          <mesh key={deg} rotation={[-Math.PI / 2, 0, r]} position={[Math.sin(r) * 12, 0.07, Math.cos(r) * 12]}>
            <planeGeometry args={[2.2, 14]} />
            <meshStandardMaterial color="#9fb6c9" emissive="#3a6ea5" emissiveIntensity={0.15} roughness={0.8} />
          </mesh>
        );
      })}
    </group>
  );
}
```

- [ ] **Step 3: Wire Courtyard into the hub + register the nav zone**

In `CampusHub.tsx`, render `<Courtyard onNavGround={buildCampusZone} />` (import `buildCampusZone` from `lib/campusNav`), keeping the existing shared-area labels as overlays.

- [ ] **Step 4: Cinematic lighting + gated bloom in CampusScene**

Add a directional sun with soft shadows and, only in `'full'`, an `EffectComposer` + `Bloom`:

```tsx
import { EffectComposer, Bloom } from '@react-three/postprocessing';
import { detectRenderCapability } from '../../lib/renderCapability';
const cap = detectRenderCapability(); // module/component scope
// lights
<ambientLight intensity={0.6} />
<directionalLight position={[20, 30, 10]} intensity={1.1} castShadow shadow-mapSize={[2048, 2048]} />
// effects (full only)
{cap === 'full' && (
  <EffectComposer>
    <Bloom intensity={0.6} luminanceThreshold={0.7} mipmapBlur />
  </EffectComposer>
)}
```

- [ ] **Step 5: Build + screenshots + inspect**

Run: `pnpm --filter @campus/web build && pnpm screenshots`
Expected: build PASS; screenshots regenerate cleanly (headless = fallback: no bloom, frosted glass, no console errors). Read `docs/images/campus-overview.png` and confirm courtyard (sports court, dining, walkways) renders and reads well.

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/campus/Courtyard.tsx apps/web/components/campus/CampusHub.tsx apps/web/components/campus/CampusScene.tsx apps/web/package.json pnpm-lock.yaml docs/images
git commit -m "feat(web): outdoor courtyard, navmesh ground, cinematic lighting + gated bloom"
```

---

### Task 9: Phase 1–2 verification gate

**Files:** none (verification only)

- [ ] **Step 1: Full suite**

Run:
```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```
Expected: all PASS. Fix any failure before proceeding.

- [ ] **Step 2: Browser regen + inspect**

Run: `pnpm screenshots`
Then Read each `docs/images/*.png` and confirm: isometric framing, courtyard, architectural rooms, Uzbek names in the roster, no debug data, no overlaps.

- [ ] **Step 3: e2e**

Run: `pnpm test:e2e`
Expected: ALL SMOKE CHECKS PASSED.

- [ ] **Step 4: Commit any screenshot updates**

```bash
git add docs/images
git commit -m "chore(web): regenerate campus screenshots for phase 1-2"
```

---

## Self-Review

- **Spec coverage (Phase 1–2):** Uzbek pool (T1) ✓; honest utilization (T2) ✓; ortho isometric camera + pan/zoom/orbit (T6) ✓; architectural rooms + glass w/ fallback (T7) ✓; courtyard sports/dining/walkways (T8) ✓; cinematic lighting + gated bloom (T8) ✓; world-space layout math + navmesh ground/helper foundation for Phase 3 (T4, T5, T8) ✓. Humanoid rig, nav *behaviour*, collaboration huddle, and the glassmorphism UI are Phase 3–4 — a separate plan.
- **Placeholders:** none — logic tasks carry full code + tests; visual tasks carry concrete component code + build/screenshot verification.
- **Type consistency:** `Vec3` defined in `campus-world-layout.ts` and reused by `campusNav.ts`; `detectRenderCapability`/`classifyRenderer` names consistent across T3/T7/T8; `buildCampusZone`/`findCampusPath`/`nextPathPoint` names consistent across T5/T8.
- **Note:** T6 and T7 edit files whose exact current contents must be read first (Steps included). Adapt geometry to real props; the verification is build + screenshot inspection.
