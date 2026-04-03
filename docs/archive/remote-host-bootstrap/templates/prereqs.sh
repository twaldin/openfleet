#!/usr/bin/env sh

# Bootstrap prerequisite check for a remote worker host.
#
# Usage:
#   HOST_ALIAS=thinkpad-1 ./prereqs.sh

set -eu

: "${HOST_ALIAS:?set HOST_ALIAS to gaming-pc, thinkpad-1, or thinkpad-2}"

echo "[${HOST_ALIAS}] checking prerequisites"

command -v git >/dev/null
command -v node >/dev/null
command -v opencode >/dev/null

git --version
node --version
opencode --version

echo "[${HOST_ALIAS}] prerequisites look available"
