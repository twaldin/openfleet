# OpenFleet v1 Spec

Status: draft for implementation

## Purpose

OpenFleet v1 is the smallest release that proves a reusable OpenCode-based fleet can run the live `cairn` control plane without depending on the current tmux/Claude bridge as the primary abstraction.

The order for v1 is strict:

1. spec
2. implement
3. test on the live Cairn system

Do not expand scope before the current step is validated in the live system.

## Product definition

OpenFleet v1 is a single-workspace control plane with:

- one persistent parent session
- one managed worker session
- session-native messaging
- compatibility with the current Discord reply path during migration

v1 is release-scoped, not platform-scoped. It proves one real deployment first, then repeats that pattern.

## Repo split

### `~/openfleet`

Reusable runtime.

It owns:

- session and server plumbing
- agent/session identity primitives
- deployment schema and validation
- CLI and API surface for run, resume, send, status, and events
- shared adapters and generic docs

Recommended internal split:

- `core/` — source of truth and control plane
- `ops/` — operator UI over core
- `remote/` — external adapters like Discord, Telegram, web, SSH

### `~/cairn`

Live deployment workspace.

It owns:

- the Cairn deployment manifest
- agent identity files
- named job prompts
- prompt templates
- compatibility wrappers and bootstrap scripts
- workspace-specific config for the live release

### Remote hosts

Remote hosts are deployment targets, not a separate product line.

They carry only what is needed to run the deployment:

- runtime
- deployment manifest
- session bootstrap material

Remote state is not the source of truth.

## Source of truth

Order of authority:

1. `~/openfleet` runtime schema and code
2. `~/cairn` deployment files and prompts
3. `~/.openfleet/` runtime state
4. tmux panes and Discord messages as transient views/transports

If these disagree, code and deployment files win over runtime state, and runtime state wins over presentation layers.

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

Deployment files live in the ops repo under a release directory, e.g. `deployments/<name>/`, plus per-agent folders for identity and prompts.

The deployment manifest is the release contract. Runtime code reads it; runtime state does not rewrite it.

### Release-scoped deployment object

```json
{
  "deployment_id": "dep_cairn_v1",
  "name": "cairn",
  "mode": "local",
  "server": {
    "url": "http://127.0.0.1:4096",
    "transport": "http"
  },
  "runtime": {
    "host": "darwin-arm64",
    "workspace_root": "/Users/twaldin/cairn",
    "state_dir": "/Users/twaldin/.openfleet"
  },
  "profiles": ["cairn", "worker", "stock-monitor"],
  "adapters": ["cli", "discord"],
  "features": {
    "mcp": false,
    "remote_tools": false,
    "structured_updates": true
  }
}
```

### Deployment rules

- one deployment may point at one shared local server
- a deployment can host multiple agents and sessions
- `mode=local` is the only required v1 mode
- remote deployments may exist, but are adapter-backed rather than separately modeled

## Agent identity model

Each agent is described by four file types:

- `core.md` — stable identity, role, permissions, invariants
- `state.md` — mutable runtime state, current focus, last session, active work
- `jobs/` — named job definitions for release-scoped work units
- `prompts/` — reusable prompt templates for startup, resume, and job execution

Rules:

- `core.md` is authoritative for identity
- `state.md` is authoritative for current runtime state
- `jobs/` is authoritative for what the agent may be asked to do
- `prompts/` is authoritative for how the agent is instructed

Agents should treat these files as declarative inputs, not as a place to store ad hoc logs or tool output.

## Runtime state

Canonical runtime state lives outside the repos in `~/.openfleet/`.

Use it for:

- session metadata
- server connection state
- worker registry
- cursors, checkpoints, and logs
- recovery data after restart

`~/.cairn/` may mirror selected compatibility state during migration, but `~/.openfleet/` is the OpenFleet v1 source of truth for runtime state.

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
- write state back through approved runtime/state locations

