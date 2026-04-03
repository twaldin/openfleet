# OpenFleet v1 release scope

## What v1 must ship

v1 is the smallest release that proves OpenFleet can run the Cairn control plane without depending on the current tmux/Claude bridge as the primary abstraction.

Must ship:

- one project-scoped OpenFleet deployment for `~/cairn`
- one shared local OpenCode server with durable state/log paths
- one persistent parent session (`cairn`) that can be resumed programmatically
- one managed worker session with stored metadata outside the TUI
- session-native messaging between parent and worker sessions
- compatibility for the current Discord reply path during migration
- a documented bootstrap path for remote worker hosts
- validation that the live system still works before cutover

## Explicit non-goals

v1 does **not** need to ship:

- a generalized multi-tenant fleet platform
- automatic host discovery or auto-scaling
- full replacement of `claudecord` on day one
- removal of tmux from all workflows
- perfect cross-platform parity on first release
- web UI, dashboarding, or analytics
- zero-touch provisioning
- job scheduling beyond the first small set of named worker roles

## Implementation order

Follow this order strictly:

1. **Spec**: lock the v1 contract, host roles, bootstrap flow, and cutover criteria.
2. **Implement**: wire the deployment config, session plumbing, worker metadata, and wrappers.
3. **Test live system**: validate against the real Cairn environment, Discord path, and remote hosts.

Do not expand scope before the current step is validated in the live system.

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

- one worker host boots from the documented steps
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

## Migration from current cairn/claudecord/tmux bridge

v1 should be a side-by-side migration, not a hard switch.

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

## Recommended host roles

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

## Required install/bootstrap steps

Each host must have:

- a working shell environment
- Git
- OpenCode installed and on PATH
- access to the `openfleet` repo and `~/cairn` workspace as needed
- authentication for the shared OpenCode server and any required model access
- a writable local state directory for sessions/logs
- the release bootstrap script or wrapper commands

Bootstrap sequence for each host:

1. install prerequisites
2. clone or sync the required repo/workspace
3. configure the OpenFleet deployment file for that host role
4. start or point at the shared OpenCode server
5. launch the named parent or worker session
6. verify message delivery and persistence
7. record the host as active in session metadata

Host-specific notes:

- **MacBook**: use it as the first known-good bootstrap target.
- **Gaming PC**: confirm wake/sleep behavior and persistence before assigning critical jobs.
- **ThinkPads**: verify unattended restart, SSH/session access, and stable network reachability.

## Release risks

- **Bridge drift**: OpenFleet and the old tmux/Claude path diverge before parity is proven.
- **Host heterogeneity**: MacBook, PC, and ThinkPads may behave differently on shell, path, or auth setup.
- **Session persistence bugs**: parent/worker state may not resume cleanly after restart.
- **Messaging loss**: session-native messaging may work locally but fail across real hosts.
- **Cutover regression**: replacing the current reply path too early could break live Discord operations.
- **Bootstrap fragility**: the install steps may be too manual or too host-specific for reliable reuse.
- **Over-scope**: trying to add scheduling, dashboards, or full fleet automation before the first worker path is stable.
