# Premium 3D Campus Overhaul — Design (V2: Ultra-Realistic & Humanoid Simulation)

Date: 2026-07-12
Status: Approved (design), pending spec review

## Goal

Transform the campus into a highly detailed, ultra-realistic isometric HQ: real
architectural rooms, an outdoor courtyard (sports + dining), procedural **humanoid** robot
agents with lifelike programmatic animation, and NavMesh-driven navigation so idle agents
physically walk out to the courtyard and back — all behind a premium glassmorphism UI, and
all within the project's non-negotiable rules and a green automated pipeline.

## Non-negotiable constraints (from CLAUDE.md)

- **No fake data.** Visual "discussion" (facing each other, pointing/explaining gestures) is
  allowed; fabricated dialog/transcripts are not. No fabricated CPU/telemetry.
- **No raw hook payloads to the frontend** — normalized shapes only.
- **Ambient life stays cosmetic:** no events/tools/tasks/transcripts, labelled "Ambient
  activity", stops instantly on real work, frozen during approval/attention, toggle +
  reduced-motion respected.
- **Universal-project support:** no language-specific branches in core logic.
- **Pipeline stays green,** including the headless screenshot/e2e run on software WebGL
  (asserts no console errors) — so every heavy visual needs a low-cost fallback.

## Confirmed decisions

1. **Uzbek names**, default + `campus.json`-configurable; name separate from role;
   deterministic, no dupes; `Claude`/Team Lead stays for main.
2. **Honest metrics only** — utilization = share of recent time an agent was actually active,
   from real events. No CPU. "Transcript" = current observable action + recent real-hook list.
3. **Keep tests + screenshots green** — glass/bloom + humanoid + navmesh all have low-poly /
   static fallbacks; selection wiring preserved; screenshots regenerated.
4. **Procedural humanoid rig** (jointed, in-code) — not external rigged/mocap model files.
5. **Full NavMesh** navigation via `three-pathfinding`.

## Enabling architecture change: world-space agent layer

Today each agent is rendered inside its studio's local `<group>` (studio-local
coordinates). To let agents path between a room and the shared courtyard, agents move to a
**campus-level agent layer** rendered in world coordinates:

- A `campus-layout` module resolves each agent's **home desk** to a world-space position
  (studio placement transform × studio-local desk position) and exposes world-space anchors
  for courtyard activity spots and each room's collaboration table.
- Studios still render their own furniture/room; only the **agents** and their nav move up
  to the world layer.
- Store selection (`selectedAgentId`, `camera.mode`, focus/follow) is unchanged, so
  dock/agent clicks and the screenshot/e2e assertions keep working.

This refactor is the backbone of Phases 2–3 and the primary risk; it is built and verified
before the humanoid/nav behaviour lands on top.

---

## Phase 1 — Identity + honest analytics (backend + web)

- `packages/contracts/src/agents.ts`: replace `AGENT_NAME_POOL` with an Uzbek pool (≥ 20:
  `Ulug'bek, Shahnozaxon, Ahmadjon, Aziza, Javohir, Dilnoza, Sardor, Kamola, Bekzod,
  Nilufar, Jasur, Malika, Otabek, Gulnora, Sherzod, Zarina, Doniyor, Feruza, Sanjar,
  Mohira, …`). Behaviour unchanged; only pool contents.
- `apps/web/selectors/utilization.selector.ts` (pure): utilization `0..1` from the store
  timeline (recent non-idle share); `0` when no recent activity.
- **Tests:** update `agents.test.ts` + `agents.integration.test.ts` (Uzbek pool); new
  `utilization.selector.test.ts`. Regenerate `docs/images/*.png`.

## Phase 2 — Ultra-realistic architecture + camera + courtyard

- **Camera:** `OrthographicCamera` isometric + drei `OrbitControls` (pan/zoom/orbit,
  clamped polar angle). `CampusCameraController` re-expressed to tween the ortho camera
  target/zoom from the same store selection.
- **Rooms:** real architectural rooms — floor, futuristic desks with multiple emissive
  monitors, office chairs, glass partitions with metallic frames. Glass via
  `meshPhysicalMaterial` (transmission/roughness/thickness) with a **capability fallback**
  (`lib/renderCapability.ts`) to a frosted `meshStandardMaterial` on software/limited WebGL.
- **Courtyard (outdoor hub):** recreation zone (mini sports court), dining/lounge
  (cafeteria tables), walkways connecting rooms ↔ courtyard. Replaces/absorbs the current
  shared-areas hub.