Agents do not edit core code paths directly. They request work from core, report progress to core, and persist mutable state only in sanctioned locations.

For v1, the interaction surface is CLI-first. MCP/tooling is deferred.

## Event model

OpenFleet is event-driven. All meaningful state changes must be emitted as structured events.

### Event shape

```json
{
  "id": "evt_01J...",
  "type": "agent.started",
  "ts": "2026-04-01T18:22:11.123Z",
  "fleet": "openfleet",
  "run_id": "run_01J...",
  "session_id": "sess_01J...",
  "agent_id": "agent_cairn",
  "parent_event_id": "evt_01J...",
  "seq": 17,
  "severity": "info",
  "payload": {},
  "meta": {
    "source": "cli",
    "schema_version": "1.0"
  }
}
```

### Required fields

- `id` — globally unique event id
- `type` — namespaced event type
- `ts` — RFC3339 timestamp
- `fleet` — fixed to `openfleet` for v1
- `run_id` — top-level orchestration run
- `session_id` — active agent or operator session
- `agent_id` — emitting agent, if applicable
- `seq` — monotonically increasing per `session_id`
- `payload` — event-specific data

### Event types in v1

- lifecycle: `run.started`, `run.completed`, `run.failed`
- session: `session.created`, `session.resumed`, `session.ended`
- agent: `agent.started`, `agent.updated`, `agent.completed`, `agent.failed`
- tooling: `tool.requested`, `tool.completed`, `tool.failed`
- output: `message.created`, `artifact.created`, `log.appended`
- adapter: `adapter.connected`, `adapter.disconnected`, `adapter.heartbeat`

### Ordering and delivery

- events are append-only
- consumers treat delivery as at-least-once
- duplicates are handled by `id`
- ordering is guaranteed only within a single `session_id` via `seq`
- cross-session ordering is not guaranteed

## Agent manifest schema

Agents are declared by manifest, not by code convention.

```json
{
  "agent_id": "cairn",
  "name": "cairn",
  "version": "1.0",
  "description": "Fleet orchestrator agent",
  "entrypoint": "bin/cairn",
  "lifecycle": "persistent",
  "permissions": {
    "filesystem": ["workspace", "state_dir"],
    "network": ["localhost"],
    "tools": ["shell", "git"]
  },
  "interfaces": {
    "events": true,
    "cli": true,
    "mcp": false
  },
  "routing": {
    "default_channel": "operator",
    "accepts_replies": true
  },
  "limits": {
    "max_concurrent_tasks": 1,
    "heartbeat_seconds": 30
  }
}
```

Manifest contract:

- `agent_id` is stable and unique within a deployment
- `entrypoint` is the canonical launch command
- `lifecycle` is one of `persistent` or `ephemeral`
- `permissions` are declarative, not advisory
- `interfaces.mcp=false` is allowed in v1

Required runtime behavior:

- an agent must emit `agent.started` when launched
- it must emit `agent.completed` or `agent.failed` before exit
- persistent agents must resume using the same `agent_id` and `session_id` where possible

## Structured agent updates

Agents must emit structured updates instead of relying on freeform console text.

```json
{
  "type": "agent.updated",
  "payload": {
    "status": "working",
    "summary": "Drafting the contracts section",
    "progress": 0.42,
    "details": [
      "event model drafted",
      "deployment schema in progress"
    ],
    "blocking": false
  }
}
```

Rules:

- updates must be small and incremental
- `summary` is required
- `progress` is optional but must be normalized to `0..1` if present
- freeform logs may still exist, but they are secondary to structured updates
- terminal output is not the contract; emitted events are

Consumers should derive status boards, progress bars, notifications, and history timelines from events rather than scraping console text.

## CLI contract

The CLI is the primary v1 operator interface.

Required commands:

- `openfleet init`
- `openfleet status`
- `openfleet run <agent>`
- `openfleet resume <session>`
- `openfleet send <session> <message>`
- `openfleet events [--since <cursor>]`
- `openfleet deploy status`

