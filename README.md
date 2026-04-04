# OpenFleet

Harness-agnostic agent fleet orchestration. Run AI agents across Claude Code, OpenCode, Codex, and any CLI tool — managed through one control plane with real-time messaging.

## Why

AI CLI tools are siloed. Claude Code, OpenCode, and Codex each have their own session model, communication protocol, and context management. OpenFleet unifies them into one fleet with shared state, cross-harness messaging, task routing, and observability.

Not every task deserves your most expensive model. Use Claude Opus for orchestration, GPT for coding, local 7B models for monitoring. OpenFleet routes work to the right agent on the right model.

## Quick Start

```bash
git clone https://github.com/twaldin/openfleet.git
cd openfleet && npm install

# Interactive setup — creates ~/.openfleet/ with all config
node bin/openfleet init

# Cold-boot the entire fleet (tmux session + infra + agents)
node bin/openfleet start

# Or start manually
node bin/openfleet status
node bin/openfleet spawn my-coder --harness opencode --model gpt-5.4 --dir ~/project
node bin/openfleet send my-coder "Fix the failing test in src/auth.js"
```

## Architecture

```
You (Discord / Terminal)
  |
  v
Orchestrator (Claude Code / OpenCode / Codex)
  |
  +-- Remote Gateway (Discord — real-time message routing + status boards)
  +-- Cron Scheduler (heartbeat, periodic scans, market hours)
  +-- Task Pipeline (create -> dispatch -> execute -> review -> merge)
  +-- Web Dashboard (fleet health, terminal panes, event stream)
  |
  +-- Agent: coder (any harness, worktree-isolated)
  +-- Agent: evaluator (code review, lightweight model)
  +-- Agent: monitor (persistent, VPS health checks)
  +-- Agent: trader (persistent, market analysis)
  +-- Agent: <any> (spawn on demand)
```

### Harnesses

| Harness | Communication | Best For |
|---------|---------------|----------|
| **Claude Code** | tmux send-keys | Orchestrator, complex reasoning |
| **OpenCode** | HTTP session API | Workers, programmatic control |
| **Codex** | tmux send-keys + `--full-auto` | Unattended coding, GPT-native |

### State Model

All state lives in `~/.openfleet/` as flat JSON files — no database, no daemon required:

```
~/.openfleet/
  agents.json        Agent identities, roles, models, channels
  registry.json      Live session metadata
  tasks.json         Task lifecycle (created -> dispatched -> completed)
  jobs.json          Work units dispatched to agents
  workflows.json     Multi-step pipelines
  blockers.json      Work blocked on human input
  cron.json          Scheduled jobs (prompts, targets, intervals)
  events.jsonl       Append-only event log
  agents/            Per-agent workspaces (SOUL.md, MEMORY.md, state)
```

### Agent Workspaces

Each agent gets a workspace at `~/.openfleet/agents/<name>/` with:
- `SOUL.md` — identity, role, capabilities
- `MEMORY.md` — durable memory across sessions
- `HEARTBEAT.md` — periodic checklist
- `state.md` — current operational state
- `.opencode/` or `.claude/` — harness session data

## CLI Reference

```
openfleet <command> [args...]

LIFECYCLE
  start               Cold-boot fleet (tmux + gateway + cron + dashboard + agents)
  init                Interactive setup wizard
  respawn             Bring dormant persistent agents back online
  compact <agent>     Save agent state for context reset

STATE
  status              Fleet dashboard
  lifecycle status    Detailed agent health
  watch               Interactive TUI dashboard

AGENTS
  spawn <name>        Spawn agent (--harness, --model, --dir, --worktree)
  send <agent> <msg>  Message any agent (cross-harness)
  kill <name>         Stop an agent
  attach <name>       Connect to agent tmux window

TASKS
  task create|list|update   Task lifecycle
  dispatch                  Dispatch job to agent
  complete <job-id>         Report job completion

COMMUNICATION
  post <message>            Post to your remote channel (provider-agnostic)
  send <agent> <msg>        Message any agent (cross-harness)
  remote <subcommand>       Provider-specific operations

SCHEDULING
  cron --list         Show scheduled jobs
  cron                Start cron scheduler

OPERATIONS
  gateway             Start Discord gateway
  bridge              Start remote event bridge
  capture             Start passive agent capture daemon
  web-dashboard       Web dashboard (default :3000)
  maintenance         Run maintenance loop
  reconcile           Reconcile fleet state
```

