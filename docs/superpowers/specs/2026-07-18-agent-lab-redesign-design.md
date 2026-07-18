# Agent Lab redesign + project-identity hardening

Date: 2026-07-18
Status: approved (user), pending implementation plan

## Problem

1. One real project sometimes appears as two rooms. `Project.projectKey` is unique, so
   every duplicate is the same project computing two *different* keys.
2. The campus visual (island + hex rings of separate studios around a hub) reads poorly,
   especially on a small monitor. The user wants one open-plan office ("Agent Lab"):
   adjacent rooms off a shared hallway, agents visibly walking between rooms.
3. The campus will run fullscreen on a small (~7–10", landscape) kiosk monitor with zero
   interaction; the current HUD + free orbit camera don't fit that.

Out of scope this round: sending commands/prompts from the campus UI to Claude agents.

## Part A — one project = one room (backend)

All identity work stays inside `packages/project-inspector` + `apps/api/src/projects`,
per architecture boundaries. Known causes and fixes:

### A1. Remote fallback (`git.ts`)
`resolveGitInfo` only reads `git remote get-url origin`. Repos whose remote is named
differently (e.g. `upstream`) or that gain `origin` later fall to the `path:` key and
fork a room when the remote appears. Fix: when `origin` is absent, list remotes
(`git remote`) and use the first one; only fall back to `path:` when there are zero
remotes.

### A2. Remote URL normalization (`projectKey.ts`)
`normalizeRemoteUrl` must additionally strip embedded userinfo
(`https://user:token@host/...` → `https://host/...`) and default ports
(`ssh://git@host:22/...` → same hash as `git@host:...` scp form). Same repo, one hash.

### A3. Non-git stable anchor (`resolveProject.ts` / `projectKey.ts`)
Non-git projects are keyed by raw `cwd`: subdirectory launches and symlinked paths
(macOS `/tmp` vs `/private/tmp`) each mint a new room. Fix: resolve the anchor as
`fs.realpath(cwd)`, then walk up to the nearest ancestor directory containing
`.claude/` (the campus installer guarantees one at the project root); the walk stops
before the user's home directory and the filesystem root (`~/.claude` is Claude Code's
own config, never a project root); if none found, use `realpath(cwd)` itself. Applies only to the `path:` branch; git repos keep
`--show-toplevel` root behavior.

### A4. Transient-failure guard widened (`git.ts`)
`isTransientGitFailure` only treats `killed === true` (timeout) as transient. Broaden
to: any signal-terminated process, and errno `EAGAIN`/`EMFILE`/`ENOMEM`/`ETIMEDOUT`.
These throw `GitUnavailableError` (event dropped, hooks fail open) instead of
downgrading identity to `path:`. Matches the existing timeout rationale in CLAUDE.md.

### A5. Atomic upsert + key upgrade (`projects.service.ts`)
Replace find-then-create with atomic `prisma.project.upsert({ where: { projectKey } })`
(closes the race that 500s and drops the second concurrent first-event). Additionally:
when the resolved key is `remote:*` and no row matches it, look up a row whose
`rootPath` equals the resolved root and whose key is `path:*`; if found, update that
row's `projectKey` to the new remote key instead of creating a new row. Remote-added-
later migrates the existing room instead of forking. Both steps run inside one
transaction.

### A6. One-time dedupe script
`pnpm db:dedupe` (script in `apps/api`, like `db:prune`): find Project rows sharing the
same `rootPath`, keep the row with the `remote:*` key (or the oldest if all `path:*`),
re-point sessions/agents/events/tool executions to the survivor, delete the rest.
`--dry-run` supported. Never runs automatically.

### A tests
- Unit (`project-inspector`): remote fallback order, normalization cases (userinfo,
  ports, scp/ssh equivalence), non-git anchor walk-up + realpath, transient classification.
- Integration (`apps/api`, real Postgres): repo without remote emits event → room;
  add remote → next event → same single row, key upgraded. Concurrent first events →
  one row, no lost event.

## Part B — Agent Lab floorplan (frontend, world-space)

Replaces the island/hub/hex-ring layout. One building, corridor-spine growth:

- Entrance core at one end: lounge (sofa/coffee) + one **shared review area** (big
  screen). The per-studio ReviewScreen is removed.
