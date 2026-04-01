# Deployment model

OpenFleet is the reusable runtime. A deployment is the thin layer that supplies:

- a workspace root
- a parent/orchestrator session script
- a shared OpenCode server location
- a set of named job prompts

## Split

- **OpenFleet core**: config loading, server/session plumbing, prompt delivery, supervisor dispatch.
- **Deployment config**: workspace-specific prompts, job names, and paths.
- **Live wrappers**: compatibility entrypoints in `~/.cairn/system/bin`.

## Commands

- `deployment_prompt`: prompt a deployment's parent session.
- `supervisor_tick`: load a deployment config plus a named job and send that job prompt.

## Example

The Cairn example lives at `examples/cairn/deployment.json` and defines jobs like:

- `morning`
- `heartbeat`
- `overnight_queue`
- `market_open`
- `nightly_reflection`
