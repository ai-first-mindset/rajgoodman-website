# Tests

Unit tests for the serverless logic, using the **Node built-in test runner**
(`node:test`) — no framework, no `package.json`, no dependencies, to keep this
repo zero-config.

Run locally (Node 20+):

```bash
node --test 'tests/**/*.test.js'
```

CI runs the same command on every push to `main` and every pull request
(`.github/workflows/test.yml`). After the suite passes on `main`, CI also
regenerates the admin **Coverage** tab snapshot (`scripts/update-coverage.mjs`
rewrites the marked block in `admin/index.html`) and commits it back with
`[skip ci]`. Run `node scripts/update-coverage.mjs` locally for an instant
refresh.

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
- `media-migration.test.js` — WordPress→Supabase media parity: no reference
  to the doomed WP hosts anywhere (repo pages/templates AND every post in the
  DB, drafts included), every referenced /assets/ file exists, and every
  Supabase media URL (repo-hardcoded, post bodies/featured/og, LinkedIn
  cards, ebook registry) resolves live. Network checks skip with
  SKIP_NET_TESTS=1; DB checks self-skip without .env secrets (e.g. CI).
- `post-template.test.js` — author-bio block on published posts and the
  Person.description JSON-LD mirror.
- `admin-editor.test.js` — the admin editor's category checkbox picker and
  inline image alt-text bar, extracted from admin/index.html's inline script
  and run against a stub DOM/editor in a vm sandbox.
- `subscribe-api.test.js` — newsletter endpoint contract: Turnstile-first,
  EO list add (list setting decides double opt-in; PENDING surfaces to the
  form), member-exists-is-success, 502s, loud-config stored:false.
- `contact-api.test.js` — contact endpoint contract: DealDesk forward with
  x-api-key, service folded into the message, half-configured guard, 502s.
- `turnstile.test.js` — the shared verifier fails CLOSED on missing
  secret/token and unreachable siteverify; clientIp precedence.
- `admin-posts-api.test.js` — admin auth guards (401 gate, cookie refresh,
  role guard) and the posts CRUD contract against a stubbed Supabase:
  field allow-listing, HTML sanitisation, publish/slug-history bookkeeping.
- `admin-auth-api.test.js` — login (password grant -> httpOnly cookies,
  Secure off-localhost), session whoami/logout, and the invite
  set-password flow (min length, GoTrue rejection, optional auto-login).
- `admin-users-api.test.js` — admin-only user management: 401/403 gates,
  invite with authoritative app_metadata role (unknown roles coerced to
  editor), self-delete protection.
- `admin-media-api.test.js` — media library (recursive listing + metadata
  overlay, in-use delete refusal, admin-only replace with reference
  repointing), signed uploads (SVG refused, filename slugging), LinkedIn
  admin CRUD with orphan-image cleanup, and the shared bucketPath /
  isReferenced helpers.
- `render-handlers.test.js` — SSR handlers (post/index/category): status
  codes, cache headers, prev-slug 301s, admin draft preview (noindex +
  no-store), honest empty/error states that must never be edge-cached.
- `parity-surfaces.test.js` — cutover parity surfaces: favicon files exist
  and every page/template links them; vercel.json keeps the WP-era URL
  surface alive (hotlinked /wp-content/uploads → Supabase, /blog/page/N and
  author-sitemap redirects, /feed/ + /blog/feed/ rewrites); page sitemap
  includes privacy-policy; the RSS generator escapes and structures items
  correctly; homepage JSON-LD carries Organization + ContactPoint.