Guarantees:

- commands are machine-readable by default
- human-readable output is a rendering of the same underlying data
- every state-changing command returns resulting event ids
- `--json` is supported wherever practical

State-changing commands should return a shape like:

```json
{
  "ok": true,
  "run_id": "run_01J...",
  "session_id": "sess_01J...",
  "events": ["evt_01J..."],
  "next": "openfleet events --since evt_01J..."
}
```

Failures should include:

- stable error code
- short message
- last emitted event id
- whether the operation is retryable

## Core API boundaries

OpenFleet v1 keeps the core small.

Core owns:

- identity of runs, sessions, agents, and events
- event append/read APIs
- manifest validation
- session lifecycle
- adapter registration
- delivery cursors

Core does not own:

- UI rendering
- tool execution specifics
- remote provider semantics
- agent business logic
- external notification formatting

Boundary rule:

If a behavior is required for multiple adapters or agents, it belongs in core. If it is presentation-specific or provider-specific, it stays outside core.

## Remote adapters

Remote adapters are consumers of the event stream and translators to external surfaces.

Responsibilities:

- subscribe to events from core
- maintain a durable cursor
- translate selected events to the target channel
- acknowledge deliveries back to core
- avoid rewriting event meaning

Rules:

- adapters consume append-only events
- adapters may filter events, but must not invent core state
- adapters may enrich messages for their channel, but the original event remains canonical
- acknowledgements are per event id

Example adapter behavior:

- Discord adapter posts `message.created`, `agent.updated`, and completion events
- CLI adapter renders the full stream locally
- a future MCP adapter may expose the same events as tools, but that is not required for v1

## Minimum operator observability

OpenFleet v1 does not need a polished dashboard, but it does need a real observability surface that replaces blind tmux guessing.

Minimum requirement:

- operator can see which agents/sessions exist
- operator can see current model and host for a session
- operator can inspect recent session messages and event history
- operator can follow a live session/event stream
- operator can see last known error or blocked state

This is the first `ops` contract.

### Required operator views in v1

- `openfleet ops agents`
  - list agents, lifecycle, session id, model, host, status
- `openfleet ops inspect <agent>`
  - show session metadata, last update, last error, last reply, current job
- `openfleet ops tail <agent>`
  - show recent transcript/messages/events for a session
- `openfleet ops follow <agent>`
  - live-follow the session/event stream
- `openfleet ops capture <agent>`
  - emit a snapshot of the current session transcript and metadata

### Design rule

Observability should come from session APIs and emitted events first, not from scraping terminal panes.

tmux capture remains useful as a fallback attachment/debugging surface, but it is not the canonical observability API.

### Release rationale

This is required because small local models and remote workers can appear idle or confusing from a terminal alone. Operators must be able to inspect the real session transcript, tool-call state, and recent outputs without guessing.

## CLI-first, MCP later

OpenFleet v1 is explicitly CLI-first.

CLI-first in v1:

- bootstrap and init
- run, resume, send
- status and inspect
- event streaming
- deployment status
- agent lifecycle management

Deferred beyond v1:

- arbitrary third-party tool catalogs
- rich external integrations
- tool marketplace semantics
- advanced remote control surfaces
- provider-specific task primitives

Rule of thumb:

If a capability is needed to run and observe the fleet, it ships in CLI plus core API now. If it is only needed to extend the ecosystem, it waits.

## What v1 must ship

v1 must ship:

- one project-scoped OpenFleet deployment for `~/cairn`
- one shared local OpenCode server with durable state/log paths
- one persistent parent session (`cairn`) that can be resumed programmatically
- one managed worker session with stored metadata outside the TUI
- session-native messaging between parent and worker sessions
- compatibility for the current Discord reply path during migration
- a documented bootstrap path for remote worker hosts
- validation that the live system still works before cutover

## Explicit non-goals

