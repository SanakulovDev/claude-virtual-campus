# Claude Virtual Campus

A living 3D office for your Claude Code projects.

Every local project becomes its own room. Claude and its real subagents appear as named
teammates — planning, coding, testing and reviewing in real time.

![Claude Virtual Campus](docs/images/campus-overview.png)

**Local-first · Multi-project · Multi-agent · Language-agnostic · Real-time 3D**

---

## What it is

Open Claude Code inside any project, give it a task, and the campus lights up: it detects
the project, gives it a room, and moves named 3D teammates as Claude actually works. It
works with **any** language — PHP, Python, Go, Rust, Java, .NET, Ruby, Node.js or anything
else — because it watches Claude Code's hooks, not your build system. Nothing is scripted:
every movement is driven by a real hook event.

![A focused project room](docs/images/project-room.png)

## Key features

- **A room per project.** Each local project you connect gets its own persistent studio.
- **Real named teammates.** Main Claude plus the actual subagents Claude starts, each with
  a readable name, a role and a short bio.
- **Live 3D activity.** Agents plan, work, check and celebrate as hook events arrive.
- **Ambient idle life.** Idle agents take coffee breaks and water plants — always clearly
  labelled, never mistaken for real work.
- **Approval flow.** Destructive commands pause the agent and ask for permission.
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
# then just use Claude Code as usual
cd ~/Developer/my-project
claude
```

Open **http://localhost:3100**, give Claude a task, and watch the project room come alive.
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

- It modifies **only** the project's `.claude/` directory.
- It does **not** modify your application source code.
- It does **not** modify `package.json`, `composer.json`, `pyproject.toml` or `go.mod`.
- Installation is required **once** per project; afterwards you just run `claude` normally.
- The room appears after the first Claude hook event, and stays visible after the session
  ends.

To remove it:

```bash
pnpm campus:uninstall ~/Developer/my-project
```

## Daily usage

1. Start the campus (`pnpm dev`) and open http://localhost:3100.
2. Run `claude` inside any connected project and give it a task.
3. Watch its room: the agent moves to the planning table, then to its desk to work, then to
   the review screen to check, and celebrates when the task completes.
4. Click a room or an agent to open the inspector for details; double-click an agent to
   follow it.

## Multi-agent rooms

A room can hold the main Claude plus the real subagents Claude starts, for example a
Planner, an Implementation Engineer and a QA Engineer working together.

![Multiple named agents in one room](docs/images/multi-agent-room.png)

> The campus does not invent working agents. It visualizes the real agents Claude Code
> starts.

Each teammate gets a stable desk and keeps its identity across restarts and reconnects
(subagents are keyed on session + type, so re-running the same kind of subagent reuses the
same teammate instead of duplicating it). Unknown subagent types still get a safe role and
profile.

### Work as a coordinated engineering team

To see several teammates, ask Claude to split the work:

> Use a **Planner** subagent to inspect the request and define a plan.
> Use an **Implementation Engineer** subagent to make the changes.
> Use a **QA Engineer** subagent to run tests and verify the result.
> Use a **Reviewer** subagent to inspect the final implementation.

Keep responsibilities separate and let Claude coordinate the final result. Multiple avatars
appear **only** when Claude actually starts multiple subagents.

## Named agents

Every agent has a stable, human-readable name — never `agent-123` or `general-purpose-2`.
Main Claude appears as **Claude — Team Lead**; subagents get names from a curated pool
(Lucy, Jarvis, Anna, Milo, …), assigned deterministically with no duplicates in a room.

![Agent profile in the inspector](docs/images/agent-inspector.png)

Open an agent to see its **name, role, short bio, current state and observable action**,
plus **Follow** and **Rename**. Renames persist across restarts, and "Reset name" restores
the generated name. Raw ids stay tucked inside the collapsed **Developer details**.

Roles the campus recognizes include Planner, Researcher, Implementation Engineer, Frontend
/ Backend / Database Engineer, QA Engineer, Reviewer, Security Reviewer, DevOps Engineer and
Documentation Agent — each with its own accessory on the avatar.

### Optional team roster

Pre-label the teammates a project will start with `<project>/.claude/campus.json`:

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
- It never creates Claude events, tool calls, tasks or transcripts, and social animation is
  never presented as real agent communication.
- It is frozen while an approval is pending or an agent needs attention.
- You can turn it off from the top bar ("Ambient life"), and it respects your OS
  reduced-motion setting.

Real work reads as **"Jarvis is editing the billing service — Real Claude activity"**;
ambient life reads as **"Lucy is taking a coffee break — Ambient activity"**.

## Architecture

```text
Claude Code CLI → universal hooks → NestJS event API → Postgres
                                          → Socket.IO → Next.js + React Three Fiber
```

The campus is a pnpm/Turbo monorepo (NestJS API, Next.js 3D web, shared pure packages for
project inspection and event normalization). Full detail, the data-flow diagram and the
module boundaries are in [docs/architecture.md](docs/architecture.md).

## Security

The campus observes hooks and **never executes your code**. Secrets are redacted before
anything is stored or shown, the API is local-only, destructive commands route through an
approval flow that defaults to **deny** on timeout, and the hooks fail open so Claude Code
keeps working if the campus is down. See [docs/security.md](docs/security.md).

## Troubleshooting

| Symptom | Fix |
|---|---|
| Project does not appear | `pnpm campus:install <path>`, then run `claude` in it; check `curl http://localhost:4000/api/health` |
| Only Claude appears | The task started no subagents — use the multi-agent prompt above |
| Database unavailable | `pnpm db:up && pnpm db:migrate` |
| Campus offline | Claude Code keeps working; hooks fail open |

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
