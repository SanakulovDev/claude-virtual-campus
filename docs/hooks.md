# Hooks

The campus observes Claude Code through **hooks**. Installing the campus into a project
adds a small `.claude/` hook configuration that POSTs each hook event to the campus API.
Hooks are observational and **fail open**: if the campus API is down, Claude Code keeps
working normally.

## Install / uninstall

```bash
pnpm campus:install /absolute/path/to/any/project
pnpm campus:uninstall /absolute/path/to/any/project
```

The installer only ever creates/edits files under `<project>/.claude/`. It never modifies
`composer.json`, `package.json`, `go.mod`, `pyproject.toml`, or any other manifest, is
idempotent, backs up an existing `settings.json` before changing it, and works in non-git
directories and paths containing spaces.

`CLAUDE_CAMPUS_URL` (default `http://localhost:4000`) points the hooks at the API.

## Hook-event mapping caveat

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

Hooks fire process-wide, not per-subagent, so there is no dedicated subagent identifier in
the payload. `AgentsService.resolveActiveAgent` infers the active agent via a
session-scoped stack (a `Task` PreToolUse pushes, `SubagentStop` pops), using the real
`subagent_type`/`description` from the `Task` tool's `tool_input` when present. Verify this
mapping against your installed Claude Code CLI's docs before depending on it for anything
safety-critical.

## campus.json (optional)

A project may add `<project>/.claude/campus.json` to relabel the teammates Claude Code
starts. It is **presentation only** — it never grants permissions and never creates a
working agent Claude did not start.

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
