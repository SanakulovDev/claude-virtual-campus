#!/usr/bin/env bash
# Codex PermissionRequest hook. Empty output delegates to Codex's normal approval UI.
set -u

CAMPUS_URL="${CODEX_CAMPUS_URL:-${CAMPUS_URL:-http://localhost:4000}}"
RESPONSE="$(curl \
  --silent \
  --show-error \
  --max-time 35 \
  --request POST \
  --header "Content-Type: application/json" \
  --header "X-Campus-Token: ${CAMPUS_HOOK_TOKEN:-}" \
  --data-binary @- \
  "${CAMPUS_URL}/api/codex/approval" 2>/dev/null)" || true

if [ -n "${RESPONSE:-}" ]; then
  echo "$RESPONSE"
fi

exit 0
