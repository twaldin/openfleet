# Gaming PC bootstrap profile

Role: heavy worker.

## Host expectations

- stable power and network
- good for long-running or parallel jobs
- can be treated as the first durable worker host after the MacBook control plane

## Required setup

- Git installed
- OpenCode installed and on `PATH`
- access to the `openfleet` repo
- writable `~/.openfleet`
- auth ready for the shared OpenCode server

## Suggested sync target

- workspace root: `~/openfleet`
- state dir: `~/.openfleet`

## Live checks

- repo pulls cleanly
- `opencode` runs
- worker session metadata can be written to `~/.openfleet`
- host stays online through a long job
