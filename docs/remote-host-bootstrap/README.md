# Remote host bootstrap

Bootstrap docs and copy-paste templates for OpenFleet worker hosts.

Scope:

- gaming PC: heavy worker
- ThinkPad 1: persistent worker
- ThinkPad 2: recovery / spare worker

This is the first reusable bootstrap layer for v1. It is written to be concrete for Tim's machines, but the commands stay parameterized so the same flow can be reused for other hosts later.

## What this layer covers

- host prerequisites
- repo/workspace sync
- local state-dir setup
- verification commands

It does not assume the host is reachable right now.

## Required inputs

- `HOST_ALIAS` — `gaming-pc`, `thinkpad-1`, or `thinkpad-2`
- `REMOTE_USER` — login user on the host
- `REMOTE_HOST` — hostname or IP when reachable
- `WORKSPACE_ROOT` — usually `~/openfleet`
- `STATE_DIR` — usually `~/.openfleet`

## Bootstrap order

1. Install prerequisites.
2. Sync the `openfleet` repo and any host-specific workspace.
3. Create the OpenFleet state dir layout.
4. Verify `git`, `node`, and `opencode` are available.
5. Verify the repo and state paths exist.
6. Verify the host can talk to the shared OpenCode server when live.

## Host roles

| Host | Role | Notes |
|---|---|---|
| Gaming PC | Heavy worker | Best for long-running jobs and compute-heavy work. |
| ThinkPad 1 | Persistent worker | Best for routine queue work and always-on validation. |
| ThinkPad 2 | Recovery worker | Duplicate bootstrap target for failover testing. |

## Files in this folder

- `hosts/gaming-pc.md`
- `hosts/thinkpad-1.md`
- `hosts/thinkpad-2.md`
- `templates/prereqs.sh`
- `templates/sync-repo.sh`
- `templates/setup-state-dir.sh`
- `templates/verify-bootstrap.sh`

## Verification target

A host is considered bootstrap-ready when these all work:

- `git --version`
- `node --version`
- `opencode --version`
- repo sync into `~/openfleet`
- state dir exists at `~/.openfleet`
- shared-server URL is known and reachable when the host is live
