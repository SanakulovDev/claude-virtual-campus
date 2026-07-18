# In-campus actions (observe-only)

Date: 2026-07-18

Give the user direct controls inside the campus UI, without breaking the campus's
non-negotiable rule: it **observes** real Claude Code activity and never commands Claude or
invents agent work. Data flow stays one-directional (CLI → hooks → API → UI); the only new
server mutation is deleting a room the user no longer wants to watch.

Three actions, each mapped honestly to that model:

1. **Delete a room** — stop watching a project (a real server mutation, but only deletion).
2. **Rest idle bots** — a cosmetic client-only sleep pose for genuinely idle agents.
3. **Add a room** — a convenience surface that shows the real `campus install` command; it
   drives nothing.

The one thing explicitly **rejected** during design: "assign tasks to the space." That would
make the campus command Claude, inverting the observer architecture. Out of scope.

## 1. Delete a room ("Remove from campus")

### API
- `DELETE /api/projects/:projectId` on `ProjectsController` → `ProjectsService.remove(projectId)`.
- `remove` does `prisma.project.delete({ where: { id } })`. All of `ClaudeSession`,
  `ProjectAgent`, `ClaudeEvent`, `ToolExecution`, `Task`, technologies and modules are
  `onDelete: Cascade` from `Project`, so one delete clears the room entirely.
- Throws `NotFoundException` if the project does not exist (so a double-delete is a clean 404).
- After deleting, `realtime.emitToCampus(SOCKET_EVENTS.projectRemoved, { projectId })` so every
  connected tab drops the room, not just the one that clicked.

### Contract
- Add `projectRemoved: 'project:removed'` to `SOCKET_EVENTS` in `packages/contracts/src/socket.ts`.

### Client
- `lib/socket.ts`: `removeProject(projectId)` → `fetch(DELETE /api/projects/:id)`.
- Store `removeProject(projectId)` action: delete from `projects`; if it was the selected or
  camera-focused project, clear selection + return camera to overview.
- `useCampusSocket`: subscribe to `projectRemoved` → `store.removeProject(projectId)`.
- `InspectorDrawer` `ProjectInspector`: a rose "Remove from campus" button with a two-click
  inline confirm (same pattern as `RenameControl`'s edit toggle). Confirm label states the
  event count being deleted.

### Honesty
Button help text: "Removes this room and its history. It returns if the project sends new
activity." A live project genuinely reappears on its next hook event — delete targets stale or
unwanted rooms, and this is the same cascade `pnpm db:prune` already performs, just per-room
and user-triggered.

## 2. Rest idle bots (client-only, cosmetic)

Ambient life is already a purely client-side cosmetic layer; "rest" is a sibling of it and
touches no backend, so no honesty rule is involved.

### Store
- `restingAgentIds: Record<string, true>` (plain object, not `Set`, to stay serializable and
  match existing store style).
- `toggleAgentRest(agentId)`: add/remove one id.
- `restAllIdle()`: add every agent that is currently `idle` (via `selectAgentVisualState`).
- `wakeAllBots()`: clear the set.
- Auto-wake: in `upsertAgent`, if the merged agent is no longer `idle`, drop its id from the
  set. This guarantees a real Claude event wakes a resting bot, and keeps the global
  "any resting?" state honest.

### Avatar (`AgentAvatar`)
- New `resting?: boolean` prop. When `resting` **and** idle: optic, collar and antenna
  emissive drop to ~0.12; torso slumps lower than the seated pose; arms hang; a slow breathing
  bob; a small "Zzz" label. This branch takes precedence over the ambient sway.
- Resting is only meaningful while idle; real work poses always win because the pose is gated
  on visual state.

### Ambient interaction
- A resting bot must not wander. Where `ProjectStudio` computes ambient + passes it to the
  avatar, force ambient to `null` when the agent is resting. `useAmbientActivity` also returns
  `null` for a resting agent so no ambient target is produced.

### UI
- `AgentInspector`: per-bot "Rest" / "Wake" button.
- `CampusTopBar`: "Rest idle bots" button next to "Ambient life"; switches to "Wake all" when
  any bot is resting.
- `AgentLabel`: shows "Resting" when the bot is resting (like the ambient label).

### Not doing
No server persistence — rest state resets on reload, exactly like the ambient toggle. No new
socket events (purely local).

## 3. Add a room (connect shortcut)

- `CampusTopBar`: "Add project" button opens a small popover (client-only, no modal library):
  > Run this inside any project to connect it:
  > `campus install`
  with a copy-to-clipboard button, and a line noting the room appears after the first Claude
  event.
- Drives nothing. It is a convenience surface for the terminal `campus install` flow built in
  the previous change; it cannot mint a real room because rooms come only from real hook events.

## Testing

- **API integration** (`campus_test` schema): create a project row, `DELETE`, assert it is
  gone and that a second delete returns 404.
- **Store unit tests**: `removeProject` clears selection/camera when the removed project was
  active; `toggleAgentRest` and `restAllIdle` set membership; auto-wake removes an id when
  `upsertAgent` makes the agent non-idle.
- **Verify**: drive the real app — delete a room and rest a bot — with before/after
  screenshots.

## Files touched

- `packages/contracts/src/socket.ts` — `projectRemoved` event.
- `apps/api/src/projects/projects.controller.ts` — `DELETE` route.
- `apps/api/src/projects/projects.service.ts` — `remove()`.
- `apps/api/test/projects.integration.test.ts` (new) — delete test.
- `apps/web/lib/socket.ts` — `removeProject()`.
- `apps/web/stores/campusStore.ts` — `removeProject`, rest state + actions, auto-wake.
- `apps/web/stores/campusStore.test.ts` — new store tests.
- `apps/web/hooks/useCampusSocket.ts` — handle `projectRemoved`.
- `apps/web/hooks/useAmbientActivity.ts` — null when resting.
- `apps/web/components/agents/AgentAvatar.tsx` — resting pose.
- `apps/web/components/agents/AgentLabel.tsx` — "Resting" label.
- `apps/web/components/campus/ProjectStudio.tsx` — pass `resting`, suppress ambient.
- `apps/web/components/ui/InspectorDrawer.tsx` — remove-room + rest/wake buttons.
- `apps/web/components/ui/CampusTopBar.tsx` — "Rest idle bots" + "Add project".
