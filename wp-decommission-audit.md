# WordPress decommission audit — rajgoodman.com

Audited 2026-07-20, ahead of the planned WP Engine cancellation (~2026-07-29).
Method: crawled all 41 live sitemap pages + admin and inventoried every external
reference by host; checked DNS/MX; reviewed serverless config.

## Verdict: PASS — zero runtime reliance on WordPress/WP Engine

| Dependency class | Finding | Status |
|---|---|---|
| Page assets (images/media) | 41/41 pages reference ONLY the Supabase `blog-media` bucket (255 refs) - no wpengine.com, wp.com, cdn.*, s.w.org, gravatar, or staging hosts anywhere | ✅ independent |
| Fonts / scripts | Google Fonts only; all JS self-hosted (chrome.js, common.js, cookie-consent) | ✅ independent |
| DNS | Nameservers = GoDaddy (`domaincontrol.com`); apex A → Vercel; www 308→apex. WP Engine plays no DNS role | ✅ independent |
| Email | No MX records on rajgoodman.com - no mailboxes to lose | ✅ n/a |
| Legacy WP URLs inbound | `/wp-content/uploads/*` 301→Supabase, retired posts/category/author/pagination 301s, `/*` GSC fix - all served by vercel.json, independent of WP | ✅ independent |
| Forms / leads | `/api/contact`→DealDesk, `/api/subscribe`→EmailOctopus, Turnstile-gated - all serverless | ✅ independent |
| Downloads (ebooks/audiobooks) | Supabase `downloads` bucket | ✅ independent |
| Blog + admin | Supabase `rajgoodman-blog` project (Raj's org) | ✅ independent |
| Analytics/consent | GTM + GA4 (Google-hosted) + self-hosted consent widget | ✅ independent |
| Outbound links | Sister-site links to aifirstmindset.ai (21) and goodmanlantern.com (11) are plain links, not dependencies; aifirstmindset.ai URLs survive that site's own cutover unchanged | ✅ fine |

## Before cancelling WP Engine (recommendations, not blockers)

1. **Final backup/export** of the WP Engine install (content insurance; the 12
   unpublished WP-era drafts already exist in the blog DB as drafts).
2. Cancel any **staging/dev environments** on the same account
   (`rajanandbizstg.wpenginepowered.com` - note: the AIFM build referenced one
   image + one link on this staging host; both were migrated/repointed
   2026-07-20, so nothing references it anymore).
3. Confirm no third-party service (Zapier/integrations) still authenticates
   against the WP install.
