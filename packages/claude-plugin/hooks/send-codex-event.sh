#!/usr/bin/env bash
# Observational Codex hook: bounded and fail-open so telemetry never blocks Codex.
set -u

CAMPUS_URL="${CODEX_CAMPUS_URL:-${CAMPUS_URL:-http://localhost:4000}}"
curl \
  --silent \
  --show-error \
  --max-time 2 \
  --request POST \
  --header "Content-Type: application/json" \
  --header "X-Campus-Token: ${CAMPUS_HOOK_TOKEN:-}" \
  --data-binary @- \
  "${CAMPUS_URL}/api/codex/events" >/dev/null 2>&1 || true

exit 0
