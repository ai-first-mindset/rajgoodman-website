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
- `linkedin-widget.test.js` — DOM render of the homepage widget (in-place
  update, cap at 4, append/remove, static fallback on empty/error/throw).
- `cookie-consent.test.js` — GDPR widget logic: Consent Mode v2 defaults and
  signal mapping, stored-choice validation (version/expiry/corruption).
- `read-body.test.js` — safe request-body reader (malformed-JSON crash guard)
  and email-shape validation shared by all form endpoints.
- `download-api.test.js` — the gated-download endpoint contract: server-side
  asset registry, Turnstile-first gating, EO lead capture with per-asset tag,
  fail-open delivery when lead capture fails, input validation, 405.
- `download-modal.test.js` — the gated-download user flow in the DOM: open
  per asset, verification gating (unticked + ad-blocked), exact submit
  payload, in-page unlock + auto-open, double-opt-in pending note, server and
  network error recovery, close/reopen behavior, multi-book pages.
