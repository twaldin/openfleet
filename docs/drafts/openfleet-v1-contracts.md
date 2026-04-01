# OpenFleet v1 Contracts

This section defines the release-scoped contracts for OpenFleet v1. The goal is to make the system interoperable without freezing the internal implementation.

## 1. Event model

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

- `id`: globally unique event id.
- `type`: namespaced event type.
- `ts`: RFC3339 timestamp.
- `fleet`: fixed to `openfleet` for v1.
- `run_id`: the top-level orchestration run.
- `session_id`: the active agent or operator session.
- `agent_id`: emitting agent, if applicable.
- `seq`: monotonically increasing per `session_id`.
- `payload`: event-specific data.

### Event types in v1

- Lifecycle: `run.started`, `run.completed`, `run.failed`
- Session: `session.created`, `session.resumed`, `session.ended`
- Agent: `agent.started`, `agent.updated`, `agent.completed`, `agent.failed`
- Tooling: `tool.requested`, `tool.completed`, `tool.failed`
- Output: `message.created`, `artifact.created`, `log.appended`
- Adapter: `adapter.connected`, `adapter.disconnected`, `adapter.heartbeat`

### Ordering and delivery

- Events are append-only.
- Consumers must treat delivery as at-least-once.
- Duplicates are handled by `id`.
- Ordering is guaranteed only within a single `session_id` via `seq`.
- Cross-session ordering is not guaranteed.

### Update semantics

Agents do not mutate prior events. They emit new events representing state transitions.

Examples:

- `agent.started` establishes the agent instance.
- `agent.updated` reports progress, notes, or state.
- `tool.requested` and `tool.completed` bracket tool usage.
- `message.created` carries user-visible text.

## 2. Deployment schema

OpenFleet v1 supports a small, explicit deployment model.

### Deployment object

```json
{
  "deployment_id": "dep_prod_01",
  "name": "prod",
  "mode": "local",
  "server": {
    "url": "http://127.0.0.1:3030",
    "transport": "http"
  },
  "runtime": {
    "host": "darwin-arm64",
    "workspace_root": "/Users/twaldin/openfleet",
    "state_dir": "/Users/twaldin/.openfleet"
  },
  "profiles": ["cairn"],
  "adapters": ["cli", "discord"],
  "features": {
    "mcp": false,
    "remote_tools": false,
    "structured_updates": true
  }
}
```

### v1 deployment rules

- One deployment may point at one shared local server.
- A deployment can host multiple agents and sessions.
- `mode=local` is the only required v1 mode.
- Remote deployments may exist, but are adapter-backed rather than separately modeled.

### Non-goals for v1

- Multi-region orchestration.
- Autoscaling.
- Dynamic plugin discovery.
- Cross-deployment federation.

## 3. Agent manifest schema

Agents are declared by manifest, not by code convention.

### Agent manifest

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

### Manifest contract

- `agent_id` is stable and unique within a deployment.
- `entrypoint` is the canonical launch command.
- `lifecycle` is one of `persistent` or `ephemeral`.
- `permissions` are declarative, not advisory.
- `interfaces.mcp=false` is allowed in v1.

### Required runtime behavior

- An agent must emit `agent.started` when launched.
- It must emit `agent.completed` or `agent.failed` before exit.
- Persistent agents must resume using the same `agent_id` and `session_id` where possible.

## 4. CLI contract

The CLI is the primary v1 operator interface.

### Required commands

- `openfleet init`
- `openfleet status`
- `openfleet run <agent>`
- `openfleet resume <session>`
- `openfleet send <session> <message>`
- `openfleet events [--since <cursor>]`
- `openfleet deploy status`

### CLI guarantees

- Commands are machine-readable by default.
- Human-readable output is a rendering of the same underlying data.
- Every state-changing command must return the resulting event ids.
- `--json` is supported everywhere practical.

### CLI output contract

State-changing commands must return:

```json
{
  "ok": true,
  "run_id": "run_01J...",
  "session_id": "sess_01J...",
  "events": ["evt_01J..."],
  "next": "openfleet events --since evt_01J..."
}
```

### Failure contract

Failures must include:

- a stable error code,
- a short message,
- the last emitted event id,
- whether the operation is retryable.

## 5. Core API boundaries

OpenFleet v1 keeps the core small.

### Core owns

- identity of runs, sessions, agents, and events,
- event append/read APIs,
- manifest validation,
- session lifecycle,
- adapter registration,
- delivery cursors.

### Core does not own

- UI rendering,
- tool execution specifics,
- remote provider semantics,
- agent business logic,
- external notification formatting.

### Core APIs

- `POST /runs`
- `POST /sessions`
- `POST /sessions/{id}/messages`
- `GET /events?since=`
- `GET /sessions/{id}`
- `GET /agents/{id}`
- `POST /adapters/{id}/connect`
- `POST /adapters/{id}/ack`

### Boundary rule

If a behavior is required for multiple adapters or agents, it belongs in core. If it is presentation-specific or provider-specific, it stays outside core.

## 6. Structured updates from agents

Agents must emit structured updates instead of freeform logs for meaningful progress.

### Update contract

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

### Update rules

- Updates must be small and incremental.
- `summary` is required.
- `progress` is optional but must be normalized to `0..1` if present.
- Freeform logs may still exist, but they are secondary to structured updates.
- Terminal output is not the contract; emitted events are.

### User-facing state

Consumers should derive:

- status boards,
- progress bars,
- notifications,
- history timelines,

from events, not from scraping console text.

## 7. Remote adapter consumption

Remote adapters are consumers of the event stream and translators to external surfaces.

### Adapter responsibilities

- subscribe to events from core,
- maintain a durable cursor,
- translate selected events to the target channel,
- acknowledge deliveries back to core,
- avoid rewriting event meaning.

### Adapter contract

- Adapters consume append-only events.
- Adapters may filter events, but must not invent core state.
- Adapters may enrich messages for their channel, but the original event remains canonical.
- Acknowledgements are per event id.

### Example adapter behavior

- Discord adapter posts `message.created`, `agent.updated`, and completion events.
- CLI adapter renders the full stream locally.
- A future MCP adapter may expose the same events as tools, but that is not required for v1.

## 8. CLI-first vs MCP/tooling-later

OpenFleet v1 is explicitly CLI-first.

### CLI-first in v1

- bootstrap/init,
- run/resume/send,
- status and inspect,
- event streaming,
- deployment status,
- agent lifecycle management.

### MCP/tooling-later

- arbitrary third-party tool catalogs,
- rich external integrations,
- tool marketplace semantics,
- advanced remote control surfaces,
- provider-specific task primitives.

### v1 rule of thumb

If a capability is needed to run and observe the fleet, it ships in CLI + core API now. If it is only needed to extend the ecosystem, it waits.

## 9. Release scope summary

For v1, the contracts guarantee:

- one stable event model,
- one deployment shape,
- one agent manifest format,
- one CLI contract,
- one small core API boundary,
- structured agent progress updates,
- adapter-friendly event consumption,
- CLI-first operation with MCP deferred.

Anything outside that is intentionally out of scope for the release.
