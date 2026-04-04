---
name: test-runner
description: Run focused test suites, diagnose failures, and verify fixes.
---

# Test Runner

Use this skill when validating a change or investigating a failing test suite.

1. Identify the project's test entry points from `package.json`, Makefiles, CI config, or language conventions.
2. Prefer the smallest relevant test command first instead of jumping straight to the full suite.
3. Record the exact command used so results can be reproduced.
4. Capture failing test names, stack traces, and the first meaningful error line.
5. Separate product failures from environment failures such as missing services, ports, or credentials.
6. Check whether the failure is deterministic before labeling it flaky.
7. If a test fails after a code change, inspect whether the behavior or the expectation is wrong.
8. Fix root causes before updating snapshots, fixtures, or golden outputs.
9. Re-run the focused test after each fix.
10. Re-run the broader suite before declaring the change safe.

Useful diagnosis buckets:

- Assertion mismatch
- Setup or teardown leak
- Timing or race condition
- Mock drift from production behavior
- API contract change
- Environment or dependency failure

When reporting results:

- Include the command.
- Include pass/fail status.
- Call out flaky or skipped tests explicitly.
- Note any tests you could not run and why.

If the suite is too slow, narrow by file, test name, package, or affected subsystem first.