- Hallway spine runs lengthwise; rooms attach in pairs left/right, fixed room size,
  position derived from project array index (same index-driven philosophy as today).
  Building shell (floor slab, outer walls, roofless) sized from project count. Unbounded.
- Per room: agent desks (rows), one small planning table, open doorway to the hallway,
  project name + status color strip above the doorway.

New/changed modules (`apps/web`):
- `selectors/office-layout.ts` — replaces `campus-layout.ts` + `studio-layout.ts`:
  world-space room origins, desk/table anchors, doorway positions, hallway spine,
  core anchors (lounge seats, review spots), building dimensions.
- `selectors/routing.ts` — waypoint path between two world points: current position →
  own doorway → along hallway → destination doorway → target. Pure function, no navmesh.
- Movement: `AgentAvatar` walks a waypoint array segment-by-segment (extends the
  existing single-target lerp). Debounce rules in `selectors/movement.ts` unchanged.
- Visual-state mapping changes: `checking` now targets the shared review area (real
  cross-room traffic); `planning` → own room table; `working`/`completed`/`idle` → own
  desk; `attention` → stay put + beacon (unchanged).
- Ambient idle (`selectors/ambient.ts` + `useAmbientActivity.ts`): destination pool
  re-targeted to world space — lounge, coffee, hallway stroll, and visiting a
  neighboring room. Still cosmetic, still stops on any real event, still produces no
  events.
- Components: `OfficeBuilding` (shell/floor/hallway), `OfficeRoom` (partitions,
  doorway, sign, desks, table), `OfficeCore` (lounge + shared review). Old `CampusHub`,
  `StudioPlatform`, `ReviewScreen`-per-studio, `CampusEnvironment` island replaced.
- Cleanup: delete dead layout in `packages/contracts` (`calculateRoomPosition`,
  `MEDIUM_ROOM_ZONES`, zone constants) **and** its API usage; the persisted
  `roomPositionX/Z`/`roomTemplate` columns remain in the schema (ignored, as today) —
  no migration.

## Part C — look

- Camera: fixed-angle **orthographic isometric**. Normal browser mode keeps orbit
  (pan/zoom, damped) with the isometric angle as default; existing campus/room/follow
  store modes are preserved on top of the ortho camera.
- Palette (`lib/theme.ts` rewrite): warm office — wood floor, white walls, glass
  partitions, plants, warm lighting. Project accent hue (existing `projectAccent()`)
  colors each room's door strip + desk details.
- Agents: `AgentAvatar` geometry rewritten as low-poly office people (body, head, hair,
  shirt = role tint). Poses: typing, walking (leg swing), sitting at table, coffee,
  sleeping, celebrate. Overhead status icon/label (`AgentLabel`) kept.
- LOD kept: distant rooms drop interior detail (`studioDetailLevel` equivalent).

## Part D — kiosk mode (small monitor)

`?kiosk=1` query param:
- Hides all HUD panels (top bar, dock, analytics, timeline, drawers); scene fullscreen.
- Orbit input disabled; labels scaled up; pixel-ratio cap lowered (dpr [1, 1.25]).
- **Auto-director camera**: default frames the whole building; when a room has an
  event burst, ease-zoom to it; after ~20s without events, return to overview;
  `attention` anywhere overrides focus immediately + a red edge flash. Approval
  requests still surface visually (beacon + flash) even though the drawer is hidden —
  approvals are handled from a normal browser session, not the kiosk.

## Testing

- Unit: office-layout anchors, routing waypoints (doorway ordering, hallway clamping),
  visual-state → location mapping, ambient world-space pool.
- Integration: Part A suite above.
- Existing gates all green: `pnpm lint`, `typecheck`, `test`, `build`, `test:e2e`
  (screenshot/e2e suites updated for the new scene where they assert visuals).
- Manual: `pnpm demo:events` / `demo:attention` to watch movement + kiosk mode.

## Rollout order

1. Part A (independent, small, fixes live pain) — own plan + PR.
2. Parts B+C+D (the redesign) — second plan, built on approved look decisions:
   isometric open office, corridor spine, low-poly people, kiosk 7–10" landscape.
