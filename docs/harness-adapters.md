# Harness Adapters

## Goal

A harness adapter lets OpenFleet spawn agents, route messages, and project instructions for a new AI CLI surface without changing the fleet model.

OpenFleet already ships adapters for:

- `claude-code`
- `opencode`
- `openclaw`
- `codex`

## What An Adapter Must Provide

At minimum, a new harness needs four things:

1. A launch strategy
2. A message transport
3. An instruction projection target
4. Test coverage

In practice that usually touches the files below.

## Core Files

| Responsibility | File |
| --- | --- |
| Harness execution logic | `core/harness/<name>.js` |
| Local and SSH spawn wiring | `core/remote/ssh.js` |
| Job dispatch | `core/execute.js` |
| Direct message routing | `bin/send` |
| Spawn CLI surface | `bin/spawn` |
| Instruction projection | `core/instructions.js` |
| Native skill paths | `core/skills.js` |
| Tests | `test/*` |

## Existing Patterns

### `claude-code`

- Spawned in tmux with `claude --dangerously-skip-permissions --model <model>`
- Routed through tmux keystrokes
- Instructions projected into `CLAUDE.md`
- Skills projected into `.claude/skills/`

### `opencode`

- Spawned with `opencode serve --port <port>` followed by `opencode attach`
- Routed through the local HTTP/TUI API
- Instructions projected into `.opencode/agents/<agent>.md`
- Skills projected into `.opencode/skills/`

### `openclaw`

- Spawned headless with a deterministic port
- Routed through HTTP with bearer-token auth
- Health checked via `/api/health`
- Skills projected into `skills/`

### `codex`

- Spawned in tmux with `codex -m <model> -C <dir> --full-auto`
- Routed through tmux keystrokes
- Trust prompts handled by harness-aware permission logic
- Instructions projected into `AGENTS.md`

## Add A New Harness

### 1. Create The Harness Module

Add `core/harness/<name>.js`.

Typical responsibilities:

- `execute<Name>Job(...)` for bounded job dispatch
- helper functions for launch, health, or message transport

Minimal sketch:

```js
function executeMyHarnessJob({ job, profile, prompt }) {
  return {
    ok: true,
    harness: "my-harness",
    host: profile.host || "local",
    agent: job.agent,
  }
}

module.exports = {
  executeMyHarnessJob,
}
```

### 2. Wire Launching In `core/remote/ssh.js`

Update:

- `HARNESS_DEPENDENCIES`
- `buildHarnessLaunchCommand(...)`

If the harness supports remote spawn, make sure the returned launch command works over SSH and tmux.

## 3. Wire Job Dispatch In `core/execute.js`

Add a branch for the new harness in `executeJob(...)`.

That keeps bounded job execution consistent with the rest of the fleet.

## 4. Wire Direct Messaging In `bin/send`

If the harness has a native API, route through it. If not, fall back to tmux.

The adapter decision should answer:

- how do we send a prompt while the agent is running?
- how do we identify the target session?
- how do we report transport details back to the caller?

## 5. Add Instruction Projection

Update `core/instructions.js`.

If the harness has a well-known instruction file, add it in `projectBaseInstructions(...)`. Otherwise let it fall back to:

```text
.openfleet/instructions/<harness>/<agent>.md
```

## 6. Add Native Skill Projection If Supported

Update `core/skills.js`.

If the harness has a native skill discovery path, add it to `NATIVE_SKILL_PATHS`.

If not, do nothing. OpenFleet will still append an available-skills index to the projected instructions.

## 7. Update Spawn Help And Docs

Make sure `bin/spawn` usage text includes the harness name.

Then update:

- `README.md`
- `docs/harness-adapters.md`
- `docs/skills.md` if native skills are supported

## 8. Add Tests

At minimum, cover:

- launch command generation
- message routing
- health checks if applicable
- skill projection path if native skills are supported

Examples in the current suite:

- `test/openclaw-harness.test.js`
- `test/ssh-spawn.test.js`
- `test/skills.test.js`

## Checklist

- Adapter module exists in `core/harness/`
- Spawn path works locally
- Spawn path works over SSH if supported
- `bin/send` can reach the harness
- `core/execute.js` dispatches jobs correctly
- Instructions land in the right file
- Skills land in the right directory or are indexed in fallback instructions
- Tests cover the new behavior

## Design Advice

- Prefer the smallest transport that works.
- If the harness already exposes HTTP, use it.
- If it is terminal-only, tmux is acceptable.
- Keep skill handling harness-native when possible.
- Keep adapter-specific logic isolated instead of leaking conditionals everywhere.
