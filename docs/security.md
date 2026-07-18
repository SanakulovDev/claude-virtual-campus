# Security & privacy

The campus is local-first and read-only with respect to your code — it observes hook
events, it never executes anything it receives.

## Guarantees

- **No command execution, ever.** Command/file classification is string/token analysis
  only. The campus never runs a received command.
- **Payload size limits** (512 kb) on `/api/claude/events` and `/api/claude/approval`.
- **Deep secret redaction** before anything is persisted or broadcast:
  `redactSensitiveData` (in `event-normalizer`) strips secret-shaped keys/values and drops
  `__proto__`/`constructor`/`prototype` keys (prototype-pollution-safe).
- **Sensitive files** (`.env`, `*.pem`, `id_rsa`, …) are flagged `secret`; their contents
  are never rendered. Paths outside the project root are redacted to their basename.
- **No shell interpolation anywhere** — git calls use `execFile` with argv arrays.
- **Local binding.** The API binds to `127.0.0.1` by default; CORS is restricted to
  `CORS_ORIGIN`.
- **Normalized shapes only.** Raw hook payloads are never sent to the frontend — only
  `NormalizedClaudeEvent` / agent-state shapes.

## Approval flow (destructive commands)

Non-destructive tool calls are allowed immediately (nothing is gated). Destructive commands
(`rm -rf`, `sudo`, force pushes, DB drops/resets, etc.) are classified as `destructive` and
always route through the approval flow:

1. A persisted `ApprovalRequest` is created and `approval:requested` is broadcast to the
   project's room.
2. The hook **blocks** for at most `APPROVAL_TIMEOUT_MS` (default 30 s) waiting for
   `POST /api/approvals/:id/allow` or `.../deny`.
3. **Timeout always resolves to deny** — never allow.

If the campus API is down entirely, `request-approval.sh` fails open so Claude Code's own
default permission handling takes over.

## Campus runs (send task to agent)

`POST /api/projects/:id/runs` starts a headless `claude -p "<prompt>"` in the project's
directory. Safeguards:

- The prompt travels as data end to end (JSON -> zod -> argv element); it is never
  interpolated into a shell string.
- The endpoint refuses (403) whenever the API is bound to a non-loopback host. The guard
  shares the exact host resolution `main.ts` uses (`src/config/api-host.ts`), so it cannot
  drift from the real bind. In containers (`API_HOST=0.0.0.0`) runs are always disabled.
- One active run per project, at most 3 campus-wide; 30-minute hard timeout.
- The spawned run's tool use is gated by Claude's own permission system plus the campus
  approval flow — destructive commands land in the approval drawer and deny by default.
- Caveat: if the API restarts while a run is active, the child process is orphaned; boot
  cleanup marks the row FAILED ("API restarted") before the port opens, and the orphan
  simply exits on its own (bounded by the 30-minute timeout). Stop's no-handle path is a
  defensive fallback for a handle ever going missing mid-run, not a restart recovery.
- This does not weaken the "never execute received commands" rule: nothing from hook
  payloads is executed; only a prompt typed by the local user in the campus UI reaches
  the `claude` binary, as an argument.

## What ambient idle life is not

The [ambient idle life](../README.md#11-idle-campus-life) shown for idle agents is a
purely cosmetic, client-side layer. It never creates Claude events, tool calls, tasks or
transcripts, and it is always labelled "Ambient activity" so it is never presented as real
Claude work. It stops the instant a real event arrives, and is frozen while an approval is
pending or an agent needs attention.
