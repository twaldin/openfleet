# ThinkPad 1 bootstrap profile

Role: persistent worker.

## Host expectations

- lightweight and always available
- good for routine queue work
- good candidate for verifying unattended restart and recovery

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

- repo sync works after reconnect
- session metadata persists after restart
- worker session can be resumed by name
