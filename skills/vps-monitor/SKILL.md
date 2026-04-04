---
name: vps-monitor
description: Check remote server health over SSH and surface actionable operational risks.
---

# VPS Monitor

Use this skill when inspecting a VPS, cloud VM, or remote Linux host over SSH.

1. Confirm host, user, authentication method, and whether elevated access is available.
2. Start with low-risk read-only checks before considering restarts or config changes.
3. Check uptime, load average, CPU saturation, memory pressure, disk usage, and inode exhaustion.
4. Review the status of critical services with `systemctl`, `docker ps`, or the host's process supervisor.
5. Verify the application's own health endpoint, not just whether the process exists.
6. Inspect recent logs for crash loops, OOM kills, certificate issues, and upstream dependency failures.
7. Check network reachability, bound ports, and firewall symptoms when services appear healthy but unavailable.
8. Confirm backup, cron, or scheduled jobs are still running if they are part of the host's role.
9. Compare findings to the last known good state if prior metrics or notes exist.

Useful commands usually include:

- `uptime`
- `df -h`
- `free -m`
- `systemctl --failed`
- `docker ps`
- `journalctl -u <service> --since "1 hour ago"`
- `curl -fsS http://127.0.0.1:<port>/health`

Summarize results as critical, warning, and informational items.

Do not reboot, restart services, or edit config unless the user asks for intervention instead of monitoring.
