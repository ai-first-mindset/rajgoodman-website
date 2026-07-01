# Tests

Unit tests for the serverless logic, using the **Node built-in test runner**
(`node:test`) — no framework, no `package.json`, no dependencies, to keep this
repo zero-config.

Run locally (Node 20+):

```bash
node --test 'tests/**/*.test.js'
```

CI runs the same command on every push to `main` and every pull request
(`.github/workflows/test.yml`).

## Coverage

- `fetch-meta.test.js` — og:title extraction/cleaning used by the LinkedIn
  manager's "Fetch title" (strips the `| Author | N comments` suffix, decodes
  entities, null-safe).
- `linkedin-api.test.js` — the public `/api/linkedin` contract that feeds the
  homepage "On LinkedIn" widget (visible-only + ordered + capped at 4, 405 on
  non-GET, fail-soft to `[]` on DB error / network throw).
