# Getting Started

## Requirements

- Node.js 18+
- `tmux`
- `git`
- At least one harness binary on your `PATH`: `claude`, `opencode`, `openclaw`, or `codex`
- Optional for remote workflows: `ssh`, `rsync`
- Optional for Discord: a bot token and server ID

## Install

For local source development:

```bash
git clone https://github.com/twaldin/openfleet.git
cd openfleet
npm install
```

If you are running from source instead of a published package, replace `openfleet ...` with `node bin/openfleet ...` in the examples below.

For packaged usage:

```bash
npx openfleet init
```

## Initialize State

Run the setup wizard:

```bash
openfleet init
```

The wizard creates `~/.openfleet/` and writes the initial control-plane files:

- `deployment.json`
- `profiles.json`
- `orchestrator.json`
- `agents.json`
- `cron.json`
- `agents/<orchestrator>/SOUL.md`
- `agents/<orchestrator>/HEARTBEAT.md`

Review these files immediately after init:

- `~/.openfleet/deployment.json`: routing, channels, jobs
- `~/.openfleet/agents.json`: canonical agent definitions
- `~/.openfleet/cron.json`: scheduled prompts

Note: `remote.json` is created lazily when dashboard auth is first used or when remote config is saved.

## Start The Fleet

```bash
openfleet start
```

This cold-boots the tmux session and infrastructure windows:

- `gateway`
- `cron`
- `dashboard`
- `bridge`
- `capture`

Attach to the session with:

```bash
tmux attach -t openfleet
```

`openfleet start` prepares the orchestrator window, but it does not fully launch every harness automatically. For a fresh setup, attach to tmux and start your orchestrator in the `cairn` window.

## Spawn Your First Agent

Local spawn:

```bash
openfleet spawn fix-auth \
  --harness opencode \
  --model gpt-5.4 \
  --dir ~/src/my-repo \
  --worktree
```

Send work:

```bash
openfleet send fix-auth "Fix the failing auth test in src/auth.js"
```

Inspect lifecycle state:

```bash
openfleet lifecycle status
openfleet agents
openfleet status
```

Stop the agent:

```bash
openfleet kill fix-auth
```

## Worktree Isolation

Use `--worktree` for coder agents that should not touch the main checkout directly.

```bash
openfleet spawn review-auth \
  --harness codex \
  --model gpt-5.4 \
  --dir ~/src/my-repo \
  --worktree
```

OpenFleet creates a git worktree under the system temp directory and tracks it in the session registry.

## Dashboard

Start the web UI if it is not already running:

```bash
openfleet web-dashboard --port 3000
```

Get the bearer token:

```bash
openfleet auth show-token
```

Then open `http://localhost:3000` and paste the token into the login screen.

Useful auth commands:

```bash
openfleet auth show-token
openfleet auth rotate
openfleet auth qr
```

Current dashboard API auth is bearer-token based. The `qr` command is the current mobile/hand-off auth helper surface.

## Tasks And Jobs

Flat tasks live in `tasks.json`.

```bash
openfleet task create --title "Review auth PR" --assignee evaluator
openfleet task list
openfleet task show task_123
openfleet task update task_123 --status blocked --blocked-on "Need failing reproduction"
```

Jobs are the bounded execution layer underneath the fleet runtime:

```bash
node internal/job create --type review.pr --agent evaluator --input '{"repo":"~/src/my-repo","pr":123}'
openfleet execute job_123
```

## Skills

Shared skills live in `skills/<name>/SKILL.md` and are projected into each harness at spawn time.

See [skills.md](skills.md).

## SSH Remote Spawn

Register a host:

```bash
openfleet host add thinkpad --ip 100.100.96.7 --user twaldin --ssh-key ~/.ssh/id_ed25519
```

Check or bootstrap dependencies:

```bash
openfleet host check thinkpad --harness opencode
openfleet host setup thinkpad --harness opencode
```

Spawn remotely:

```bash
openfleet spawn remote-coder \
  --harness opencode \
  --model gpt-5.4 \
  --dir ~/src/my-repo \
  --host thinkpad
```

OpenFleet will:

- check remote dependencies
- create a remote workspace
- `rsync` the local directory
- launch the harness in remote tmux
- record the remote host in the session registry

## Discord Integration

Inbound Discord routing still uses `~/.openfleet/discord.json`.

Minimal shape:

```json
{
  "token": "<bot-token>",
  "guild_id": "<discord-guild-id>",
  "channels": {
    "orchestrator": "123456789012345678",
    "alerts": "123456789012345679",
    "code-status": "123456789012345680"
  }
}
```

Start the gateway:

```bash
openfleet gateway
```

This enables:

- channel-to-agent routing
- thread creation for ephemeral workers
- status and archive messages
- permission escalation with emoji approvals for risky prompts

## Suggested First Session

```bash
openfleet init
openfleet start
tmux attach -t openfleet
openfleet spawn coder --harness opencode --model gpt-5.4 --dir ~/src/my-repo --worktree
openfleet send coder "Read the repo and fix the failing tests"
openfleet lifecycle status
openfleet auth show-token
```

## Troubleshooting

- If `spawn` fails immediately, confirm the harness binary exists on `PATH`.
- If dashboard API calls return `401`, rotate and re-enter the token with `openfleet auth rotate`.
- If a remote spawn fails, run `openfleet host check <name> --harness <harness>` first.
- If a persistent agent disappears, use `openfleet respawn` or `openfleet lifecycle status`.
