---
name: api-client
description: Make HTTP requests carefully, inspect responses, and interact with APIs safely.
---

# API Client

Use this skill when calling REST, GraphQL, webhook, or internal HTTP APIs.

1. Confirm the base URL, method, authentication scheme, and expected content type first.
2. Start with a read-only request when exploring an unfamiliar API.
3. Build requests explicitly so headers, query params, and body shape are visible.
4. Keep auth tokens out of logs, screenshots, and committed files.
5. Capture response status, headers, and body because each can reveal different failure modes.
6. Parse JSON responses instead of scanning raw text when structure matters.
7. Check pagination, rate limiting, and retry guidance before assuming a single request is enough.
8. Treat non-2xx responses as data, not noise; the error payload usually explains the real problem.
9. Confirm idempotency before retrying writes.

Good workflow:

- Reproduce with a minimal `curl` or equivalent request.
- Verify auth and headers.
- Inspect the raw response.
- Narrow the bug to request shape, permissions, transport, or server behavior.

For mutating endpoints:

- Double-check the target environment.
- Use the smallest safe payload.
- Confirm whether the action is reversible.

When reporting results, include the endpoint, method, status code, key fields returned, and any relevant limits or errors.
