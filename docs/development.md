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
pnpm screenshots    # capture docs/images/*.png from a real browser (resets the dev DB)
```

Database helpers:

```bash
pnpm db:up          # start Postgres in Docker
pnpm db:down        # stop it
pnpm db:migrate     # apply migrations
pnpm db:reset       # wipe the dev campus to empty
```

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

## Connecting a project

There is no per-language setup:

```bash
pnpm campus:install ~/Developer/my-project
pnpm campus:install "/Users/me/Developer/My Project"   # paths with spaces are fine
pnpm campus:team    ~/Developer/my-project             # optional team roster
```

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
