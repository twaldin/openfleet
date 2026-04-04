---
name: fleet-status
description: Inspect OpenFleet agent health, tasks, jobs, and live session activity.
---

# Fleet Status

Use this skill when checking whether the OpenFleet control plane and agents are healthy.

1. Start with the top-level dashboard: `node bin/openfleet status`.
2. Check lifecycle health for session-level problems: `node bin/openfleet lifecycle status`.
3. Use `node bin/ops summary` for a concise fleet snapshot.
4. Use `node bin/ops agents` to list registered agents and metadata.
5. Inspect task backlog with `node bin/ops tasks --json`.
6. Inspect job state with `node bin/ops jobs --json` when work appears stuck.
7. Drill into one agent with `node bin/ops inspect <agent>`.
8. For live message flow, use `node bin/ops tail <agent>` or `node bin/ops follow <agent>`.
9. If messaging seems broken, verify sends with `node bin/send <agent> "<message>"` and confirm the event lands.

Useful state locations from this repo:

- `~/.openfleet/agents.json`
- `~/.openfleet/registry.json`
- `~/.openfleet/tasks.json`
- `~/.openfleet/jobs.json`
- `~/.openfleet/events.jsonl`

Good diagnosis flow:

- Confirm the fleet is up.
- Identify which agent or task is unhealthy.
- Check recent session output.
- Check queued tasks and jobs.
- Check the event log if state and UI disagree.

Report which agents are healthy, which are stale or broken, and the next operator action needed.
