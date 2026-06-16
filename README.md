# Raj Goodman — Website Rebuild (Staging)

A static rebuild of **rajgoodman.com** in the new "Signal" design, for review and testing.

**🔗 Live staging:** https://design-two-delta.vercel.app/

## Pages (15)
`index.html` (home), `about`, `keynote-speaker`, `workshops`, `ai-training-for-executives`,
`ai-for-business-leaders`, `ai-trainer`, `ai-business-consultant`, `organizational-transformation`,
`fractional-caio`, `events`, `media`, `blog`, `testimonials`, `eo-ypo-leadership`.

## Run locally
It's a static site — serve the folder with any static server:

```bash
npx serve .
# or
python3 -m http.server 8000
```

Then open the printed URL (e.g. http://localhost:3000 or http://localhost:8000).

## How it's built
- Plain HTML/CSS/JS — no build step.
- `site.css` — shared "Signal" design system.
- `chrome.js` — injects the shared nav + footer on every page.
- `common.js` — scroll reveal, animated counters, and the in-page YouTube lightbox.
- `assets/` — all images (logos, photos, video thumbnails, eBook covers).

## Status / notes
- **Design is a new direction.** Content is being brought to **parity with the current rajgoodman.com** (verbatim copy), page by page — Keynote is the completed reference.
- **Not wired up yet (POC):** contact forms, newsletter signup, eBook/audiobook downloads — these don't submit and don't need testing.
- **Stats are intentionally** 300+ workshops / 20+ countries / 20,000+ leaders.
- URLs currently end in `.html`; clean `/slug/` URLs are a later step.
