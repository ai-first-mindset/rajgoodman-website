# Content-Parity Update — Changelog

**Branch:** `content-parity-fixes`  ·  **Base:** `main`  ·  **Date:** 2026-06-09

Brings the new staging design into content parity with the live site
(`https://rajgoodman.com/`, the source of truth), per the QA audit
("Content check — staging vs live"). The design/layout is intentionally new —
only **content** was changed to match live. Verbatim copy was pulled from the
live site.

> **Intended difference kept on purpose:** stats remain
> **250+ workshops · 20+ countries · 20,000+ leaders**. The "Leaders" figure is
> displayed as **20K+** so it fits the stat box.

---

## Homepage — `index.html`

| Section | Change |
|---|---|
| Hero | Copy updated to live ("Raj Goodman" + AI Futurist / Keynote Speaker / Entrepreneur + live intro). Design preserved. |
| Press & Features | Replaced text wordmarks with the **8 live press logos** (`assets/live-logos/`). |
| AI Leadership | Heading → "AI Leadership Starts Here"; restored **both** live paragraphs. |
| Meet Raj | Image `object-position` adjusted (see Blockers — original image needed). |
| Speaker Credentials | Expanded "LSE" → "London School of Economics"; added Google line; aligned mission statement. |
| Global Reach | Added "…see how Raj's insights are reshaping industries globally."; "Leaders Trained" → **20K+**. |
| Speaking | Full live subheading restored. |
| Raj in the Media | Heading → live "New York to Tokyo" line; **fixed duplicate image** (see Blockers — Daily Star image needed). |
| Testimonials | Heading + subheading → live ("What Clients and Partners Say"); all 5 quotes restored verbatim. |
| eBooks | Heading + "Executive Learning Library" copy → live; **covers enlarged** (portrait 3:4); descriptions **italicised**. |
| Blogs *(new)* | Added "What's Next? Raj on AI, Strategy & Innovation" with 3 live blog posts. |
| Newsletter *(new)* | Added "Stay Ahead with Raj's Insights" signup (First Name, Last Name, Email → "Join the Newsletter"). **Visual only — not wired.** |
| On LinkedIn | Card links updated to Raj's 4 actual LinkedIn posts. |
| Nav | Fixed vertical alignment of "Events"/"Testimonials" vs dropdown items. |

## About — `about.html`

| Section | Change |
|---|---|
| Hero | Heading → "Raj Goodman: The human-first innovator…" (added name prefix); image `object-position` adjusted (see Blockers). |
| Thought Process | Restored full live wording on all three cards (heading kept by request). |
| Trusted by Leaders *(new)* | Added "Trusted by purpose-led leaders across the globe" logo strip. |
| Raj in the Media *(new)* | Added media section (see Blockers — Daily Star image needed). |
| Global Reach | Added live closing line; "Leaders Trained" → **20K+**. |
| Testimonials | Aligned to live roster (added Robert Waweru, James Tan, Sneha Shah; removed Parag Bandare). |
| Contact form | Added a **placeholder CAPTCHA** (non-functional stand-in until backend is built). |

## New assets
- `assets/live-logos/` — 8 press logos downloaded from the live CDN.
- `assets/Image-2.webp` — temporary placeholder for the Daily Star media card.

---

## Outstanding — needs assets / access (blockers)

1. **Cropped portrait images.** The "Meet Raj" (homepage) and About hero images
   are cut. Need the **original images**, or replacements better suited to the
   new vertical layout.
2. **Daily Star media image.** Currently a placeholder. Need the original from
   the WordPress media library.
3. **"Work with Raj" image.** Appears unnecessarily cropped — original needed.
4. **eBook covers.** Covers were enlarged; need the **original cover artwork**
   so the larger size sits proportionally against the background.
5. **Vercel back-end access.** Required to wire the **contact form**, **newsletter
   form**, and a **real CAPTCHA** (the POST/verification backend). Forms are
   currently visual-only.

## Known minor items
- Press logo #5 (`Vector-17.svg`) — brand not identified in live source; pulled the live file as-is.
- Placeholder CAPTCHA is on the About contact form only (not yet on the homepage forms).
- Nav alignment fix is on the homepage's inline CSS; interior pages use `site.css` (fix can be ported there).
