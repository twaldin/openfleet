---
name: docker-manager
description: Build, run, inspect, and clean up Docker images and containers safely.
---

# Docker Manager

Use this skill when working with Dockerfiles, images, containers, or Compose stacks.

1. Read the Dockerfile or compose file before running commands so ports, volumes, and env are known.
2. Confirm which image tag and target platform you intend to build.
3. Build with explicit tags so later logs and rollbacks are understandable.
4. Check container logs and exit codes before assuming the image build is the problem.
5. Inspect published ports, bind mounts, and health checks when a service looks alive but is unreachable.
6. Verify environment variables and secrets injection paths without printing secret values back out.
7. Use `docker ps`, `docker inspect`, and `docker logs` to narrow failures before rebuilding repeatedly.
8. For Compose stacks, reason about service dependencies and startup ordering.
9. Remove only the containers, images, or volumes tied to the task.

Safety rules:

- Do not use broad prune commands unless the user explicitly wants cleanup.
- Do not delete named volumes casually; they may contain real state.
- Confirm whether a restart is acceptable before bouncing a running service.

Useful checkpoints:

- Build succeeded
- Container stays running
- Health check passes
- Expected ports respond
- Logs show normal startup

Report the exact build or run commands used and any container names or image tags created.
