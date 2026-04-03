#!/usr/bin/env sh

# Create the OpenFleet runtime state layout for a worker host.
#
# Usage:
#   HOST_ALIAS=thinkpad-2 STATE_DIR="$HOME/.openfleet" ./setup-state-dir.sh

set -eu

: "${HOST_ALIAS:?set HOST_ALIAS}"
: "${STATE_DIR:?set STATE_DIR}"

echo "[${HOST_ALIAS}] creating state dir at ${STATE_DIR}"

mkdir -p "${STATE_DIR}/system/opencode"
mkdir -p "${STATE_DIR}/system/logs"
mkdir -p "${STATE_DIR}/sessions"
mkdir -p "${STATE_DIR}/workers"

test -d "${STATE_DIR}/system/opencode"
test -d "${STATE_DIR}/system/logs"

echo "[${HOST_ALIAS}] state dir ready"
