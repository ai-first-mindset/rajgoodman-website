# Pages CMS / page builder — status and why this is not merged

**Branch:** `pages-cms` (pushed, preview-deployed, **not merged**)
**Site:** rajgoodman.com
**Paused:** 2026-07-28, to be resumed when there is time for proper QA.

Read this before picking the work back up. The short version: the engine is
sound and well tested, but the last mile — writing to the production database —
was never exercised, and the retrofit of existing pages does not generalise
nearly as well as first assumed.

---

## What was built

A custom, schema-driven page builder replacing the previous Puck-based editor.
Zero dependencies, plain ESM, no build step: the same modules are imported by
the serverless page renderer and by the admin editor, so "one renderer for
canvas and production" is literal rather than a convention.

- `builder/core/` — the engine: registry, node model, child-policy table, the
  render fold, versioned documents + migrations, command layer with undo/redo,
  validation, style tokens, content bindings.
- `builder/elements/` — the site's elements, one `ElementDefinition` each.
- `builder/editor/` — the admin UI: canvas, layer tree, schema-generated
  inspector, inserter, Code view, drag-and-drop.
- `builder/decompose.js` — turns legacy `raw-html` blobs into typed nodes.
- `builder/sanitize.js` — allowlist HTML sanitiser (replaced a regex denylist).
- `builder/conformance.js` — site-agnostic checks shared with the AIFM repo.

Puck, React and esbuild were removed along with a 1.1 MB committed bundle.

**Tests: 408/408** (`media-migration` excluded — it needs network).

---

## Why it is NOT merged

### 1. The production save path was never exercised — this is the blocker

Everything proven so far is about **rendering**. Nothing has ever been
**written** to Supabase in the new format. The stored `pages.blocks` shape
changes from a flat array to `{ version: 2, root }`.

**It is a one-way door.** Once a page is saved as v2, code without this branch
cannot read it. A rollback after any save would also require restoring the v1
renderer.

*To close it:* deploy the branch as a preview, open `/about/` in the admin, hit
Save, and confirm the public route still renders.

### 2. CI has never run on this branch

`.github/workflows` triggers on `pull_request` and pushes to `main`. This branch
was only ever pushed directly. **Open a PR to get the suite run in CI.**

### 3. The retrofit of existing pages does not generalise

The original hope was that typing `/about/`'s sections would carry over to the
other pages. It does not. Measured across all 16 static pages: **only `/about/`
decomposes byte-exactly.**

Two causes:

- **Hero variants.** `page-hero` hard-codes `/about/`'s shape (crumbs →
  `phero-grid` → text column + image column). Simpler pages (privacy-policy,
  events) have no grid and no image and diverge before any section is reached.
- **Line endings** — see below.

This is not dangerous: `verifyDecomposition()` refuses on any page it cannot
reproduce, so "Convert sections" declines rather than altering anything. But it
means the feature currently only works on one page.

### 4. CRLF: the committed fixture does not match production

`tests/fixtures/about-page-blocks.json` is LF-normalised. The **real stored
record in Supabase is CRLF** — 275 line endings different.

Consequences:

- The "byte-identical" results for `/about/` were measured against the fixture,
  not the real record.
- **"Convert sections" would be refused on the real page too**, because the
  decomposed output uses LF where the stored content uses CRLF.

*Open decision:* normalising the stored content to LF would fix this and cost
275 invisible bytes of published output (whitespace between tags; renders
identically). That changes published bytes, so it needs a human call.

### 5. Behaviour change: editors can no longer save pages

`api/admin/pages.js` now gates writes on `requireAdmin` instead of
`requireUser`, because page content becomes markup on public pages. `GET` still
allows any signed-in user so the page list works.

This is intentional and is a real security improvement, but it affects the 5
invited editors, and the admin UI shows a generic save failure rather than
"you need admin".

### 6. GTM custom tags could not be audited

The CSP has no `unsafe-inline` for scripts. GTM loads and pulls GA4 correctly
(verified in Chrome with real headers). But without GTM container access, the
tag *types* could not be audited — **any Custom HTML tag would be blocked.**
Impact is lost analytics, not a broken site, but it would be silent.

---

## What IS solid, and is arguably worth landing on its own

The security work is independent of the page builder and could be cherry-picked:

- **Allowlist sanitiser** replacing a regex denylist that missed
  `<iframe srcdoc>`, `<form action="javascript:">`, `<meta http-equiv=refresh>`
  and `<base href>`. Lossless by construction — verified byte-for-byte against
  the real `/about/` markup and all 22 real blog post bodies.
- **CSP** on every route, no `unsafe-inline` for scripts. Verified in Chrome
  with headers actually applied; injected inline and third-party scripts are
  blocked while GTM/GA4/Turnstile/Supabase/fonts all work.
- **URL scheme guard** — `javascript:` in a button URL produced a live link
  (pre-existing; confirmed against the old renderer too).
- **Binding XSS fix** — bindings bypassed write-time sanitisation entirely and
  could inject markup via an author-chosen `fallback`.
- **Admin-only page writes** (item 5 above).
- **`privacy-policy.html` inline handler** — the only inline `onclick` on the
  site, which the new CSP would have silently broken. Fixed properly by binding
  in `cookie-consent.js`.

---

## Known limitations, recorded as tests

Each of these is asserted, so they cannot be quietly forgotten:

| Limitation | Test |
|---|---|
| Only 1 of 16 pages decomposes exactly | `tests/builder-generalisation.test.js` |
| Decomposition is exact or refused — never silent | same |
| Section 05's marquee sits outside the main wrap | `tests/builder-sections.test.js` |
| The contact form and LinkedIn grid stay raw HTML by design | same |
| `/about/` renders byte-identically to the v1 renderer | `tests/builder-parity.test.js` |
| Every resource load is CSP-covered | `tests/conformance.test.js` |

---

## Where `/about/` actually got to

3 stored blocks → 106 nodes, **77% of content form-editable** (was 17%).
Editable as fields: the hero headline and CTAs, all five journey rows, the five
shorts, eleven testimonial quotes, three feature cards, three stat counters and
five FAQ items.

Still raw HTML by choice: the Turnstile contact form and the LinkedIn grid —
functional widgets managed elsewhere, where typing adds risk and no value.

---

## How to resume

1. Open a PR from `pages-cms` → CI runs.
2. On the preview: open `/about/` in the admin, **Save**, confirm the public
   route still renders. This is the real gate.
3. Decide the CRLF question (item 4).
4. Watch GA4 realtime for a few minutes to close item 6.
5. If all of that is clean, merge — then repeat for the AIFM repo, which has a
   matching `pages-cms` branch carrying the same engine, inert.

**Do not merge before step 2.** Everything else is recoverable; a bad first
save is not.

## The honest strategic note

Retrofitting hand-authored HTML into a page builder is the wrong direction. The
pages were not composed from components, so almost every page has markup
variants no other page shares — there is no economy of scale, and page 16 costs
roughly what page 2 did.

The builder earns its keep on **pages built in it from the start**. If this is
picked up again, consider using it for new pages and leaving the existing ones
as HTML (they are already editable via the Code view) rather than continuing the
retrofit.