v1 does not need to ship:

- generalized multi-tenant fleet platform
- automatic host discovery or auto-scaling
- full replacement of `claudecord` on day one
- removal of tmux from all workflows
- perfect cross-platform parity on first release
- web UI, dashboarding, or analytics
- zero-touch provisioning
- job scheduling beyond the first small set of named worker roles

Non-goal clarification: v1 does not need a polished TUI or web dashboard, but it does need the minimum operator observability commands above.

## Validation milestones

### Milestone 1: Spec complete

- v1 scope is written down
- non-goals are explicit
- host roles are assigned
- cutover criteria are defined

### Milestone 2: Local parent session

- `cairn` parent session starts and resumes cleanly
- shared OpenCode server is reachable
- session state survives restart

### Milestone 3: First worker session

- one worker host boots from documented steps
- worker registers metadata outside the TUI
- parent can send a message to the worker and receive a response

### Milestone 4: Live path parity

- current Discord reply path still works
- existing Cairn/claudecord/tmux bridge remains usable
- no user-facing regression in the current production workflow

### Milestone 5: Cutover readiness

- at least one remote worker host is stable for a full work session
- failure/restart behavior is understood
- rollback path to the current bridge is documented

## Migration strategy

v1 is a side-by-side migration, not a hard switch.

Keep the current system intact while OpenFleet is proven:

- keep `claudecord` as the live Discord bridge until the new path is stable
- keep the tmux bridge available as a fallback
- keep compatibility wrappers in `~/.cairn/system/bin`
- keep the current reply path working while OpenFleet adds its own session-native messaging

Migration steps:

1. preserve current production behavior
2. route new OpenFleet sessions through the same workspace identity
3. prove parent/worker messaging without pane injection
4. move one job family at a time
5. cut over only after a full live-system validation pass

## Host roles and bootstrap

### MacBook

Primary control-plane host.

- runs the parent `cairn` session
- runs the shared OpenCode server for development and orchestration
- used for interactive debugging and deployment updates

### Gaming PC

Primary heavy worker host.

- used for long-running or compute-heavy worker sessions
- good fallback for parallel jobs and durable uptime while plugged in

### ThinkPad 1

Persistent remote worker.

- lightweight, always-available worker host
- good for routine queue work and validation of remote bootstrap

### ThinkPad 2

Spare / recovery worker.

- duplicate bootstrap target
- used for failover testing, backups, and proving the fleet can recover from one offline host

### Bootstrap requirements

Each host must have:

- working shell environment
- Git
- OpenCode installed and on PATH
- access to the `openfleet` repo and `~/cairn` workspace as needed
- authentication for the shared OpenCode server and required model access
- writable local state directory for sessions/logs
- release bootstrap script or wrapper commands

Bootstrap sequence:

1. install prerequisites
2. clone or sync required repo/workspace
3. configure the OpenFleet deployment file for that host role
4. start or point at the shared OpenCode server
5. launch the named parent or worker session
6. verify message delivery and persistence
7. record the host as active in session metadata

Host-specific notes:

- MacBook: first known-good bootstrap target
- Gaming PC: confirm wake/sleep behavior and persistence before assigning critical jobs
- ThinkPads: verify unattended restart, SSH/session access, and stable network reachability

## Release risks

- bridge drift before parity is proven
- host heterogeneity across MacBook, PC, and ThinkPads
- session persistence bugs after restart
- messaging loss across real hosts
- cutover regression from replacing the current reply path too early
- bootstrap fragility from overly manual host setup
- over-scope before the first worker path is stable

## v1 acceptance standard

OpenFleet v1 is ready to implement against the live system when:

- the architecture, contracts, release scope, and host roles are explicit
- the migration boundary with the current `claudecord`/tmux bridge is explicit
- the system can be built and tested without inventing new foundational abstractions mid-flight

OpenFleet v1 is ready to claim success only after the implemented system passes the live validation milestones above.
