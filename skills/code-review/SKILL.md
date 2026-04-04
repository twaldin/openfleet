---
name: code-review
description: Review diffs for bugs, security issues, regressions, and missing tests.
---

# Code Review

Use this skill when reviewing a branch, pull request, commit range, or local diff.

1. Establish review scope first: target branch, commit range, staged diff, or specific files.
2. Read the changed code before commenting so findings are grounded in actual behavior.
3. Focus on correctness before style: broken flows, bad assumptions, missing validation, and silent failures.
4. Check security-sensitive paths closely: auth, permissions, secrets, shelling out, file access, and external input.
5. Look for regression risk at boundaries: API contracts, migrations, background jobs, retries, and caching.
6. Verify error handling matches the system's expectations instead of swallowing failures.
7. Check whether the change updates tests for the behavior it modifies.
8. Treat missing tests as a finding when the change could plausibly regress or break production behavior.
9. Prefer minimal, concrete fixes over broad refactors during review.

Report findings in severity order.

- Include `path:line` references whenever possible.
- State the impact clearly: what breaks, leaks, corrupts, or becomes hard to recover from.
- Explain the trigger condition so the author can reproduce the issue.
- Suggest the smallest safe fix if it is obvious.

Good review categories:

- Functional bug
- Security issue
- Data loss or corruption risk
- Race condition or ordering bug
- Performance regression on hot paths
- Missing or misleading test coverage

Avoid spending review energy on naming or formatting unless it hides a real bug.

If no findings are present, say that explicitly and call out any residual risk or test gaps.