- **Lighting:** soft ambient + directional sun + soft shadows + emissive accents; optional
  `@react-three/postprocessing` Bloom, **disabled in fallback**.
- **NavMesh ground:** author a flat nav ground mesh covering room floors + walkways +
  courtyard; feed it to `three-pathfinding` as the campus zone (used in Phase 3).
- **Tests:** `renderCapability` unit test; a `campus-layout` world-anchor unit test; build +
  screenshots (fallback) clean and re-inspected.

## Phase 3 — Humanoid robots + advanced life simulation

- **Procedural humanoid rig** replacing the capsule avatar: distinct head, torso, arms,
  hands, legs, feet; role-tinted cybernetic look with emissive trim/visor; role accessories
  retained; drei `<Html>` name pill (Uzbek name + role + state/ambient). One rig, not a
  model per role. Cheap enough for software-WebGL fallback (no skinned meshes).
- **Programmatic animations** driven by a small per-agent state machine:
  `idle | walking | sitting | typing | eating | sport | discussing`. Frame-loop poses
  (leg/arm swing for walk, seated + typing hands, eating hand-to-head, pointing for
  discuss).
- **NavMesh movement (`three-pathfinding`):** agents compute a path along the campus zone
  and follow it corner-to-corner between home desk, room collaboration table, and courtyard
  activity spots.
- **Advanced ambient life (idle):** idle-eligible agents path out to the courtyard and
  sit/eat/exercise/gather (facing the group centroid, pointing gestures — no dialog). All
  ambient rules still hold (idle-only, stops on real work, frozen on approval/attention,
  toggle + reduced-motion, labelled "Ambient activity").
- **Task interruption + collaboration huddle:**
  - A real event for an idle agent in the courtyard → it paths **back** to its room desk.
  - On the room's **planning** phase (UserPromptSubmit / planning activity) the room's agents
    briefly gather at the central table, face each other, use pointing/explaining gestures
    (visual only, tagged "Planning" — no fabricated dialog), then return to their desks.
- **Tests:** extend `ambient.test.ts` (deterministic activity/anchor + facing; grouping only
  when eligible; real event clears it; no event/tool/task produced). Pure path-follow math
  unit test (given a path, next step is deterministic).

## Phase 4 — Glassmorphism UI (DOM)

- Dark glass panels (`backdrop-blur`, translucent, glowing borders) via Tailwind;
  `framer-motion` for slide/mount transitions.
- **Left sidebar:** project statuses + agent counts. **Right/bottom:** honest utilization
  bars (labelled recent-activity share, not CPU) + campus stats + aesthetic minimap/overview
  ("Campus Status: Optimal/Busy/Attention" derived from real aggregate state).
- **Inspector:** slide-in card — Uzbek name, role, bio, current activity (incl. "Walking to
  courtyard", "Discussing plan", "Coding"), utilization, recent real hooks, Follow, Rename;
  raw ids in Developer details.
- **Tests:** update `ui.test.tsx`; assert utilization wording never implies real hardware
  telemetry.

## New dependencies (web only, all gated/fallback-safe)

- `three-pathfinding` — NavMesh path following.
- `@react-three/postprocessing` — bloom (gated behind capability check).
- `framer-motion` — UI transitions.

## Data-flow summary

- Backend/contracts change is limited to the name pool (Phase 1).
- Agent identity/state still flows from `ProjectAgent` over Socket.IO. The world-space agent
  layer and all navigation/animation are client-side presentation; the only client-generated
  motion remains the labelled ambient/planning choreography — no new events, tools, tasks or
  transcripts.
- Analytics are pure client selectors over the existing store — no new API, no fabricated data.

## Verification (every phase)

```
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm screenshots   # then visually inspect docs/images/*.png
```

Plus `pnpm test:e2e` before final completion.

## Honest feasibility notes / non-goals

- Humanoid = **procedural** jointed rig with programmatic animation, not photoreal rigged
  mocap (which would require bundled model+clip assets this repo doesn't have).
- "Discussion" is gesture/pose only — never generated dialog or transcripts.
- Utilization is a **recent-activity heuristic**, not real hardware telemetry.
- No per-language visual branches, no multiplayer, no cloud deploy.

## Build order

Per user direction, implement **Phase 1 then Phase 2** first (identity/analytics, then
architecture/camera/courtyard + navmesh ground + world-agent-layer), verifying green after
each, before Phase 3 (humanoid + nav life) and Phase 4 (UI).
