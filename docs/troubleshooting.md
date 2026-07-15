# Troubleshooting

## The project does not appear

The room appears after the first Claude or Codex hook event. Make sure the project is installed and
you have started one of them in it:

```bash
pnpm campus:install /absolute/path/to/project
cd /absolute/path/to/project
claude
# or: codex
```

Then give the agent a task. Confirm the API is up:

```bash
curl http://localhost:4000/api/health
```

Confirm `<project>/.claude/settings.json` has the `hooks` block (re-run
`pnpm campus:install <path>`), and that `CLAUDE_CAMPUS_URL` points at a running API
(defaults to `http://localhost:4000`).

For Codex, confirm `<project>/.codex/hooks.json` exists, `CODEX_CAMPUS_URL` is correct,
and open `/hooks` to review/trust the project hook definitions.

## Only the main agent appears (no teammates)

The task did not start any subagents, so there is only the main runtime agent to show. The
campus does not invent working agents—it only visualizes real Claude/Codex agents.
Ask the coding agent to work as a team (see the multi-agent example in the README), or use a
`.claude/campus.json` roster to pre-label the teammates it will start.

## The database is unavailable

```bash
pnpm db:up
pnpm db:migrate
```

The campus needs Postgres (Docker, host port 5433 by default).

## The campus is offline

Claude Code and Codex continue working normally—the observational hooks fail open. When the campus
comes back, new events flow again. In-flight approval requests fall back to the coding agent's
own default permission handling if the API is unreachable.

## Ports already in use

Local development uses web port `3100`; Docker publishes its web container on `3200`, so
both workflows can coexist. Use `WEB_PORT`/`CORS_ORIGIN` for local development, or set
`CAMPUS_DOCKER_WEB_PORT` and the comma-separated `CAMPUS_DOCKER_WEB_ORIGIN` allowlist
together for Docker. Postgres uses host port `5433` and the API uses `4000` in both workflows.

## The approval hook seems to hang

It blocks for at most `APPROVAL_TIMEOUT_MS` (default 30 s) and then **denies**. If the
campus API is down entirely, `request-approval.sh` fails open so Claude Code's own
permission handling takes over.

## Agents look duplicated / renamed unexpectedly

Claude teammates are keyed on `(session + agentType)`; Codex teammates use its explicit
`agent_id`. Names are persisted, so restarts and reconnects reuse the same teammate. You can rename any agent from the inspector
(the raw ids stay in **Developer details**); "Reset name" restores the generated name.
