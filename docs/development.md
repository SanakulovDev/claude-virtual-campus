# Development

## Requirements

Node.js ≥ 20 and Docker (for Postgres). pnpm is provided via Corepack.

## Setup

```bash
git clone <repository-url>
cd claude-virtual-campus
corepack enable
cp .env.example .env
pnpm install
pnpm db:up
pnpm db:migrate
pnpm dev
```

`pnpm dev` runs both apps and must stay running:

```text
Web:      http://localhost:3100
API:      http://localhost:4000
Health:   http://localhost:4000/api/health
Database: localhost:5433
```

Ports were moved off the 3000/5432 defaults to avoid clashing with other local projects —
change `.env` and `docker-compose.yml` together if you want them back.

## Commands

```bash
pnpm dev            # web (:3100) + api (:4000)
pnpm build          # production build of every package/app
pnpm lint           # eslint across all workspaces
pnpm typecheck      # tsc --noEmit across all workspaces
pnpm test           # unit + integration tests (needs the database up)
pnpm test:e2e       # full-stack smoke test (starts its own db/api/web)
pnpm test:redesign  # headless-browser UI smoke -> artifacts/redesign/*.png
pnpm screenshots    # capture docs/images/*.png from a real browser
```

Every one of those runs in its own Postgres schema (`campus_test` for `pnpm test`,
`campus_smoke` for the three scripts), so none of them can add rooms to -- or reset -- the
campus you actually use in `public`. Keep it that way: the scripts run
`prisma migrate reset --force`, which against `public` wipes real projects and their history.

Database helpers:

```bash
pnpm db:up          # start Postgres in Docker
pnpm db:down        # stop it
pnpm db:migrate     # apply migrations
pnpm db:prune       # drop rooms whose project directory no longer exists (--dry-run to preview)
pnpm db:reset       # wipe the dev campus to empty
```

`db:prune` is the cleanup for demo runs: `pnpm demo:*` posts to whatever API is running, so
its throwaway repos become real rooms in your campus. Prune keys off a missing directory
only, so a project on an unmounted drive counts as missing -- it is manual for that reason,
and a pruned project returns on its next hook event.

## Run the whole stack in Docker

To run the campus without keeping `pnpm dev` open:

```bash
docker compose up -d --build   # postgres + api + web
docker compose logs -f         # follow logs
docker compose down            # stop
```

The API container runs `prisma migrate deploy` on start and binds `0.0.0.0` (via
`API_HOST`) so its published port is reachable; the local `pnpm dev` path keeps the secure
`127.0.0.1` default. All services use `restart: unless-stopped`, so the campus returns after
a reboot. Rebuild with `docker compose up -d --build` after changing the source.

`pnpm db:up` still starts only Postgres, for the `pnpm dev` workflow.

## Demo mode

```bash
pnpm demo:events    # runs php + python + go simulations
pnpm demo:php
pnpm demo:python
pnpm demo:go
pnpm demo:attention # permission/approval demonstration
```

Each simulator creates a real temporary git repository with realistic files
(`composer.json` + `artisan`, `pyproject.toml`, `go.mod`, …) and POSTs the exact hook
payload sequence to the real `/api/claude/events` endpoint — there is no separate fake
frontend path.

## Kiosk mode

`http://localhost:3100/?kiosk=1` runs the campus as a zero-interaction wall display: the
HUD (top bar, dock, drawers, timeline) is hidden and an auto-director camera takes over --
attention anywhere wins immediately, otherwise it frames the room with the most recent
event, and it pulls back to the whole-lab overview after ~20s of quiet. A pulsing red
edge frame flashes across the screen while any agent is in the attention state. Kiosk mode
has no interaction surface, so approvals still need a normal (non-kiosk) browser window.

## Connecting a project

There is no per-language setup. Put `campus` on your PATH once (`pnpm campus:link` from this
repo), then, inside any project:

```bash
campus install        # connect this project (any language, no path needed)
campus team           # optional team roster (.claude/campus.json)
campus uninstall      # disconnect
```

`campus <cmd> <path>` takes an explicit directory too (paths with spaces are fine).
`bin/campus` and `pnpm campus:install <path>` from this repo are equivalent entry points.

Then run `claude` inside that project. See [hooks.md](hooks.md) for details.

## Before calling anything done

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

## Prohibitions

- No language-specific branches in core event/agent/room logic (technology is metadata
  only).
- No executing received commands, ever — classification is string/token analysis only.
- No running project build/test/install commands during technology detection.
- No unrequested abstractions.
