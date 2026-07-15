# Security & privacy

The campus is local-first and read-only with respect to your code — it observes hook
events, it never executes anything it receives.

## Guarantees

- **No command execution, ever.** Command/file classification is string/token analysis
  only. The campus never runs a received command.
- **Payload size limits** (512 kb) on all Claude and Codex event/approval routes.
- **Deep secret redaction** before anything is persisted or broadcast:
  `redactSensitiveData` (in `event-normalizer`) strips secret-shaped keys/values and drops
  `__proto__`/`constructor`/`prototype` keys (prototype-pollution-safe).
- **Sensitive files** (`.env`, `*.pem`, `id_rsa`, …) are flagged `secret`; their contents
  are never rendered. Paths outside the project root are redacted to their basename.
- **No shell interpolation in project inspection**—git calls use `execFile` with argv arrays.
- **Local binding.** The API binds to `127.0.0.1` by default; CORS is restricted to
  `CORS_ORIGIN`.
- **Optional hook authentication.** Set `HOOK_SHARED_SECRET` on the API and the same
  value as `CAMPUS_HOOK_TOKEN` in Claude/Codex environments. Event and approval routes
  then reject missing or incorrect hook tokens.
- **Normalized shapes only.** Raw hook payloads are never sent to the frontend—only
  redacted normalized event and agent-state shapes.

## Approval flow (destructive commands)

Non-destructive tool calls produce no hook decision, so Claude/Codex normal approval policy
remains authoritative. Destructive commands
(`rm -rf`, `sudo`, force pushes, DB drops/resets, etc.) are classified as `destructive` and
always route through the approval flow:

1. A persisted `ApprovalRequest` is created and `approval:requested` is broadcast to the
   project's room.
2. The hook **blocks** for at most `APPROVAL_TIMEOUT_MS` (default 30 s) waiting for
   `POST /api/approvals/:id/allow` or `.../deny`.
3. **Timeout always resolves to deny** — never allow.

If the campus API is down entirely, `request-approval.sh` emits no decision, so the coding
agent's own permission handling takes over.

## What ambient idle life is not

The [ambient idle life](../README.md#idle-campus-life) shown for idle agents is a
purely cosmetic, client-side layer. It never creates coding-agent events, tool calls, tasks or
transcripts, and it is always labelled "Ambient activity" so it is never presented as real
agent work. It stops the instant a real event arrives, and is frozen while an approval is
pending or an agent needs attention.
