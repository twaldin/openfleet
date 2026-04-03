# OpenFleet Ops TUI Spec

Status: implementation task spec

## Purpose

The current `ops` commands are machine-readable and useful for debugging, but they are not a good primary human-facing dashboard.

The Ops TUI should become the first real human operator surface for OpenFleet.

## Positioning

- `ops` CLI = raw/machine-parseable/operator-debug interface
- `ops-ui` TUI = human-readable fleet dashboard

## Design goals

- glanceable status
- btop-like panel layout
- keyboard navigation
- easy drill-down into agents/tasks/workflows/blockers/approvals
- Enter on an agent should open its real session/follow surface

## Data to show

### Top status bar
- deployment name
- active orchestrator profile/harness
- bridge health
- ThinkPad health
- last refresh
- maintenance-loop state

### Agents panel
- logical agent id
- runtime state: alive-working / alive-idle / blocked / stalled / dead
- host
- harness
- model/profile
- active job
- session id / instance id

### Tasks panel
- active tasks
- blocked tasks
- recently completed tasks

### Workflows / Jobs panel
- active workflows
- current step
- runnable jobs
- in-progress jobs

### Blockers / Approvals panel
- open blockers
- pending approvals
- thread/channel binding
- who/what is blocking

### Detail / Tail panel
- selected item details
- transcript tail for selected agent
- last event summary

## Interaction model

- arrows / j,k = move selection
- tab = next panel
- enter = open the selected agent session or detailed view
- t = focus tasks
- w = focus workflows
- b = focus blockers
- a = focus approvals
- f = follow selected agent
- c = capture selected agent
- r = manual refresh
- / = filter/search

## Session-opening behavior

When pressing Enter on an agent:

- if local and directly attachable, jump to its session/follow surface
- if remote, open the best available follow/attach experience rather than failing silently

## Scope for v1

The first version does not need full interactivity everywhere.

It should at minimum:
- render a stable multi-panel dashboard
- refresh cleanly
- support selecting agents/tasks/workflows
- support Enter-to-open on agents

## Out of scope for first cut

- perfect graphical polish
- mouse support
- embedded editing of tasks/workflows
- full remote chat control from inside the TUI
