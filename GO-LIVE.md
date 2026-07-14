# rajgoodman.com — Go-Live Guide

*Prepared for Raj Goodman by David Robertson / AI-First Mindset · 14 July 2026*

This document describes exactly how the new website goes live, what has already
been done, what happens on the day, and how we roll back if anything looks wrong.

---

## 1. Where things stand

The new site is fully built and running at **rajgoodman-website.vercel.app**
(the "staging" address). The live domain **rajgoodman.com** still points at the
old WordPress site. Going live = pointing the domain at the new site. Nothing
is copied or moved on the day - the switch is a DNS change that takes minutes.

Everything below is already done and verified:

- **Content parity** - every page, blog post, category archive and redirect
  from the live site exists on the new one (one open editorial question - see
  section 2).
- **Blog engine** - WordPress replaced by our own editor at `/admin/`
  (Supabase-backed, invite-only logins for the team).
- **Forms** - contact and newsletter forms are spam-protected (Cloudflare
  Turnstile) and deliver to Deal Desk and EmailOctopus. Ebook/audiobook
  downloads are gated behind the lead-capture form.
- **GDPR** - cookie consent banner (Google Consent Mode v2) + privacy policy;
  newsletter double opt-in.
- **Analytics** - the same Google Analytics property and Tag Manager container
  carry over. Conversion tracking is pre-wired on both sides (GTM container v8,
  published 14 July): it switches on automatically the moment the domain moves.
  No analytics work happens on cutover day.
- **Performance** - the new homepage is 75% lighter and paints its hero in
  ~0.8s vs ~1.1s on WordPress (full comparison in the readiness report).
- **SEO surface** - dynamic XML sitemaps, canonicals matching the live URLs,
  301 redirects for every WordPress-era URL pattern (uploads, feeds,
  pagination, author archive).
- **Tests** - 233 automated checks run on every change and are green.

## 2. Open items BEFORE the switch (owner in bold)

1. ~~Editorial: unpublished posts~~ **RESOLVED 14 July.** Areeb retired 5
   posts as part of his content review; the site goes live with the 16
   approved posts. All 5 retired URLs (and the now-empty AI-First Mindset
   category) 301-redirect to /blog/, so nothing indexed by Google breaks.
   Note for later: if any of these posts is ever re-published, its redirect
   must be removed from vercel.json at the same time.
2. **Admin login emails - custom SMTP** (**David**). The editor's invite /
   password-reset emails currently use Supabase's built-in sender, which is
   rate-limited. Before the team relies on it, connect a proper sender
   (e.g. Google Workspace SMTP or Resend) in Supabase Auth settings.
3. **Credential rotation** (**David**). Rotate the Supabase service keys as a
   pre-launch hygiene step and re-set them in Vercel env + local `.env`.
4. **Legal review** (**Raj**, can be post-launch). The Terms & Conditions page
   was migrated verbatim from the old site and overlaps the newer interim
   Privacy Policy; both should go to legal review together at some point.

Nothing else blocks the switch.

## 3. Cutover day - the switch itself

Best time: a quiet period (early morning / weekend). Total hands-on time is
about 30 minutes; visitors see no downtime either way.

### Step 1 - Add the domain to the Vercel project

In Vercel → project `rajgoodman-website` → **Settings → Domains** → add
`rajgoodman.com` and `www.rajgoodman.com` (www redirects to the apex).
Vercel then displays the exact DNS records it needs.

### Step 2 - Update DNS where rajgoodman.com is managed

At the DNS provider (the live site currently sits behind Cloudflare with
WP Engine hosting - whoever manages that zone applies this):

| Record | Name | Value |
|---|---|---|
| A | `rajgoodman.com` (apex/@) | `76.76.21.21` (use the value Vercel shows) |
| CNAME | `www` | `cname.vercel-dns.com` |

Notes for the DNS operator:
- Remove/replace the existing A/CNAME records that point at WP Engine.
- If the zone is on Cloudflare, set these two records to **DNS only**
  (grey cloud, not proxied) so Vercel can issue its SSL certificate.
- Leave `cdn.rajgoodman.com` and any mail (MX) records untouched.
- Lower the TTL to 300s an hour before the change if it isn't already.

### Step 3 - Wait for the certificate

Vercel detects the DNS change and issues an SSL certificate automatically -
typically 5-15 minutes. The Domains screen shows a green tick when done.

### Step 4 - Verify (15 minutes, checklist)

- [ ] `https://rajgoodman.com/` loads the NEW site with a valid padlock
- [ ] `https://www.rajgoodman.com/` redirects to the apex
- [ ] Homepage, About, a service page, `/blog/` and one blog post all load
- [ ] Submit a test contact form -> arrives in Deal Desk
- [ ] Subscribe with a test email -> confirmation email arrives
- [ ] Download an ebook via the gated form -> file opens
- [ ] Cookie banner appears in a private/incognito window
- [ ] GA4 Realtime (property "Raj Goodman") shows your visit - analytics is ON
      (it activates by hostname, automatically)
- [ ] `https://rajgoodman.com/sitemap_index.xml` serves the new sitemaps
- [ ] Old WordPress URLs redirect: try
      `/wp-content/uploads/...` (any old image URL) and `/blog/page/2/`
- [ ] Admin: log in at `/admin/`, open a post, check the editor loads

David then runs the full 46-URL parity script against the live domain as the
formal gate (same check that passes on staging today).

### Step 5 - Tell Google

In Google Search Console (the existing rajgoodman.com property):
submit `https://rajgoodman.com/sitemap_index.xml`. Over the following days,
watch Coverage for the redirected/retired URLs. No other GSC action is
needed - the domain and URLs are unchanged, so there is no "site move".

## 4. Rollback - if anything looks wrong

The old site stays fully intact on WP Engine. To roll back: restore the
previous DNS records (point the A record back at WP Engine). Propagation is
minutes at the lowered TTL. **Keep the WP Engine subscription active for at
least 2 weeks after a successful launch**, then cancel.

## 5. First week after launch

- **Analytics numbers will shift - this is expected and good.** The old site
  under-counted (tracking only started after a visitor clicked or scrolled,
  and newsletter signups were never tracked at all - broken for 90+ days).
  The new site counts everyone who consents, from the first page. Compare
  trends, not absolutes, across the cutover date. Arif has the full
  before/after evidence pack.
- David pauses the old WordPress-specific triggers in Tag Manager (cleanup,
  no effect on data).
- Watch GA4 Realtime + the contact inbox for the first days; the 233-test
  suite keeps guarding every code change.
- Post-launch improvements already queued on the project board: in-page video
  playback, styled double-opt-in email, per-book download events if wanted.

## 6. Who to call

- **Site, deploys, analytics, redirects** - David Robertson
- **Editorial / blog content** - Areeb (editor access), Tev (writer)
- **SEO monitoring** - Arif
- **DNS / WP Engine account** - whoever holds the Cloudflare + WP Engine
  logins on the Goodman Lantern side (needed for ~15 minutes on the day)
