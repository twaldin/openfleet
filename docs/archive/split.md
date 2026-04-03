# Deployment split

## OpenFleet

`~/openfleet` is the reusable codebase. It should contain only generic runtime logic, shared helpers, and docs.

## Cairn

`~/cairn` is the live personal workspace. It keeps the project-specific OpenCode config, the `cairn` agent profile, and the prompts that make the workspace feel like `cairn`.

## ~/.cairn

`~/.cairn` is live state: session caches, logs, worker metadata, and compatibility wrappers. It should stay stable while the runtime is migrated.

## Rule of thumb

- Put reusable logic in OpenFleet.
- Put identity and workspace-specific behavior in Cairn.
- Put mutable state and wrappers in `~/.cairn`.
