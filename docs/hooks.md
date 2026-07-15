# Hooks

The campus observes Claude Code and Codex through **hooks**. Installation adds small
configurations under `.claude/` and `.codex/`; events are posted to runtime-specific API
routes and then normalized into one shared model. Observational hooks are bounded and
**fail open** if the campus API is unavailable.

## Install / uninstall

```bash
pnpm campus:install /absolute/path/to/any/project
pnpm campus:uninstall /absolute/path/to/any/project
```

The installer only ever creates/edits files under `<project>/.claude/` and
`<project>/.codex/`. It never modifies
`composer.json`, `package.json`, `go.mod`, `pyproject.toml`, or any other manifest, is
idempotent, backs up existing hook configuration before changing it, and works in non-git
directories and paths containing spaces.

`CLAUDE_CAMPUS_URL` and `CODEX_CAMPUS_URL` (default `http://localhost:4000`) point hooks
at the API. Codex requires review/trust for changed non-managed project hooks; inspect and
trust them with `/hooks`.

For authenticated ingestion, set `HOOK_SHARED_SECRET` for the API and export the same
value as `CAMPUS_HOOK_TOKEN` before starting Claude Code or Codex.

## Runtime event mapping

Claude Code's officially documented hook events (as of when this was built) are:
`SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `Notification`,
`PreCompact`, `Stop`, `SubagentStop`, `SessionEnd`.

Several event names used in the product design are **not** separate documented hooks; they
are derived server-side:

| Concept | Derived from |
|---|---|
| `PermissionRequest` | `PreToolUse`'s `hookSpecificOutput.permissionDecision` (allow/deny/ask) |
| `PostToolUseFailure` | `PostToolUse` where `tool_response.is_error`/`error` is set |
| `SubagentStart` | `PreToolUse` where `tool_name === "Task"` |
| `TaskCreated` / `TaskCompleted` | `UserPromptSubmit` / `Stop` (app-level concept, not a hook) |
| `StopFailure` | not distinguished from `Stop` in the current payload; documented gap |
| `CwdChanged` | not a hook; every payload includes `cwd`, diffed server-side per session |

Claude hooks fire process-wide, not per-subagent, so there is no dedicated subagent identifier in
the payload. `AgentsService.resolveActiveAgent` infers the active agent from `Task`
PreToolUse and `SubagentStop`, using the real
`subagent_type`/`description` from the `Task` tool's `tool_input` when present. Verify this
mapping against your installed Claude Code CLI's docs before depending on it for anything
safety-critical.

Codex has native `PermissionRequest`, `PostCompact`, `SubagentStart`, and `SubagentStop`
events. Its subagent events contain `agent_id` and `agent_type`, which the campus uses as
stable identities instead of inferring a synthetic stack. `tool_use_id` correlates Codex
PreToolUse/PostToolUse pairs, including concurrent calls. The installed Codex event set is:
`SessionStart`, `UserPromptSubmit`, `PreToolUse`, `PermissionRequest`, `PostToolUse`,
`PreCompact`, `PostCompact`, `SubagentStart`, `SubagentStop`, and `Stop`.

Routes are `POST /api/claude/events`, `POST /api/codex/events`,
`POST /api/claude/approval`, and `POST /api/codex/approval`.

## campus.json (optional)

A project may add `<project>/.claude/campus.json` or `<project>/.codex/campus.json` to
relabel teammates. Codex prefers its own file and falls back to `.claude/campus.json`.
These files are **presentation only**—they never grant permissions or create agents.

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

Scaffold a starter file with:

```bash
pnpm campus:team /path/to/project
```

It refuses to overwrite an existing `campus.json` unless you pass `--force`. Reading the
file always fails open: a missing, oversized or invalid file is ignored, never blocking
event handling.
