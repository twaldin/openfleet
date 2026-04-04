# Remote Abstraction Layer

## Problem

Agents currently call Discord directly via `node ~/openfleet/bin/remote discord post --channel "channel://monitor" --message "..."`. This is:

- **Discord-specific** — can't swap to Telegram/Slack without re-instructing every agent
- **Fragile** — agents must remember the full command and their channel name
- **Missing passive visibility** — only intentional posts surface; errors, completions, and blockers go unnoticed unless the agent explicitly reports them

## Solution

Unify all outbound communication through an event-driven remote bridge with three signal sources.

### Architecture

```
PRODUCERS                              CONSUMER
─────────                              ────────

1. Intentional (agent calls             Remote Bridge
   `openfleet post "message"`)            tail events.jsonl
        |                                 filter by event_routing config
        v                                 format per provider
   events.jsonl ◄────────────────►     Remote Bridge
        ^                                 ├── Discord adapter
        |                                 ├── Telegram adapter (future)
2. Lifecycle (system events              ├── Slack adapter (future)
   spawn/die/respawn/compact)            └── Webhook adapter (future)
   [already emitting to events.jsonl]
        ^
        |
3. Capture (passive monitoring)
   tmux pane snapshots → diff → pattern match → emit
   opencode HTTP API poll → diff → emit
```

### Event Types

| Event | Source | Payload |
|-------|--------|---------|
| `agent.post` | Agent via `openfleet post` | `{ message, channel? }` |
| `agent.error` | Capture daemon | `{ error }` |
| `agent.blocked` | Capture daemon or agent | `{ reason }` |
| `agent.task_completed` | Capture daemon or agent | `{ summary }` |
| `session.spawned` | Fleet lifecycle (existing) | `{ agent, harness, model }` |
| `session.died` | Fleet lifecycle | `{ agent, reason }` |
| `agent.respawned` | Fleet lifecycle (existing) | `{ agent }` |
| `agent.compacted` | Fleet lifecycle | `{ agent }` |

### Configuration

```json
// ~/.openfleet/remote.json
{
  "provider": "discord",
  "discord": {
    "token_env": "OPENFLEET_DISCORD_TOKEN",
    "guild": "1489485212235600012"
  },
  "telegram": {
    "token_env": "OPENFLEET_TELEGRAM_TOKEN",
    "chat_id": null
  },
  "capture": {
    "enabled": true,
    "default_interval_seconds": 30,
    "agents": {
      "monitor": { "interval": 120 },
      "trader": { "interval": 240 },
      "coder-gpt": { "enabled": false }
    }
  },
  "event_routing": {
    "agent.post":           { "post": true, "channel": "auto" },
    "agent.error":          { "post": true, "channel": "alerts" },
    "agent.blocked":        { "post": true, "channel": "alerts" },
    "agent.task_completed": { "post": true, "channel": "auto" },
    "session.spawned":      { "post": true, "channel": "fleet-status" },
    "session.died":         { "post": true, "channel": "fleet-status" },
    "agent.respawned":      { "post": true, "channel": "fleet-status" },
    "agent.compacted":      { "post": false }
  }
}
```

`"channel": "auto"` resolves to the agent's assigned channel from `agents.json`.

### Components

#### 1. `openfleet post` command (`bin/post`)

Simple CLI that agents call to post a message. Remote-agnostic.

```bash
# Agent just runs:
openfleet post "VPS healthy, all endpoints responding"

# Internally:
# - Resolves agent name from env (OPENFLEET_AGENT_ID) or tmux window name
# - Emits agent.post event to events.jsonl
# - Bridge picks it up and routes to configured remote + channel
```

#### 2. Remote bridge (`bin/remote-bridge`)

Long-running process that tails `events.jsonl` and routes matched events to the configured remote provider.

- Replaces the current Discord gateway's outbound posting
- The gateway keeps handling inbound (Discord → agent) for now
- Each provider is an adapter module in `core/remote/`

Provider adapter interface:
```js
// core/remote/discord.js (already exists, refactor)
// core/remote/telegram.js (new)
// core/remote/webhook.js (new)

module.exports = {
  name: "discord",
  init(config) { /* connect */ },
  post(channel, message, metadata) { /* send */ },
  formatEvent(event) { /* provider-specific formatting */ },
  destroy() { /* cleanup */ },
}
```

#### 3. Capture daemon (`bin/capture` or integrated into cron)

Periodic tmux pane capture with diff + pattern matching.

```
For each agent with capture enabled:
  1. tmux capture-pane -t openfleet:<agent> -p
  2. Diff against ~/.openfleet/capture/<agent>.last
  3. Run patterns on new lines:
     - /error|Error|ENOENT|FATAL|panic/i → agent.error
     - /blocked|waiting for|need approval/i → agent.blocked
     - /completed|done|finished|task.*complete/i → agent.task_completed
  4. Save current capture to .last file
  5. Emit matched events

For OpenCode agents (have HTTP API):
  1. Poll session for new messages since last check
  2. Parse structured responses (no regex needed)
  3. Emit events from parsed content
```

#### 4. Agent instruction update

Update instruction projection to give agents the new command:

Before:
```
## Discord
Post: node ~/openfleet/bin/remote discord post --channel "channel://monitor" --message "..."
```

After:
```
## Communication
Post to your channel: openfleet post "message"
```

### Migration Path

1. Build `openfleet post` + event emission (backward compatible, existing remote still works)
2. Build remote bridge with Discord adapter (parallel to existing gateway)
3. Build capture daemon
4. Update agent instructions to use `openfleet post`
5. Remove direct Discord commands from agent playbooks
6. Gateway becomes inbound-only; bridge handles all outbound

### Inbound (future scope)

The bridge is initially outbound-only. Inbound routing (remote → agent) stays in the Discord gateway for now. Unifying inbound into the bridge is a separate spec — it needs channel mapping, message parsing, and agent routing logic that the gateway already handles.

## Tasks

1. **`openfleet post` command** — bin/post, resolves agent identity, emits agent.post event
2. **`remote.json` config schema** — core/remote/config.js, load/validate, migrate existing discord.json
3. **Remote provider adapter interface** — core/remote/adapter.js, define interface + Discord adapter
4. **Remote bridge** — bin/remote-bridge, tail events, route to provider, run as tmux window
5. **Capture daemon** — bin/capture, tmux pane diff + pattern match, emit events
6. **OpenCode capture adapter** — capture via HTTP API instead of tmux scraping
7. **Update agent instructions** — instruction projection uses `openfleet post` instead of direct Discord
8. **Tests** — test coverage for post command, bridge routing, capture patterns, adapter interface
9. **Wire into `openfleet start`** — start script launches remote-bridge alongside gateway
