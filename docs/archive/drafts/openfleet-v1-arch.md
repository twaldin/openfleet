# OpenFleet v1 architecture

## Product definition

OpenFleet v1 is the smallest release that turns a workspace into a runnable fleet control plane. It must prove one persistent parent session, one managed worker session, and one stable messaging path without depending on tmux or Discord as the primary system boundary.

v1 is release-scoped, not platform-scoped: it supports one real deployment first, then repeats that pattern.

## Repo split

### core

`~/openfleet` is the reusable runtime.

It owns:

- session and server plumbing
- agent/session identity primitives
- deployment schema and validation
- CLI / API surface for run, resume, send, status
- shared adapters and generic docs

### ops

`~/cairn` is the live deployment workspace.

It owns:

- the Cairn deployment manifest
- agent identity files (`core.md`, `state.md`)
- named job prompts
- prompt templates
- compatibility wrappers and bootstrap scripts
- workspace-specific config for the live release

### remote

Remote hosts are deployment targets, not a separate product line.

They carry a host-local checkout or synced bundle containing only what is needed to run the deployment: the runtime, the deployment manifest, and the session bootstrap material. Remote state is never the source of truth.

## Deployment model

A deployment is the unit of configuration and release.

Each deployment defines:

- workspace root
- shared OpenCode server location
- parent session name
- worker session names
- agent catalog
- job catalog
- adapter endpoints
- local runtime paths

Deployment files live in the ops repo under a release directory, e.g. `deployments/<name>/` plus per-agent folders for identity and prompts.

The deployment manifest is the release contract. Runtime code reads it; runtime state does not rewrite it.

## Agent identity model

Each agent is described by four file types:

- `core.md`: stable identity, role, permissions, invariants
- `state.md`: mutable runtime state, current focus, last session, active work
- `jobs/`: named job definitions for release-scoped work units
- `prompts/`: reusable prompt templates for startup, resume, and job execution

Rules:

- `core.md` is authoritative for identity.
- `state.md` is authoritative for current runtime state.
- `jobs/` is authoritative for what the agent may be asked to do.
- `prompts/` is authoritative for how the agent is instructed.

Agents should treat these files as declarative inputs, not as a place to store ad hoc logs or tool output.

## Runtime state

Canonical runtime state lives outside the repos in `~/.openfleet/`.

Use it for:

- session metadata
- server connection state
- worker registry
- cursors, checkpoints, and logs
- recovery data after restart

The live Cairn compatibility path may mirror selected files under `~/.cairn/` during migration, but `~/.openfleet/` is the OpenFleet v1 source of truth for runtime state.

## Source of truth

Order of authority:

1. `~/openfleet` runtime schema and code
2. `~/cairn` deployment files and prompts
3. `~/.openfleet/` runtime state
4. tmux panes and Discord messages as transient views/transports

If these disagree, code and deployment files win over runtime state, and runtime state wins over presentation layers.

## Session model

v1 uses explicit named sessions.

- one persistent parent session per deployment
- one or more managed worker sessions per deployment
- sessions have stable ids and restartable metadata
- session identity must survive TUI restarts

The parent session is the release control plane. Worker sessions are task executors. A session is logical first and terminal second.

## tmux role

tmux is an attachment layer only.

It may:

- host interactive panes
- provide operator convenience
- keep long-running terminals visible

It may not:

- define identity
- own routing
- store canonical state
- decide which agent is alive

## Discord role

Discord is an external adapter.

It may:

- receive status updates
- deliver replies to users
- expose operator-facing notifications

It may not:

- be the source of truth for sessions
- own agent state
- act as the control plane

## How agents interact with core

Agents interact with OpenFleet core through session-native operations:

- load deployment config
- read identity files
- resume or create sessions by name
- send messages through core APIs or CLI commands
- write state back through the approved runtime path

Agents do not edit core code paths directly. They request work from core, report progress to core, and persist mutable state only in the sanctioned runtime/state locations.

Core is responsible for identity, lifecycle, persistence, and delivery. Agents are responsible for task execution and state updates within their assigned boundary.
