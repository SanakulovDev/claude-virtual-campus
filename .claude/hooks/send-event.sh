#!/usr/bin/env bash
# Observational hook: fire-and-forget, must never block or fail Claude Code.
set -u

CAMPUS_URL="${CLAUDE_CAMPUS_URL:-http://localhost:4000}"
INPUT="$(cat)"

curl \
  --silent \
  --show-error \
  --max-time 2 \
  --request POST \
  --header "Content-Type: application/json" \
  --data "$INPUT" \
  "${CAMPUS_URL}/api/claude/events" >/dev/null 2>&1 || true

exit 0
