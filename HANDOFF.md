# Developer Handoff — Raj Goodman Website Rebuild

This is everything you need to take over the rebuild. Read this top to bottom once; it'll save you the back-story.

---

## 1. What this is
A static rebuild of **rajgoodman.com** in a new design (internally called the **"Signal"** design — dark amber canvas, yellow/blue accents, mono labels, HUD frames). The brief evolved into two rules:

1. **Design = new.** The look/layout is the new direction and is approved. Don't revert to the old WordPress look.
2. **Content = parity with the *current* live rajgoodman.com.** Every text block, testimonial, stat, link, and image should match the live site **verbatim**, page by page. (See §6 for what's done vs pending.)

- **Live site (content source of truth):** https://rajgoodman.com/
- **Live staging (this build):** https://design-two-delta.vercel.app/ (Vercel, account `rajanand012`, project `design`)

---

## 2. Current status (snapshot)
- **15 pages built** and deployed: `index` (home), `about`, `keynote-speaker`, `workshops`, `ai-training-for-executives`, `ai-for-business-leaders`, `ai-trainer`, `ai-business-consultant`, `organizational-transformation`, `fractional-caio`, `events`, `media`, `blog`, `testimonials`, `eo-ypo-leadership`.
- **Content parity status:**
  - ✅ **Verbatim live content:** `keynote-speaker` (the **reference page** — copy this approach), `testimonials`.
  - ⚠️ **Still designer-paraphrased (needs the parity pass):** all other pages. Note: the 7 service pages already have the **live bottom-fold structure** (What's Next → Raj's Global Reach → Turning Vision into Ventures → Contact), but their *main* copy is still the designer's wording.
- **0 broken images**, all internal nav/footer links resolve.

---

## 3. Architecture (no build step)
Plain HTML/CSS/JS. Open a file or serve the folder — that's it.

| File | Role |
|---|---|
| `index.html` | Home — **self-contained** (its own inline `<style>` + inline nav/footer). The odd one out. |
| `*.html` (interior pages) | Each links `site.css`, and injects nav/footer via `chrome.js`, interactions via `common.js`. |
| `site.css` | Shared "Signal" design system — all component classes live here. |
| `chrome.js` | Injects the shared **nav + footer** into every interior page. Set `<body data-page="...">` to highlight the active nav item. |
| `common.js` | Scroll-reveal (`[data-reveal]`), animated counters (`[data-count]`), smooth scroll, mobile nav, and the **in-page YouTube lightbox**. |
| `assets/` | All images (logos, photos, video thumbnails, eBook covers). Everything is **localized** (no hotlinks). |

### Reusable component classes (in `site.css`)
`.phero` / `.phero-grid` (interior hero) · `.hero`/`.hframe` (home hero, inline) · `.trust` (logo rail) · `.feat-grid`/`.feat` (cards) · `.steps` · `.reach`/`.big` (stat band) · `.gal` (video gallery) · `.media-grid`/`.mcard` · `.tst-row`/`.quote` and `.tgrid` (testimonials) · `.blog-grid`/`.post` · `.co-grid`/`.co` (ventures) · `.cred-grid`/`.cred` · `.work-grid` (contact) · `.faq`.

### Conventions
- **Section header pattern:** `<div class="shead"><span class="idx">[ 01 ]</span><span class="kick">LABEL</span><span class="ln"></span></div>` then `<h2>`.
- **Videos:** real `<a href="…youtube.com/watch?v=ID…">` links. `common.js` intercepts them and opens an in-page `youtube-nocookie` lightbox (no iframe loads until click → fast + SEO-safe). Channel/non-video links pass through. Timestamps via `?t=140` are honored.
- **Stats are intentionally `250+` workshops / `20+` countries / `20,000+` leaders** everywhere they appear (a deliberate override of the live numbers — keep them).

---

## 4. Run & deploy
```bash
npx serve .            # or: python3 -m http.server 8000
```
Deploy (static) to Vercel:
```bash
vercel deploy --prod --yes     # from the repo root; updates https://design-two-delta.vercel.app/
```

---

## 5. Pulling content from the live site (for the parity pass)
The WordPress **REST API is open** — the reliable way to get exact content:
- Pages: `https://rajgoodman.com/wp-json/wp/v2/pages?per_page=100&_fields=id,slug,link,title`
- Posts: `https://rajgoodman.com/wp-json/wp/v2/posts`  · Media: `…/wp/v2/media`
- **Gotcha:** the **home page** (`pages/12`) returns empty `content.rendered` (it's template-built), so scrape the rendered HTML for the homepage. Most interior pages have usable `content.rendered`.
- A plain `curl` of an HTML page may hit Cloudflare 403 on bursts; `robots.txt` allows `ClaudeBot`. Fetching the rendered HTML once (browser UA) generally works; lazy images use `data-lazy-src`.

**Keynote (`keynote-speaker.html`) is the worked reference**: live section order mirrored exactly, every block verbatim, stats kept, videos in the lightbox. Mirror that for each remaining page.

---

## 6. Roadmap — what's left (priority order)
1. **Content parity** — bring the remaining 13 pages to verbatim live copy (Keynote is the template).
2. **Missing pages** — live has these, not yet built: **Industries**, **Authors**, **Site-map**, **Terms & Conditions**, and **individual blog-post pages** (blog cards currently link out to live WP).
3. **Forms / functionality (currently POC, non-functional):** contact forms, newsletter signup, eBook/audiobook downloads → wire to a backend (serverless fn → email e.g. Resend; ESP for newsletter; gated file delivery for eBooks).
4. **SEO parity:** per-page `<title>`/meta/canonical, OG/Twitter cards, JSON-LD (home has Person/WebSite schema — replicate per page), `sitemap.xml`, `robots.txt`, **301 redirects**, favicons.
5. **URL parity:** clean `/slug/` URLs instead of `*.html`; fix off-slugs (`organizational-transformation` → live `organizational-transformation-consultant`; `fractional-caio` → `fractional-chief-ai-officer`; `workshops` ↔ `workshops/tech-workshop`).
6. **Headless CMS** — Raj wants to keep self-service editing. Plan was: keep the new front-end + a CMS (Sanity/Payload, or WordPress headless) feeding it. If you move to a framework, **Next.js + CMS** or **Astro content collections** were the candidates.
7. **Production decision + deploy:** ship static as-is, or port to Next.js/Astro first; then domain + SSL + analytics + cookie consent.

---

## 7. Known limitations (POC state)
- Forms/newsletter/eBook downloads don't submit (intentional — see §6.3).
- Some pages' copy is still the designer's paraphrase (see §2).
- URLs end in `.html`.
- A few "best-effort" spots flagged during the build: homepage testimonial-marquee video links to Raj's YouTube **channel** (not a single video); some service-page reach bands were standardized to the canonical stats rather than each page's original numbers.

---

## 8. Reference: original design bundle
The design was produced in Claude Design and exported as a handoff bundle (HTML prototypes + chat transcripts explaining intent). If useful:
`https://api.anthropic.com/v1/design/h/BB2XH_eiEv30j-SLkHh9yg` (downloads `Rajgoodman.com-handoff.tar.gz`). The built pages here supersede the prototypes, but the transcripts capture design rationale.
