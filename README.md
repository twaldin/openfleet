# OpenFleet

Harness-agnostic agent fleet orchestration. One control plane for Claude Code, OpenCode, Codex, and any AI CLI tool.

Run a team of AI agents across different providers and models — Claude Opus for orchestration, GPT for coding, local models for monitoring — all managed through a unified system with Discord as the control panel.

## Why

- **Not every task deserves your most expensive model.** Use Claude for orchestration, GPT for coding, local 7B for formatting. OpenFleet routes work to the right agent on the right model.
- **CLI tools are siloed.** Claude Code, OpenCode, and Codex each have their own session model. OpenFleet unifies them into one fleet with shared state, task routing, and observability.
- **Agent teams need infrastructure.** Spawning, messaging, health checks, worktree isolation, Discord routing, permission handling, cron scheduling — OpenFleet handles the plumbing so agents can focus on work.

## Quick Start

```bash
# Clone and install
git clone https://github.com/twaldin/openfleet.git
cd openfleet
npm install

# Interactive setup
node bin/init

# Or manual setup
mkdir -p ~/.openfleet
cp examples/template-deployment.json ~/.openfleet/deployment.json
# Edit with your paths and preferences

# Check fleet status
node bin/openfleet status

# Spawn an agent
node bin/openfleet spawn my-coder --harness codex --model gpt-5.4 --dir ~/my-project

# Send it work
node bin/openfleet send my-coder "Fix the failing test in src/auth.js"

# Watch the fleet
node bin/openfleet watch
```

## Architecture

```
You (Discord / Terminal)
  |
  v
Orchestrator (Claude Code / OpenCode / Codex)
  |
  +-- Discord Gateway (real-time message routing + status boards)
  +-- Cron Scheduler (heartbeat, market hours, periodic scans)
  +-- Task Pipeline (create → dispatch → execute → review → merge)
  |
  +-- Agent: coder (OpenCode/GPT-5.4, worktree-isolated)
  +-- Agent: evaluator (OpenCode/GPT-5.4-mini, code review)
  +-- Agent: monitor (OpenCode/GPT-5.4-mini, persistent, VPS health)
  +-- Agent: trader (OpenCode/GPT-5.4, persistent, market analysis)
  +-- Agent: stock-monitor (OpenCode/local-7B, market hours only)
```

### Harness Adapters

| Harness | Communication | Best For |
|---------|--------------|----------|
| **Claude Code** | tmux send-keys | Orchestrator, complex reasoning |
| **OpenCode** | HTTP session API | Workers, programmatic control |
| **Codex** | tmux send-keys + --full-auto | Interactive coding, GPT-native |

### State Model

All state lives in `~/.openfleet/` as flat JSON files:

- `registry.json` — agent sessions and metadata
- `tasks.json` — task lifecycle (created → in-progress → completed)
- `jobs.json` — dispatched work units
- `workflows.json` — multi-step pipelines (coder.fix → evaluator.review)
- `blockers.json` — blocked work awaiting human input
- `profiles.json` — runtime profiles (harness + model + host combos)
- `events.jsonl` — append-only event log
- `orchestrator.json` — active orchestrator identity

No database. No daemon required. Everything is file-backed and inspectable.

## CLI Reference

```
openfleet <command> [args...]

STATE
  status              Fleet dashboard
  agents              List all agents and health
  watch               Interactive TUI dashboard
  lifecycle status    Detailed agent health

AGENTS
  spawn <name>        Spawn agent (--harness, --model, --worktree)
  send <agent> <msg>  Message any agent (cross-harness)
  kill <name>         Stop an agent
  respawn             Bring dormant persistent agents back
  compact <agent>     Save agent state for context reset

TASKS
  task create         Create a task
  task list           List tasks
  dispatch            Dispatch job to an agent
  complete <job-id>   Report job completion

FLEET
  cron --list         Show scheduled tasks
  cron                Start cron scheduler
  gateway             Start Discord gateway
  merge <name>        Merge worktree branch after review

DISCORD
  discord post        Post to a Discord channel
  poll                Poll Discord for messages
```

## Discord Integration

OpenFleet includes a real-time Discord gateway (ported from [claudecord](https://github.com/twaldin/claudecord)):

- **Inbound:** Discord messages route to agents in real-time via WebSocket gateway
- **Outbound:** Agents post to their Discord channels
- **Status boards:** Auto-updating embeds showing fleet health, tasks, and blockers
- **Read receipts:** Messages get a reaction when delivered
- **Permission watcher:** Agent permission prompts surface as Discord embeds with reaction-based approve/deny
- **Threads:** Ephemeral agents get Discord threads for isolated discussion

### Setup

1. Create a Discord bot at [discord.com/developers](https://discord.com/developers/applications)
2. Enable MESSAGE_CONTENT intent in Bot settings
3. Invite bot to your server with admin permissions
4. Run `openfleet init` and enter your bot token

## Worktree Isolation

When spawning coding agents, use `--worktree` to give each agent its own git branch:

```bash
# Agent works on isolated branch
openfleet spawn fix-auth --harness codex --model gpt-5.4 --dir ~/project --worktree

# After agent completes, merge with test validation
openfleet merge fix-auth
```

`merge` runs the full test suite before merging. If tests fail, the merge is rejected.

## Agent Instruction Projection

OpenFleet automatically writes agent instructions in the right format for each harness:

| Harness | File | Format |
|---------|------|--------|
| Claude Code | `CLAUDE.md` | Markdown with openfleet section |
| OpenCode | `.opencode/agents/<name>.md` | Agent config with frontmatter |
| Codex | `AGENTS.md` | Markdown with openfleet section |

Instructions include: agent identity, role playbook, Discord channels, completion protocol, blocker protocol, and all openfleet CLI commands.

## Runtime Profiles

Define available harness + model combinations in `profiles.json`:

```json
{
  "profiles": {
    "claude-opus-orchestrator": {
      "harness": "claude-code",
      "model": "opus-4.6",
      "role": "orchestrator",
      "cost_class": "high"
    },
    "opencode-gpt54-coder": {
      "harness": "opencode",
      "model": "gpt-5.4",
      "role": "coder",
      "cost_class": "high"
    },
    "opencode-local-monitor": {
      "harness": "opencode",
      "model": "qwen2.5-coder:32b",
      "role": "monitor",
      "cost_class": "local"
    }
  }
}
```

OpenFleet selects profiles based on role, cost preference, and rate-limit status. When one provider is rate-limited, work automatically routes to an available alternative.

## Development

```bash
# Run tests
npm test

# Run a specific test
node --test test/routing.test.js

# Check fleet status
node bin/openfleet status

# Start everything (gateway + cron + orchestrator)
node bin/openfleet gateway &
node bin/openfleet cron &
```

## Project Structure

```
bin/                    CLI scripts
  openfleet             Unified CLI entrypoint
  init                  Setup wizard
  spawn                 Agent spawner (any harness)
  send                  Universal message routing
  merge-worker          Worktree merge with test validation
  discord-gateway       Real-time Discord bot + MCP server
  cron                  Scheduled task runner
  agent-lifecycle       Fleet health management
  ...

core/                   Runtime modules
  runtime/              State management (tasks, jobs, workflows, etc.)
  harness/              Harness adapters (claude-code, opencode, codex)
  remote/               Discord adapter
  instructions.js       Agent instruction projection
  dispatch.js           Job dispatch + profile selection
  execute.js            Job execution routing
  continuation.js       Continue/wait/stop decisions
  ops.js                Observability surfaces
  ...

examples/               Example configurations
test/                   65 tests
```

## License

MIT
