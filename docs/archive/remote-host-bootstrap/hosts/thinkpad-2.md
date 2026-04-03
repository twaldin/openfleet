# ThinkPad 2 bootstrap profile

Role: recovery worker.

## Host expectations

- duplicate bootstrap target
- used for failover testing
- should prove the fleet still works if ThinkPad 1 is offline

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

- clean setup from scratch
- session metadata survives restart
- can be brought up without relying on ThinkPad 1