## Remote Messaging

OpenFleet uses a remote gateway for real-time communication between you and the fleet. Currently supports Discord:

- **Inbound:** Messages route from Discord channels to agents in real-time
- **Outbound:** Agents post to their assigned Discord channels
- **Status boards:** Auto-updating embeds showing fleet health
- **Approval flow:** Permission prompts surface as embeds with reaction-based approve/deny
- **Read receipts:** Delivered messages get a reaction

Agents communicate outbound via `openfleet post "message"` — the bridge routes it to whatever remote is configured.

## Worktree Isolation

Coding agents can get their own git branch for safe parallel work:

```bash
openfleet spawn fix-auth --harness codex --model gpt-5.4 --dir ~/project --worktree
openfleet merge fix-auth   # runs test suite before merging
```

## Instruction Projection

OpenFleet writes agent instructions in the right format per harness:

| Harness | File | Format |
|---------|------|--------|
| Claude Code | `CLAUDE.md` | Markdown with OpenFleet section |
| OpenCode | `.opencode/agents/<name>.md` | Agent config with frontmatter |
| Codex | `AGENTS.md` | Markdown with OpenFleet section |

Instructions include identity, role playbook, Discord channels, completion protocol, blocker protocol, and all CLI commands the agent needs.

## Project Structure

```
bin/                    CLI entry points (24 scripts)
  openfleet             Unified CLI
  start                 Cold-boot script
  init                  Setup wizard
  spawn                 Harness-agnostic agent spawner
  send                  Cross-harness message routing
  discord-gateway       Real-time Discord bot
  cron                  Scheduled task runner
  agent-lifecycle       Health checks, respawn, compact
  dashboard             Web UI server
  ...

core/                   Runtime modules
  runtime/              State management (13 modules)
  harness/              Harness adapters
  remote/               Remote messaging adapters
  routing.js            Channel binding + message routing
  dispatch.js           Job dispatch + profile selection
  instructions.js       Agent instruction projection
  ops.js                Observability + dashboards
  ...

internal/               28 internal service scripts
lib/                    Shared utilities
test/                   86 tests
```

## Roadmap

### Planned Harnesses
- **Aider** — Model-agnostic CLI, `--message` + `--yes-always` for unattended operation. Trivial tmux integration.
- **Gemini CLI** — Google's Claude Code competitor. Same tmux send-keys pattern. Gets Gemini models natively.
- **Goose** — Block's MCP-native CLI. Headless mode via `goose run --text "..."`.
- **Amazon Q CLI** — AWS-integrated agent. Useful for infrastructure-heavy work.

### Planned Models
- Gemini 2.5 Pro/Flash (via Gemini CLI or API)
- Llama 4 Maverick/Scout (via cloud endpoints or Ollama)
- DeepSeek V3 (budget cloud coder, OpenAI-compatible API)
- Mistral Large / Codestral (via Mistral API)
- Qwen 2.5 Coder 32B (local via Ollama)

### Planned Remote Interfaces
- **Telegram** — Bot API, simple polling or webhooks. Best mobile experience.
- **Slack** — Bolt SDK, Socket Mode. For team environments.
- **SMS/Twilio** — Critical alert escalation.
- **Webhooks** — ntfy.sh, Pushover for lightweight push notifications.
- **Email** — Daily briefings and summaries via SMTP/Gmail API.
- **Nginx reverse proxy** — Expose web dashboard securely for remote access.

### Infrastructure
- Docker containerization for portable deployments
- Multi-host support (remote VPS agents via SSH)
- Nginx-proxied dashboard for mobile/remote access

## Development

```bash
npm test          # 86 tests
npm test -- --watch   # watch mode
node bin/openfleet status   # verify fleet
```

## License

MIT
