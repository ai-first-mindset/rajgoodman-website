# Content-Parity Update — Changelog

**Branch:** `content-parity-fixes`  ·  **Base:** `main`  ·  **Updated:** 2026-06-10

Brings the new staging design into content parity with the live site
(`https://rajgoodman.com/`, the source of truth), per the QA audit
("Content check — staging vs live"). The design/layout is intentionally new —
only **content** was changed to match live. Copy was pulled **verbatim** from the
live site.

> **Intended difference kept on purpose:** stats remain
> **250+ workshops · 20+ countries · 20,000+ leaders**. The "Leaders" figure is
> displayed as **20K+** so it fits the stat box. (Live phrases its reach as
> "5 continents, 50+ countries" — deliberately not matched.)

---

## Homepage — `index.html`

| Section | Change |
|---|---|
| Hero | Copy updated to live ("Raj Goodman" + AI Futurist / Keynote Speaker / Entrepreneur + live intro). Design preserved. |
| Press & Features | **9 standardised press logos** (`assets/live-logos/`): Guardian, Argus, Inc., InformIT, O'Reilly, EO London, Goodman Lantern, Golden, Telecom Reseller. White backgrounds knocked out, trimmed, normalised to a uniform height so they render as clean uniform white marks (×2 for the seamless marquee). |
| AI Leadership | Heading → "AI Leadership Starts Here"; restored **both** live paragraphs. |
| Meet Raj | Text column stretched and bullets distributed so the bio/bullets match the **full height of the photo** (the photo was confirmed not cropped). |
| Speaker Credentials | Expanded "LSE" → "London School of Economics"; added Google line; mission card aligned. |
| Global Reach | Added "…see how Raj's insights are reshaping industries globally."; "Leaders Trained" → **20K+**. |
| Speaking | Full live subheading restored. |
| Raj in the Media | Heading → live "New York to Tokyo" line; fixed duplicate image (see Blockers — Daily Star image needed). |
| Testimonials | Heading + subheading → live ("What Clients and Partners Say"); all 5 quotes restored verbatim. |
| eBooks | Heading + "Executive Learning Library" copy → live; **real cover artwork** added and enlarged to full-bleed (transparent margins trimmed); descriptions **italicised**. |
| Blogs *(new)* | Added "What's Next? Raj on AI, Strategy & Innovation" with 3 live blog posts. |
| Newsletter *(new)* | Added "Stay Ahead with Raj's Insights" signup (First Name, Last Name, Email → "Join the Newsletter"). **Visual only — not wired.** |
| Work with Raj | Replaced cropped avatar with a new head-and-shoulders crop (full forehead); the quote is now **quoted + italicised**. |
| On LinkedIn | Card links updated to Raj's 4 actual LinkedIn posts. |
| Nav | Fixed vertical alignment of "Events"/"Testimonials" vs dropdown items. |

## About — `about.html`

Aligned **verbatim** to live across the page.

| Section | Change |
|---|---|
| Hero | Heading → "Raj Goodman: The human-first innovator…"; new original image anchored left so **Raj is in frame** (was cropping him out). |
| Some organizations thrive… | Body re-aligned verbatim to live. |
| Raj's Thought Process | Heading corrected: the invented "Technology only works when people do" replaced with live's **"Raj's Thought Process"**; all three card bodies verbatim. |
| Journey So Far | Card headings + bodies set to live verbatim; restored dropped sentences; Storyteller card now uses live wording. |
| Watch Raj in Action | Restored the dropped "trusted AI keynote speaker…" sentence. |
| Testimonials | Rebuilt to the **full live roster of 15** (was 8) with verbatim quotes; added live intro paragraph; heading → "Why the Audience Loves Raj Goodman". |
| Trusted by Leaders | Added the missing live body sentence above the logo strip. |
| Raj in the Media | Replaced the wrong (homepage) headline with live's "Raj in the Media" + its missing body paragraph (QA-flagged). |
| Global Reach | Added live closing line; "Leaders Trained" → **20K+**. |
| FAQs | Questions + answers set to live verbatim. |
| Contact form | **Placeholder CAPTCHA** in place (non-functional stand-in until backend is wired). |

## EO & YPO — `eo-ypo-leadership.html`
- Centered the hero stat readout values (5+, 150+, 2, Chair) — were left-aligned.

---

## New assets
- `assets/live-logos/` — 9 standardised press logos (`the-guardian.png`, `the-argus.png`, `inc.png`, `informit.png`, `oreilly.png`, `eo-london.png`, `goodman-lantern.png`, `golden.png`, `telecom-reseller.png`).
- `assets/ebook-embracing.png`, `assets/ebook-ai-era.png`, `assets/ebook-trust.png` — real eBook cover artwork (trimmed).
- `assets/raj-work.webp` — new "Work with Raj" crop.
- `assets/eofpk16jan-firstmindset-33-68b541dd241b9.webp` — About hero (full original).

## Resolved since the first draft
- ✅ Press logos standardised (no blank/box logos; uniform white).
- ✅ Real eBook cover artwork added and enlarged.
- ✅ "Work with Raj" image recropped (full forehead).
- ✅ About hero recropped so Raj is in frame.
- ✅ About content brought to **verbatim** parity (testimonials, Journey, Media, FAQ, etc.).

## Outstanding — needs assets / backend
1. **Daily Star media image.** Still a placeholder (`assets/Image-2.webp`). Needs the original from the WordPress media library.
2. **Forms + CAPTCHA backend.** Contact form, newsletter signup, and a real CAPTCHA are visual-only. Now feasible via the connected **Vercel** backend (POST + verification still to be built).

## Known minor items
- Placeholder CAPTCHA is on the About contact form only (not yet on the homepage forms).
- Homepage nav alignment fix is in the page's inline CSS; interior pages use `site.css` (fix can be ported there).

---

## Deployment / preview
- The repo is connected to **Vercel**: pushing this branch produces an automatic preview URL, and opening a PR into `main` posts the preview link on the PR. Merging to `main` updates production.
- The generated static bundle in **`_dist/`** is tracked in this branch (kept in sync with the root) so source and the deployable copy are centralised.
