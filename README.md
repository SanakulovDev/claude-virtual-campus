# AI Virtual Campus

A living 3D office for your Claude Code and Codex projects.

Every local project becomes its own glass-walled room on a floating campus island. Claude,
Codex, and their real subagents appear as named teammates — planning, coding, testing and reviewing
in real time — under a clean, premium light UI with live analytics and a campus status bar.

![AI Virtual Campus](docs/images/campus-overview.png)

**Local-first · Multi-project · Multi-agent · Language-agnostic · Real-time 3D**

---

## What it is

Open Claude Code or Codex inside any project, give it a task, and the campus lights up: it detects
the project, gives it a room, and moves named 3D teammates as Claude actually works. It
works with **any** language — PHP, Python, Go, Rust, Java, .NET, Ruby, Node.js or anything
else — because it watches coding-agent hooks, not your build system. Nothing is scripted:
every movement is driven by a real hook event.

![A focused project room](docs/images/project-room.png)

## Key features

- **A room per project.** Each local project you connect gets its own persistent studio.
- **Real named teammates.** Main Claude/Codex agents plus the actual subagents they start, each with
  a readable name, a role and a short bio.
- **Live 3D activity.** Agents plan, work, check and celebrate as hook events arrive.
- **Ambient idle life.** Idle agents take coffee breaks and water plants — always clearly
  labelled, never mistaken for real work.
- **Approval flow.** Destructive commands pause the agent and ask for permission.
- **Premium campus UI.** Light isometric world, per-project rooms, live agent-utilization
  analytics and an at-a-glance campus status — all derived from real state, never faked.
- **Language-agnostic.** Zero assumptions about frameworks, package managers or `src/`.
- **Local-first & safe.** Observes hooks; never executes your code.

## 60-second quick start

Already have the campus cloned and installed? Two terminals:

```bash
# terminal 1 — start the campus
cd ~/Developer/claude-virtual-campus
pnpm db:up
pnpm dev
```

```bash
# terminal 2 — connect a project
cd ~/Developer/claude-virtual-campus
pnpm campus:install ~/Developer/my-project
```

```bash
# then use Claude Code or Codex as usual
cd ~/Developer/my-project
claude
# or: codex
```

Open **http://localhost:3100**, give either agent a task, and watch the project room come alive.
Keep `pnpm dev` running the whole time.

## Full installation

```bash
git clone <repository-url>
cd claude-virtual-campus

pnpm install
cp .env.example .env

pnpm db:up
pnpm db:migrate
pnpm dev
```

- Web: **http://localhost:3100**
- API: **http://localhost:4000**

`pnpm dev` runs both apps and must stay running. Requirements: Node.js ≥ 20 and Docker
(for Postgres). More in [docs/development.md](docs/development.md).

## Run with Docker (no `pnpm dev`)

To keep the campus running in the background without a dev server, run the whole stack —
Postgres, API and web — in containers:

```bash
docker compose up -d --build
```

- Web: **http://localhost:3200**
- API: **http://localhost:4000**

The API container applies database migrations on start, and all three services use
`restart: unless-stopped`, so the campus comes back automatically after a reboot. Manage it
with the usual commands:

```bash
docker compose ps          # status
docker compose logs -f     # follow logs
docker compose down        # stop everything
docker compose up -d --build   # rebuild after you change the source
```

Docker uses host port `3200` for the web app so it can coexist with `pnpm dev` on `3100`.
Its API explicitly allows both local origins. Override `CAMPUS_DOCKER_WEB_PORT` and the
comma-separated `CAMPUS_DOCKER_WEB_ORIGIN` allowlist together if needed.

You still connect projects the same way (`pnpm campus:install …`); the hooks reach the API
at `http://localhost:4000`.

## Connect a project

The same command works for every language:

```bash
pnpm campus:install ~/Developer/prog.bts
pnpm campus:install ~/Developer/laravel-shop
pnpm campus:install ~/Developer/python-worker
pnpm campus:install ~/Developer/go-service
```

Paths with spaces are fine:

```bash
pnpm campus:install "/Users/me/Developer/My Project"
```

What the installer does — and does not do:

- It modifies **only** the project's `.claude/` and `.codex/` configuration directories.
- It does **not** modify your application source code.
- It does **not** modify `package.json`, `composer.json`, `pyproject.toml` or `go.mod`.
- Installation is required **once** per project; afterwards you run `claude` or `codex` normally.
- Codex will ask you to review/trust newly installed project hooks; use `/hooks` in Codex.
- The room appears after the first coding-agent hook event, and stays visible after the session
  ends.

To remove it:

```bash
pnpm campus:uninstall ~/Developer/my-project
```

## Daily usage

1. Start the campus (`pnpm dev`) and open http://localhost:3100.
2. Run `claude` or `codex` inside any connected project and give it a task.
3. Watch its room: the agent moves to the planning table, then to its desk to work, then to
   the review screen to check, and celebrates when the task completes.
4. Click a room or an agent to open the inspector for details; double-click an agent to
   follow it.

## Multi-agent rooms

A room can hold the main runtime agent plus the real subagents it starts, for example a
Planner, an Implementation Engineer and a QA Engineer working together.

