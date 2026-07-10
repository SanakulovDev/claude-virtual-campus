# Troubleshooting

## The project does not appear

The room appears after the first Claude hook event. Make sure the project is installed and
you have actually started Claude in it:

```bash
pnpm campus:install /absolute/path/to/project
cd /absolute/path/to/project
claude
```

Then give Claude a task. Confirm the API is up:

```bash
curl http://localhost:4000/api/health
```

Confirm `<project>/.claude/settings.json` has the `hooks` block (re-run
`pnpm campus:install <path>`), and that `CLAUDE_CAMPUS_URL` points at a running API
(defaults to `http://localhost:4000`).

## Only Claude appears (no teammates)

The task did not start any subagents, so there is only the main Claude agent to show. The
campus does not invent working agents — it only visualizes the real agents Claude Code
starts. Ask Claude to work as a team (see the multi-agent example in the README), or use a
`.claude/campus.json` roster to pre-label the teammates it will start.

## The database is unavailable

```bash
pnpm db:up
pnpm db:migrate
```

The campus needs Postgres (Docker, host port 5433 by default).

## The campus is offline

Claude Code continues working normally — the observational hooks fail open. When the campus
comes back, new events flow again. In-flight approval requests fall back to Claude Code's
own default permission handling if the API is unreachable.

## Ports already in use

This repo defaults to Postgres `5433` and web `3100` specifically to avoid clashing with
other local projects. Change `.env` and `docker-compose.yml` together if you need different
ports.

## The approval hook seems to hang

It blocks for at most `APPROVAL_TIMEOUT_MS` (default 30 s) and then **denies**. If the
campus API is down entirely, `request-approval.sh` fails open so Claude Code's own
permission handling takes over.

## Agents look duplicated / renamed unexpectedly

Each teammate's identity is keyed on `(session + agentType)` and its name is persisted, so
restarts and reconnects reuse the same teammate. You can rename any agent from the inspector
(the raw ids stay in **Developer details**); "Reset name" restores the generated name.
