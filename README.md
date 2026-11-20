# rajgoodman.com

Raj Goodman Anand's site: static HTML plus Vercel serverless functions, backed by
Supabase. Light theme since the Nov 2026 redesign (palette shared with
aifirstmindset.ai/owner-ai; tokens at the top of `site.css`).

**🔗 Live:** https://rajgoodman.com — production since 16 Jul 2026.

## Run locally

Most of the site is static, so a plain static server is enough for design work:

```bash
npx serve .
```

Anything under `api/` (blog, contact form, newsletter, `/admin`) needs the Vercel
dev server **and** real environment variables:

```bash
vercel login && vercel link      # once per machine: pick the AI-First Mindset team
vercel env pull                  # writes .env — never commit it, it holds live keys
vercel dev
```

`.env` is gitignored on purpose, so a fresh clone has no secrets until you pull
them. Required keys: `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `TURNSTILE_SECRET_KEY`,
`DEALDESK_ENDPOINT` / `DEALDESK_API_KEY`, `EMAILOCTOPUS_API_KEY` / `_LIST_ID`,
`AIFM_SUBSCRIBE_URL` / `_KEY`.

## Tests

No dependencies — the same command CI runs:

```bash
node --test 'tests/**/*.test.js'
```

## Deploying

**Pushing to `main` is the only way to ship.** Vercel's git auto-deploy is off
(`vercel.json` → `git.deploymentEnabled`), so production comes solely from
`.github/workflows/test.yml`: tests → refresh the admin coverage snapshot and the
homepage LinkedIn fallback cards (committed by a bot) → `vercel deploy --prod`.

A failing test therefore blocks the deploy, and the bot's commit lands on `main`
right after yours — so `git pull --rebase` before pushing twice in a row.

## How it's built

- **Pages** — 15 static HTML files at the root (incl. `/books/`). `chrome.js` injects
  the shared nav and footer (the homepage carries its own copy inline: keep them in
  step); `common.js` handles scroll reveal, the video lightbox, forms and the gated
  book downloads; `site.css` is the design system.
- **Blog** — server-rendered from Supabase. `vercel.json` rewrites `/blog/:slug/`
  to `api/render-post`, `/blog/` to `api/blog-index`, feeds and sitemaps likewise.
- **`/admin/`** — invite-only CMS (Supabase Auth, httpOnly cookies) for posts,
  media, users and the homepage LinkedIn cards.
- **Forms** — contact submits to the Deal Desk, newsletter to EmailOctopus, both
  behind Cloudflare Turnstile. The eBook download is gated by `api/download`.
- **URLs** — `cleanUrls` + `trailingSlash`, so a redirect `source` in `vercel.json`
  must end in `/` or it will never match.

## Notes

- **No figure strips or stat blocks** (workshops / countries / leaders). They were
  removed in Nov 2026 because the numbers contradicted each other; do not add new
  ones until Raj confirms a single set.
- **No prices or dates for AI Sprints** on this site: link to
  https://resources.aifirstmindset.ai/membership ("See dates and prices").
- Every contact CTA reads **"Book a discovery call"** and goes to the `#work` form
  (or `/#work` on pages without one).
- The live LinkedIn image feed was removed (it showed AI-made images); pages show a
  plain "Follow Raj on LinkedIn" block. The `/api/linkedin` endpoint, the admin
  LinkedIn manager and `scripts/sync-linkedin-fallback.mjs` are now unused by the
  pages (the CI sync step skips harmlessly).
- WordPress-era URLs are preserved by 301s in `vercel.json` — check there before
  assuming a path is dead.
- Removed for good (SEO round 1, Nov 2026): `/fractional-chief-ai-officer/` 301s to
  `/ai-for-business-leaders/`; `/ai-business-consultant/` and
  `/organizational-transformation-consultant/` return 410 Gone via `api/gone.js`.
  Keep them out of nav, footer, forms and sitemaps (`tests/seo-round-1.test.js`).