![Multiple named agents in one room](docs/images/multi-agent-room.png)

> The campus does not invent working agents. It visualizes the real agents Claude Code or Codex
> starts.

Each teammate gets a stable desk and keeps its identity across restarts and reconnects
(subagents are keyed on session + type, so re-running the same kind of subagent reuses the
same teammate instead of duplicating it). Unknown subagent types still get a safe role and
profile.

### Work as a coordinated engineering team

To see several teammates, ask your coding agent to split the work:

> Use a **Planner** subagent to inspect the request and define a plan.
> Use an **Implementation Engineer** subagent to make the changes.
> Use a **QA Engineer** subagent to run tests and verify the result.
> Use a **Reviewer** subagent to inspect the final implementation.

Keep responsibilities separate and let Claude coordinate the final result. Multiple avatars
appear **only** when Claude actually starts multiple subagents.

## Named agents

Every agent has a stable, human-readable name — never `agent-123` or `general-purpose-2`.
Main agents appear as **Claude — Team Lead** or **Codex — Team Lead**; subagents get names from a curated pool
(Lucy, Jarvis, Anna, Milo, …), assigned deterministically with no duplicates in a room.

![Agent profile in the inspector](docs/images/agent-inspector.png)

Open an agent to see its **name, role, short bio, current state and observable action**,
plus **Follow** and **Rename**. Renames persist across restarts, and "Reset name" restores
the generated name. Raw ids stay tucked inside the collapsed **Developer details**.

Roles the campus recognizes include Planner, Researcher, Implementation Engineer, Frontend
/ Backend / Database Engineer, QA Engineer, Reviewer, Security Reviewer, DevOps Engineer and
Documentation Agent — each with its own accessory on the avatar.

### Optional team roster

Pre-label teammates with `<project>/.claude/campus.json`. Codex also supports
`<project>/.codex/campus.json` and prefers it when both files exist:

```json
{
  "projectName": "prog.bts",
  "team": [
    { "agentType": "plan", "name": "Lucy", "role": "Planner" },
    { "agentType": "implementation-engineer", "name": "Jarvis", "role": "Implementation Engineer" },
    { "agentType": "qa-engineer", "name": "Anna", "role": "QA Engineer" }
  ]
}
```

This controls presentation only — it grants no permissions and creates no working agents.
Scaffold a starter file with `pnpm campus:team /path/to/project`.

## Idle campus life

When an agent has no real task, it may do something human — a coffee break, watering the
plants, a game of chess, a visit to the campus plaza. Ambient life is always clearly
labelled and kept separate from real work:

![Idle agents doing ambient activities](docs/images/idle-campus-life.png)

- Ambient life starts **only** while an agent is genuinely idle and stops the instant a real
  event arrives.
- It never creates coding-agent events, tool calls, tasks or transcripts, and social animation is
  never presented as real agent communication.
- It is frozen while an approval is pending or an agent needs attention.
- You can turn it off from the top bar ("Ambient life"), and it respects your OS
  reduced-motion setting.

Real work reads as **"Jarvis is editing the billing service — Real agent activity"**;
ambient life reads as **"Lucy is taking a coffee break — Ambient activity"**.

## Architecture

```text
Claude Code / Codex → runtime hooks → NestJS event API → Postgres
                                          → Socket.IO → Next.js + React Three Fiber
```

The campus is a pnpm/Turbo monorepo (NestJS API, Next.js 3D web, shared pure packages for
project inspection and event normalization). Full detail, the data-flow diagram and the
module boundaries are in [docs/architecture.md](docs/architecture.md).

## Security

The campus observes hooks and **never executes your code**. Secrets are redacted before
anything is stored or shown, the API is local-only, destructive commands route through an
approval flow that defaults to **deny** on timeout, and observational hooks fail open so the
coding agent keeps working if the campus is down. See [docs/security.md](docs/security.md).

## Troubleshooting

| Symptom | Fix |
|---|---|
| Project does not appear | `pnpm campus:install <path>`, then run `claude` or `codex` in it; in Codex review `/hooks`; check `curl http://localhost:4000/api/health` |
| Only one main agent appears | The task started no subagents — use the multi-agent prompt above |
| Database unavailable | `pnpm db:up && pnpm db:migrate` |
| Campus offline | Claude Code and Codex keep working; observational hooks fail open |

More cases in [docs/troubleshooting.md](docs/troubleshooting.md).

## Development commands

```bash
pnpm dev            # web (:3100) + api (:4000)
pnpm lint           # eslint across all workspaces
pnpm typecheck      # tsc --noEmit across all workspaces
pnpm test           # unit + integration tests (needs the database up)
pnpm build          # production build
pnpm test:e2e       # full-stack smoke test
pnpm screenshots    # regenerate docs/images/*.png from a real browser
```

Full development guide: [docs/development.md](docs/development.md).
Hooks and the hook-event mapping: [docs/hooks.md](docs/hooks.md).

## Roadmap

- Per-module room splitting (modules currently share the repo's room).
- Broader command-classifier coverage as new tools come up.
- Richer ambient animations and agents physically visiting shared campus areas.
- Visual regression testing for the 3D scene.
