# OpenFleet

Reusable runtime for OpenCode-based fleets.

## Split

- `~/openfleet`: generic runtime layer, shared scripts, and docs.
- `~/cairn`: the live personal workspace and project-specific OpenCode config.
- `~/.cairn`: live state, caches, logs, and compatibility wrappers.

## Core layout

- `core/deployment.js`: deployment loading and validation.
- `core/runtime/session.js`: session lifecycle and prompt delivery.
- `core/runtime/events.js`: append/read event store skeleton.
- `core/runtime/registry.js`: runtime registry and cursors.

## Current contract

- OpenFleet owns the reusable mechanics.
- Cairn owns the personal workspace identity and prompts.
- `~/.cairn/system/bin/*` stays as the stable entrypoint for the live deployment and delegates into OpenFleet.

## Deployment model

See `docs/deployment-model.md`.

## Scripts

- `bin/ensure_opencode_server`
- `bin/worker_session`
- `bin/message_agent`
- `bin/message_parent`
- `bin/deployment_prompt`
- `bin/supervisor_tick`

## Notes

This is intentionally small. The first extraction only moves the generic session/runtime layer.
