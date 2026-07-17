#!/usr/bin/env bash
# PreToolUse approval hook. Only overrides the permission decision for commands the
# campus server classifies as destructive; everything else prints nothing so Claude
# Code's normal permission handling applies unchanged. If the campus is unreachable,
# this fails open to Claude Code's own default behavior (never silently allows or
# silently blocks on our behalf) -- matches spec section 10's fail-safe requirement.
set -u

CAMPUS_URL="${CLAUDE_CAMPUS_URL:-http://localhost:4000}"
INPUT="$(cat)"

RESPONSE="$(curl \
  --silent \
  --show-error \
  --max-time 35 \
  --request POST \
  --header "Content-Type: application/json" \
  --data "$INPUT" \
  "${CAMPUS_URL}/api/claude/approval" 2>/dev/null)" || true

if [ -n "${RESPONSE:-}" ]; then
  echo "$RESPONSE"
fi

exit 0
