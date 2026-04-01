#!/usr/bin/env sh

# Verify the minimum bootstrap state on a remote worker host.
#
# Usage:
#   HOST_ALIAS=thinkpad-1 WORKSPACE_ROOT="$HOME/openfleet" STATE_DIR="$HOME/.openfleet" SERVER_URL=http://127.0.0.1:4096 ./verify-bootstrap.sh

set -eu

: "${HOST_ALIAS:?set HOST_ALIAS}"
: "${WORKSPACE_ROOT:?set WORKSPACE_ROOT}"
: "${STATE_DIR:?set STATE_DIR}"

echo "[${HOST_ALIAS}] verifying bootstrap"

command -v git >/dev/null
command -v node >/dev/null
command -v opencode >/dev/null

test -d "${WORKSPACE_ROOT}/.git"
test -d "${STATE_DIR}"
test -d "${STATE_DIR}/system/opencode"
test -d "${STATE_DIR}/system/logs"

git -C "${WORKSPACE_ROOT}" status --short

if [ -n "${SERVER_URL:-}" ]; then
  printf '%s\n' "${SERVER_URL}"
fi

echo "[${HOST_ALIAS}] bootstrap verification passed"
