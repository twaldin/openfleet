#!/usr/bin/env sh

# Sync the reusable runtime and target workspace onto a host.
#
# Usage:
#   HOST_ALIAS=gaming-pc REPO_URL=git@github.com:twaldin/openfleet.git WORKSPACE_ROOT="$HOME/openfleet" ./sync-repo.sh

set -eu

: "${HOST_ALIAS:?set HOST_ALIAS}"
: "${REPO_URL:?set REPO_URL}"
: "${WORKSPACE_ROOT:?set WORKSPACE_ROOT}"

echo "[${HOST_ALIAS}] syncing ${REPO_URL} -> ${WORKSPACE_ROOT}"

if [ ! -d "${WORKSPACE_ROOT}/.git" ]; then
  git clone "${REPO_URL}" "${WORKSPACE_ROOT}"
else
  git -C "${WORKSPACE_ROOT}" fetch --all --prune
  git -C "${WORKSPACE_ROOT}" pull --ff-only
fi

git -C "${WORKSPACE_ROOT}" status --short

echo "[${HOST_ALIAS}] repo sync complete"
