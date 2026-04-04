# OpenFleet

Harness-agnostic orchestration for AI agent fleets.

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Node >=18](https://img.shields.io/badge/node-%3E%3D18-339933.svg)](package.json)
[![Harnesses 4](https://img.shields.io/badge/harnesses-4-8a2be2.svg)](#supported-harnesses)

## What Is OpenFleet

OpenFleet is a control plane for running AI agents across multiple CLI harnesses from one fleet runtime. It treats the orchestrator, coders, evaluators, monitors, and remotes as the same system: shared state, shared routing, shared lifecycle. You can mix harnesses, models, machines, and skills without rewriting the workflow every time.

## Quick Start

```bash
# 1. Initialize ~/.openfleet/
npx openfleet init

# 2. Boot tmux + infra windows + persistent agents
openfleet start

# 3. Spawn a coder in an isolated worktree
openfleet spawn fix-auth \
  --harness opencode \
  --model gpt-5.4 \
  --dir ~/src/my-repo \
  --worktree

# 4. Send work to the agent
openfleet send fix-auth "Fix the failing auth test in src/auth.js"

# 5. Inspect fleet state
openfleet lifecycle status
openfleet task list
```

Detailed setup: [docs/getting-started.md](docs/getting-started.md)

From source, replace `openfleet ...` with `node bin/openfleet ...`.

## Features

- Harness-agnostic orchestrator: Claude Code, OpenCode, OpenClaw, and Codex in one fleet.
- Any agent, any harness, any model: route coders, evaluators, and persistent agents to the cheapest capable runtime.
- Fleet lifecycle management: `spawn`, `send`, `kill`, `attach`, `respawn`, and `lifecycle status`.
- Git worktree isolation for coder agents: safe parallel branches with `openfleet spawn --worktree`.
- Native `SKILL.md` skills with cross-harness projection. See [docs/skills.md](docs/skills.md).
- OpenClaw adapter: bearer-token HTTP messaging and health checks.
- SSH remote spawn: sync a workspace, bootstrap dependencies, and launch agents on another machine.
- Web dashboard with bearer-token auth, live panes, task/event views, spawn/send controls, and token handoff via `openfleet auth qr`.
- Discord gateway: inbound routing, channel/thread mapping, status boards, and permission escalation.
- Cron scheduler: configurable overnight loops like briefings, news scans, compaction prompts, and dream-cycle jobs.
- Permission auto-resolver: harness-aware prompt detection, safe auto-approve, orchestrator-first human escalation for risky requests.
- Flat task system: `task create|list|update|show` backed by `tasks.json`.
- Evaluator pipeline: treat PR review as a bounded evaluator job and dispatch it adversarially through the same fleet runtime.

## Supported Harnesses

| Harness | Spawn / Transport | Native Instructions | Native Skills | Notes |
| --- | --- | --- | --- | --- |
| `claude-code` | tmux + `claude --dangerously-skip-permissions` | `CLAUDE.md` | `.claude/skills/` | Good fit for orchestrators and high-reasoning agents |
| `opencode` | local HTTP/TUI API + `opencode serve` | `.opencode/agents/<agent>.md` | `.opencode/skills/` | Best current programmatic worker surface |
| `openclaw` | headless HTTP gateway | `.openfleet/instructions/openclaw/<agent>.md` | `skills/` | Native bearer-token message API |
| `codex` | tmux + `codex --full-auto` | `AGENTS.md` | `.agents/skills/` | Good unattended GPT-native coder path |

Add another harness by wiring spawn, message transport, instruction projection, and tests. Guide: [docs/harness-adapters.md](docs/harness-adapters.md)

## Skills

OpenFleet uses a simple repo-native `SKILL.md` format and projects skills into each harness's discovery path.

```md
---
name: health-check
description: Verify service health before and after changes.
---

# Health Check

1. Identify the health signal.
2. Check it before the change.
3. Re-run it after the change.
4. Report the exact failing signal if anything regresses.
```

- Store shared skills in `skills/<name>/SKILL.md`
- Attach them to agents through `agents.json`
- OpenFleet copies them into the right harness-native location at spawn time

More: [docs/skills.md](docs/skills.md)

## Architecture

```text
                        Discord / Web / Terminal
                                 |
                                 v
                        +-------------------+
                        |   Orchestrator    |
                        | any harness/model |
                        +---------+---------+
                                  |
              +-------------------+-------------------+
              |                   |                   |
              v                   v                   v
      +---------------+   +---------------+   +---------------+
      | Fleet State   |   | Infra Windows |   | Remote Hosts  |
      | ~/.openfleet  |   | gateway       |   | SSH + rsync   |
      | agents/tasks  |   | bridge        |   | tmux workers  |
      | jobs/events   |   | cron          |   +-------+-------+
      +-------+-------+   | dashboard     |           |
              |           | capture       |           |
              |           +-------+-------+           |
              |                   |                   |
              +-------------------+-------------------+
                                  |
                                  v
                     +-----------------------------+
                     | Spawned Agents              |
                     | coder / evaluator / monitor |
                     | claude-code / opencode      |
                     | openclaw / codex            |
                     +-----------------------------+
```

## Configuration

OpenFleet keeps state flat in `~/.openfleet/`.

### `agents.json`

Canonical agent identities, roles, harnesses, channels, and attached skills.

```json
{
  "agents": {
    "coder": {
      "name": "coder",
      "role": "persistent",
      "harness": "opencode",
      "model": "gpt-5.4",
      "directory": "~/src/my-repo",
      "skills": ["health-check"]
    }
  }
}
```

### `cron.json`

Scheduled prompts for heartbeat loops or overnight automation.

```json
{
  "jobs": [
    {
      "id": "overnight-briefing",
      "schedule": { "hour": 6, "minute": 30 },
      "target": "parent",
      "prompt": "Morning briefing. Summarize fleet health, blocked tasks, and overnight activity."
    }
  ]
}
```

### `remote.json`

Remote provider config plus dashboard auth token. This file is also where bearer-token dashboard auth is stored.

```json
{
  "provider": "discord",
  "auth": {
    "token": "<dashboard-bearer-token>"
  },
  "capture": {
    "enabled": true,
    "default_interval_seconds": 30
  },
  "event_routing": {
    "agent.post": { "post": true, "channel": "auto" },
    "agent.blocked": { "post": true, "channel": "alerts" }
  }
}
```

### `deployment.json`

Fleet routing, channel layout, jobs, and parent session metadata.

```json
{
  "name": "my-fleet",
  "workspaceRoot": "~/src",
  "parent": {
    "agent": "orchestrator",
    "sessionScript": "~/.openfleet/bin/orchestrator_session"
  },
  "routing": {
    "assistant_channel": "channel://orchestrator",
    "default_human_channel": "channel://orchestrator",
    "direct_message_policy": "agent-channel-preferred",
    "persistent_agent_channels": {
      "orchestrator": "channel://orchestrator",
      "coder": "channel://code-status",
      "evaluator": "channel://evals"
    }
  },
  "jobs": {
    "morning": {
      "prompt": ["Morning briefing. Check fleet health and post summary to #daily."]
    }
  }
}
```

Other state files you will see in practice: `registry.json`, `jobs.json`, `events.jsonl`, `profiles.json`, `orchestrator.json`, `hosts.json`, and `discord.json`.

## CLI Reference

Current `openfleet help` output:

```text
openfleet — harness-agnostic agent orchestration

USAGE
  openfleet <command> [args...]

STATE
  status              Fleet dashboard overview
  agents              List all agents and health
  dashboard           Full dashboard
  summary             Compact summary
  presence            Agent presence/activity
  watch [args]        Interactive operations dashboard
  poll [args]         Poll Discord messages

WEB
  web-dashboard [--port N]  Web dashboard (default: 3000)

TASKS
  task <subcommand>   Task lifecycle (create, list, update, etc.)
  execute [args]      Execute a job
  spawn [args]        Spawn agents in any harness
  kill <name>         Kill tmux window openfleet:<name>

JOBS
  report-completion <job-id>  Report job completion
  complete <job-id>           Alias for report-completion

COMMUNICATION
  send <agent> <msg>          Message an agent
  message <agent> <msg>       Alias for send
  post <message>              Post to your remote channel (provider-agnostic)
  remote [args]               Remote operations
  discord <subcommand>        Discord operations (post, summary, etc.)
  auth <subcommand>           Dashboard auth token management

PROFILES
  profile <subcmd>    Runtime profile management
  profiles            List all runtime profiles
  host <subcmd>       Remote host management

OPERATIONS
  bridge [args]       Start remote event bridge
  capture [args]      Start passive agent capture daemon
  maintenance [args]  Run maintenance loop
  reconcile [args]    Reconcile fleet state
  orchestrator [args] Orchestrator controls
  events [args]       Tail event log
  mcp [args]          Start MCP server

SETUP
  init                Interactive setup wizard
  start               Cold-boot the fleet (tmux + infra + agents)

HELP
  help                Show this help
```

Useful commands:

```bash
# Spawn locally
openfleet spawn coder --harness codex --model gpt-5.4 --dir ~/src/my-repo --worktree

# Spawn on another machine
openfleet host add thinkpad --ip 100.100.96.7 --user twaldin --ssh-key ~/.ssh/id_ed25519
openfleet host setup thinkpad --harness opencode
openfleet spawn remote-coder --harness opencode --model gpt-5.4 --dir ~/src/my-repo --host thinkpad

# Tasks
openfleet task create --title "Review auth PR" --assignee evaluator
openfleet task update task_123 --status blocked --blocked-on "Need failing test case"
openfleet task list

# Dashboard auth
openfleet auth show-token
openfleet auth rotate
openfleet auth qr
```

## Contributing

```bash
git clone https://github.com/twaldin/openfleet.git
cd openfleet
npm install
npm test
```

- Keep changes small and operational.
- Add tests when you add behavior.
- If you add a harness or remote surface, update the docs in `docs/`.

## License

MIT
